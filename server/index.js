import 'node:process';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, getClient } from './db.js';
import { deviceLicenseRouter, prepareDeviceLicenseIndexes, signingKey } from './device-license.js';
import { digest, hashPassword, verifyPassword, token, newLicenseKey, licenseMask, serializeLicense } from './security.js';

const production = process.env.NODE_ENV === 'production';
const sessionPepper = process.env.SESSION_PEPPER;
const licensePepper = process.env.LICENSE_PEPPER;
if (!sessionPepper || !licensePepper || sessionPepper.length < 32 || licensePepper.length < 32 || sessionPepper === licensePepper) {
  throw new Error('Set independent random SESSION_PEPPER and LICENSE_PEPPER (at least 32 characters each)');
}
if (production && (!process.env.APP_ORIGIN?.startsWith('https://'))) throw new Error('Production APP_ORIGIN must be HTTPS');
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"], objectSrc: ["'none'"], upgradeInsecureRequests: production ? [] : null } } }));
app.use(express.json({ limit: '24kb' }));
app.use(cookieParser());
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
const asyncRoute = fn => (req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false, message: {error:'Too many login attempts; try later.'} });
const writeLimiter = rateLimit({ windowMs: 60 * 1000, limit: 45, standardHeaders: 'draft-7', legacyHeaders: false, message: {error:'Too many requests; try later.'} });
const SESSION_AGE_MS = 8 * 60 * 60 * 1000;
function setCookie(res, t) { res.cookie('pt_admin_session', t, { httpOnly: true, secure: production, sameSite: 'strict', path: '/', maxAge: SESSION_AGE_MS }); }
function eraseCookie(res) { res.clearCookie('pt_admin_session', { httpOnly:true, secure:production, sameSite:'strict', path:'/' }); }
function originGuard(req,res,next) {
  if (['GET','HEAD','OPTIONS'].includes(req.method)) return next();
  const origin=req.get('origin');
  const expected=process.env.APP_ORIGIN?.replace(/\/$/,'');
  // All portal mutations come from the same-origin React site and include this non-simple header.
  if (!origin || origin !== expected || req.get('x-piso-tabs-request') !== 'portal') return res.status(403).json({error:'Request origin verification failed.'});
  next();
}
// Native device requests use signed Keystore challenges, not browser CSRF headers.
app.use('/api/device', deviceLicenseRouter);
app.use('/api', originGuard);
function validObjectId(id) { return /^[a-f0-9]{24}$/i.test(id) ? new ObjectId(id) : null; }
function parse(schema, body, res) { const result=schema.safeParse(body); if (!result.success) {res.status(400).json({error:'Invalid input',fields:result.error.flatten().fieldErrors});return null;} return result.data; }
async function requireAdmin(req,res,next) {
  const secret = req.cookies?.pt_admin_session;
  if (!secret || typeof secret !== 'string') return res.status(401).json({error:'Authentication required.'});
  const database=await db();
  const found=await database.collection('sessions').findOne({ tokenHash:digest(sessionPepper,secret), expiresAt:{$gt:new Date()} });
  if (!found) return res.status(401).json({error:'Session expired.'});
  const admin=await database.collection('admins').findOne({_id: found.adminId, disabled:{$ne:true}}, {projection:{passwordHash:0}});
  if (!admin) return res.status(401).json({error:'Administrator disabled.'});
  req.admin=admin;req.sessionDoc=found; next();
}
function audit(database, adminId, action, targetId, details={}) {return database.collection('audit_logs').insertOne({adminId,action,targetId,details,createdAt:new Date()});}
app.get('/healthz', (req,res)=>res.status(200).json({status:'running'}));
app.post('/api/auth/login',loginLimiter,asyncRoute(async(req,res)=>{
  const data=parse(z.object({email:z.string().email().max(200),password:z.string().min(1).max(256)}).strict(),req.body,res);if(!data)return;
  const database=await db();const email=data.email.trim().toLowerCase();
  const admin=await database.collection('admins').findOne({email,disabled:{$ne:true}});
  // Always calculate a slow hash even when account does not exist to reduce user enumeration.
  const fallback='scrypt$32768$0123456789abcdef0123456789abcdef$'+'00'.repeat(64);
  const valid=await verifyPassword(data.password,admin?.passwordHash||fallback);
  if (!valid || !admin) return res.status(401).json({error:'Incorrect email or password.'});
  const raw=token();const expiresAt=new Date(Date.now()+SESSION_AGE_MS);
  await database.collection('sessions').insertOne({adminId:admin._id,tokenHash:digest(sessionPepper,raw),expiresAt,createdAt:new Date()});
  setCookie(res,raw);
  await audit(database,admin._id,'admin.login',admin._id.toString());
  res.json({admin:{email:admin.email,role:admin.role}});
}));
app.get('/api/auth/me',asyncRoute(requireAdmin),asyncRoute(async(req,res)=>res.json({admin:{email:req.admin.email,role:req.admin.role}})));
app.post('/api/auth/logout',asyncRoute(requireAdmin),asyncRoute(async(req,res)=>{
  const database=await db();await database.collection('sessions').deleteOne({_id:req.sessionDoc._id});eraseCookie(res);res.json({ok:true});
}));
app.get('/api/dashboard',asyncRoute(requireAdmin),asyncRoute(async(req,res)=>{
  const database=await db();const coll=database.collection('licenses');const now=new Date();
  const [total,revoked,expired,expiringSoon]=await Promise.all([
    coll.countDocuments({}),coll.countDocuments({status:'revoked'}),
    coll.countDocuments({status:{$ne:'revoked'},expiresAt:{$lt:now}}),
    coll.countDocuments({status:{$ne:'revoked'},expiresAt:{$gte:now,$lte:new Date(Date.now()+30*86400_000)}})
  ]);
  const activatedDevices=await database.collection('license_devices').countDocuments({revokedAt:{$exists:false}});
  res.json({total,active:total-revoked-expired,revoked,expired,expiringSoon,activatedDevices,activationAvailable:true});
}));
app.get('/api/licenses',asyncRoute(requireAdmin),asyncRoute(async(req,res)=>{
  const limit=Math.min(Math.max(Number(req.query.limit)||25,1),100);
  const page=Math.min(Math.max(Number(req.query.page)||1,1),10000);
  const query=(typeof req.query.q==='string'?req.query.q:'').trim().slice(0,100);
  const safe=query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const filter=query?{$or:[{label:{$regex:safe,$options:'i'}},{customer:{$regex:safe,$options:'i'}},{keyHint:{$regex:safe,$options:'i'}}]}:{};
  const database=await db();const collection=database.collection('licenses');
  const [rows,total]=await Promise.all([collection.find(filter).sort({createdAt:-1}).skip((page-1)*limit).limit(limit).toArray(),collection.countDocuments(filter)]);
  res.json({items:rows.map(serializeLicense),total,page,limit});
}));
const licenseSchema=z.object({label:z.string().trim().min(2).max(90),customer:z.string().trim().min(2).max(100),plan:z.enum(['trial','monthly','annual','lifetime']),maxDevices:z.number().int().min(1).max(100),expiresAt:z.string().datetime({offset:true}).nullable(),notes:z.string().trim().max(500).default(''),requestId:z.string().uuid()}).strict();
app.post('/api/licenses',writeLimiter,asyncRoute(requireAdmin),asyncRoute(async(req,res)=>{
  const input=parse(licenseSchema,req.body,res);if(!input)return;
  if(input.plan!=='lifetime'&&!input.expiresAt)return res.status(400).json({error:'Expiry date required for this plan.'});
  if(input.plan==='lifetime'&&input.expiresAt)return res.status(400).json({error:'Lifetime licenses cannot have an expiry date.'});
  if(input.expiresAt && new Date(input.expiresAt)<=new Date())return res.status(400).json({error:'Expiry must be in the future.'});
  const database=await db(); const raw=newLicenseKey();const now=new Date();
  const doc={...input,expiresAt:input.expiresAt?new Date(input.expiresAt):null,status:'issued',activationCount:0,keyHint:licenseMask(raw),keyHash:digest(licensePepper,raw),createdAt:now,createdBy:req.admin._id};
  const mongoClient=getClient();
  const session=mongoClient.startSession();let insertedId;
  try {
    await session.withTransaction(async()=>{
      const result=await database.collection('licenses').insertOne(doc,{session});insertedId=result.insertedId;
      await database.collection('audit_logs').insertOne({adminId:req.admin._id,action:'license.created',targetId:insertedId.toString(),details:{plan:input.plan,maxDevices:input.maxDevices},createdAt:new Date()},{session});
    });
  } catch(error) {
    if(error.code===11000)return res.status(409).json({error:'This creation request was already processed. No additional key was generated. If the original key was lost, revoke that license and create a new one.'});
    throw error;
  } finally {await session.endSession();}
  res.status(201).json({license:serializeLicense({...doc,_id:insertedId}),key:raw,oneTimeDisplay:true});
}));
app.post('/api/licenses/:id/revoke',writeLimiter,asyncRoute(requireAdmin),asyncRoute(async(req,res)=>{
  const id=validObjectId(req.params.id);if(!id)return res.status(400).json({error:'Invalid license ID'});
  const database=await db();const result=await database.collection('licenses').findOneAndUpdate({_id:id,status:{$ne:'revoked'}},{$set:{status:'revoked',revokedAt:new Date(),revokedBy:req.admin._id}},{returnDocument:'after'});
  if(!result)return res.status(409).json({error:'License not found or already revoked.'});
  await audit(database,req.admin._id,'license.revoked',id.toString());res.json({license:serializeLicense(result)});
}));
app.post('/api/licenses/:id/renew',writeLimiter,asyncRoute(requireAdmin),asyncRoute(async(req,res)=>{
  const id=validObjectId(req.params.id);if(!id)return res.status(400).json({error:'Invalid license ID'});
  const input=parse(z.object({expiresAt:z.string().datetime({offset:true})}).strict(),req.body,res);if(!input)return;
  const newExpiry=new Date(input.expiresAt);if(newExpiry<=new Date())return res.status(400).json({error:'New expiry must be in the future.'});
  const database=await db();const result=await database.collection('licenses').findOneAndUpdate({_id:id,status:{$ne:'revoked'},plan:{$ne:'lifetime'}},{$set:{expiresAt:newExpiry}},{returnDocument:'after'});
  if(!result)return res.status(409).json({error:'License not found, revoked, or lifetime.'});
  await audit(database,req.admin._id,'license.renewed',id.toString(),{expiresAt:newExpiry.toISOString()});res.json({license:serializeLicense(result)});
}));
app.get('/api/audit',asyncRoute(requireAdmin),asyncRoute(async(req,res)=>{
 const database=await db();const rows=await database.collection('audit_logs').find({}).sort({createdAt:-1}).limit(80).toArray();
 res.json({items:rows.map(r=>({id:r._id.toString(),action:r.action,targetId:r.targetId,createdAt:r.createdAt,details:r.details}))});
}));
// Deliberately no public device activation endpoint until device-key proof, one-time consumption,
// atomic activation limits and signed offline entitlements are implemented and tested.
app.use('/api',(req,res)=>res.status(404).json({error:'Unknown API endpoint'}));
const root=path.dirname(fileURLToPath(import.meta.url));const dist=path.resolve(root,'../client/dist');
app.use(express.static(dist,{index:false,maxAge:'1h',immutable:false}));
app.get('*',(req,res)=>res.sendFile(path.join(dist,'index.html')));
app.use((err,req,res,next)=>{console.error('Request error:',err?.message);if(res.headersSent)return next(err);res.status(500).json({error:'Server error. Please try again.'});});
const port=Number(process.env.PORT)||10000;
try { signingKey(); await prepareDeviceLicenseIndexes(await db());app.listen(port,'0.0.0.0',()=>console.log(`Piso Tabs License Portal listening on port ${port}`)); }
catch(error){ console.error('Startup failed:',error.message);process.exit(1); }
