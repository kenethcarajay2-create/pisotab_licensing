import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, token, newLicenseKey, licenseMask, digest, serializeLicense } from '../server/security.js';
test('password hash is salted and only accepts correct password', async()=>{
 const a=await hashPassword('very long secure example password!');const b=await hashPassword('very long secure example password!');
 assert.notEqual(a,b);assert.equal(await verifyPassword('very long secure example password!',a),true);assert.equal(await verifyPassword('wrong password',a),false);
});
test('random keys have required shape and are not repeated',()=>{
 const a=newLicenseKey(),b=newLicenseKey();assert.match(a,/^PT-[A-HJ-NP-Z2-9]{6}(?:-[A-HJ-NP-Z2-9]{6}){3}$/);assert.notEqual(a,b);assert.ok(licenseMask(a).endsWith(a.slice(-6)));
});
test('hmac digest is bound to pepper and tokens vary',()=>{
 assert.notEqual(digest('aaa','hi'),digest('bbb','hi'));assert.notEqual(token(),token());
});
test('expired and revoked license status computed safely',()=>{
 const base={_id:{toString:()=> 'abc'},status:'issued',label:'Test',customer:'A',plan:'monthly',keyHint:'PT-xxxx',maxDevices:1,expiresAt:new Date('2020-01-01'),createdAt:new Date()};
 assert.equal(serializeLicense(base).status,'expired');assert.equal(serializeLicense({...base,status:'revoked'}).status,'revoked');
});
