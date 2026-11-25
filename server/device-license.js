import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { createHash, createPublicKey, createPrivateKey, createVerify, sign, randomBytes } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { db, getClient } from './db.js';
import { digest } from './security.js';

const router = Router();
const limiter = rateLimit({ windowMs: 15 * 60_000, limit: 40, standardHeaders: 'draft-7', legacyHeaders: false });
router.use(limiter);
const keySchema = z.string().regex(/^PT-[A-Z2-9]{6}(?:-[A-Z2-9]{6}){3}$/);
const startSchema = z.object({
  mode: z.enum(['activate', 'refresh']),
  key: keySchema.optional(), licenseId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
  devicePublicKey: z.string().min(100).max(4000)
}).strict();
const finishSchema = z.object({
  challengeId: z.string().regex(/^[a-f0-9]{24}$/i),
  signature: z.string().min(40).max(4000)
}).strict();
const rawPub = s => Buffer.from(s, 'base64');
const fingerprint = s => createHash('sha256').update(rawPub(s)).digest('hex');
const parse = (schema, body, res) => { const v = schema.safeParse(body); if (!v.success) { res.status(400).json({ error: 'Invalid request' }); return null; } return v.data; };
const isAllowed = license => license && license.status !== 'revoked' && (!license.expiresAt || new Date(license.expiresAt).getTime() > Date.now());
function signingKey() {
  const encoded = process.env.LICENSE_SIGNING_PRIVATE_KEY_B64;
  if (!encoded) throw new Error('Missing LICENSE_SIGNING_PRIVATE_KEY_B64');
  const key = createPrivateKey({key:Buffer.from(encoded, 'base64'), format:'der', type:'pkcs8'});
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('License signing key must be Ed25519');
  return key;
}
function makeEntitlement(license, deviceId) {
  const now = Date.now();
  const expires = license.expiresAt ? new Date(license.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;
  const payload = {v:1, iss:'piso-tabs-license-api', licenseId:license._id.toString(), deviceId,
    plan:license.plan, issuedAt:now, validUntil:Math.min(now+3*86400_000,expires),
    renewAfter:now+12*3600_000};
  const part=Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature=sign(null,Buffer.from(part,'ascii'),signingKey()).toString('base64url');
  return `${part}.${signature}`;
}
function publicKey(raw) {
  const key = createPublicKey({key:rawPub(raw),format:'der',type:'spki'});
  if (key.asymmetricKeyType!=='ec' || key.asymmetricKeyDetails?.namedCurve!=='prime256v1') {
    throw new Error('Expected P-256 device public key');
  }
  return key;
}
// A challenge binds the license, device public key and nonce before any device slot is consumed.
router.post('/challenge', async(req,res,next)=>{
  try {
    const input=parse(startSchema,req.body,res); if(!input)return;
    if ((input.mode==='activate') !== Boolean(input.key) || (input.mode==='refresh') !== Boolean(input.licenseId)) return res.status(400).json({error:'Invalid activation mode'});
    let pub;
    try { pub=publicKey(input.devicePublicKey); } catch {return res.status(400).json({error:'Unsupported device public key'});}
    const deviceId=fingerprint(input.devicePublicKey);
    const database=await db();
    const license=input.mode==='activate'
      ? await database.collection('licenses').findOne({keyHash:digest(process.env.LICENSE_PEPPER,input.key)})
      : await database.collection('licenses').findOne({_id:new ObjectId(input.licenseId)});
    if(!isAllowed(license)) return res.status(403).json({error:'License unavailable or expired'});
    if(input.mode==='refresh') {
      const known=await database.collection('license_devices').findOne({licenseId:license._id,deviceId,revokedAt:{$exists:false}});
      if(!known) return res.status(403).json({error:'Device not activated for this license'});
    }
    const nonce=randomBytes(32).toString('base64url');
    const expiresAt=new Date(Date.now()+3*60_000);
    const record={licenseId:license._id,deviceId,devicePublicKey:input.devicePublicKey,
      mode:input.mode,nonce,expiresAt,createdAt:new Date()};
    const result=await database.collection('license_challenges').insertOne(record);
    res.status(201).json({challengeId:result.insertedId.toString(),nonce,deviceId,expiresAt:expiresAt.toISOString()});
  }catch(error){next(error);}
});
router.post('/complete',async(req,res,next)=>{
  try {
    const input=parse(finishSchema,req.body,res);if(!input)return;
    const database=await db();const id=new ObjectId(input.challengeId);
    const challenge=await database.collection('license_challenges').findOne({_id:id,consumedAt:{$exists:false},expiresAt:{$gt:new Date()}});
    if(!challenge) return res.status(409).json({error:'Challenge expired or already used'});
    const msg=`PISO-TABS-LICENSE-V1\n${input.challengeId}\n${challenge.nonce}\n${challenge.deviceId}`;
    let verified=false;
    try {const verifier=createVerify('SHA256');verifier.update(msg);verifier.end();verified=verifier.verify(publicKey(challenge.devicePublicKey),Buffer.from(input.signature,'base64'));} catch {}
    if(!verified) return res.status(403).json({error:'Device signature verification failed'});
    const session=getClient().startSession();let issuedLicense;
    try {
      await session.withTransaction(async()=>{
        const used=await database.collection('license_challenges').updateOne({_id:id,consumedAt:{$exists:false},expiresAt:{$gt:new Date()}},{$set:{consumedAt:new Date()}},{session});
        if(used.modifiedCount!==1) throw new Error('Challenge already consumed');
        const license=await database.collection('licenses').findOne({_id:challenge.licenseId},{session});
        if(!isAllowed(license)) throw new Error('License unavailable or expired');
        const devices=database.collection('license_devices');
        const existing=await devices.findOne({licenseId:license._id,deviceId:challenge.deviceId},{session});
        if(existing) {
          if(existing.revokedAt || existing.devicePublicKey!==challenge.devicePublicKey) throw new Error('Device revoked or key changed');
          await devices.updateOne({_id:existing._id},{$set:{lastSeenAt:new Date()}},{session});
        } else {
          if(challenge.mode!=='activate') throw new Error('Unregistered device');
          const claimed=await database.collection('licenses').updateOne({_id:license._id,status:{$ne:'revoked'},$expr:{$lt:['$activationCount','$maxDevices']}},{$inc:{activationCount:1}},{session});
          if(claimed.modifiedCount!==1) throw new Error('License device limit reached');
          await devices.insertOne({licenseId:license._id,deviceId:challenge.deviceId,
            devicePublicKey:challenge.devicePublicKey,createdAt:new Date(),lastSeenAt:new Date()},{session});
        }
        await database.collection('audit_logs').insertOne({adminId:null,action:'device.entitlement_issued',targetId:license._id.toString(),details:{deviceId:challenge.deviceId,mode:challenge.mode},createdAt:new Date()},{session});
        issuedLicense=license;
      });
    }catch(error){
      if(error.code===11000)return res.status(409).json({error:'Device activation conflicted; retry with a new challenge'});
      if(/Challenge|License|Device|Unregistered/.test(error.message))return res.status(409).json({error:error.message});
      throw error;
    }finally {await session.endSession();}
    res.json({entitlement:makeEntitlement(issuedLicense,challenge.deviceId),licenseId:issuedLicense._id.toString()});
  } catch(error){next(error);}
});
export async function prepareDeviceLicenseIndexes(database) {
  await Promise.all([
    database.collection('license_devices').createIndex({licenseId:1,deviceId:1},{unique:true}),
    database.collection('license_devices').createIndex({deviceId:1}),
    database.collection('license_challenges').createIndex({expiresAt:1},{expireAfterSeconds:0}),
    database.collection('license_challenges').createIndex({licenseId:1})
  ]);
}
export { router as deviceLicenseRouter, signingKey, makeEntitlement };
