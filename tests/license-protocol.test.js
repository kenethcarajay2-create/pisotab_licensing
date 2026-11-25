import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createVerify, createSign, createHash, sign, verify } from 'node:crypto';

test('device proof uses P-256 and binds challenge to the device fingerprint', () => {
  const {publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const deviceId=createHash('sha256').update(publicKey.export({format:'der',type:'spki'})).digest('hex');
  const message=`PISO-TABS-LICENSE-V1\nabcdef012345abcdef012345\nunique-nonce\n${deviceId}`;
  const signer=createSign('SHA256');signer.update(message);signer.end();
  const signature=signer.sign(privateKey);
  const verifier=createVerify('SHA256');verifier.update(message);verifier.end();
  assert.equal(verifier.verify(publicKey,signature),true);
  const wrong=createVerify('SHA256');wrong.update(message+'other-device');wrong.end();
  assert.equal(wrong.verify(publicKey,signature),false);
});
test('server Ed25519 token signature is checked against the public key', () => {
  const {publicKey,privateKey}=generateKeyPairSync('ed25519');
  const data=Buffer.from(JSON.stringify({iss:'piso-tabs-license-api',v:1,licenseId:'a'.repeat(24)})).toString('base64url');
  const signature=sign(null,Buffer.from(data,'ascii'),privateKey);
  assert.equal(verify(null,Buffer.from(data,'ascii'),publicKey,signature),true);
  assert.equal(verify(null,Buffer.from(data+'x','ascii'),publicKey,signature),false);
});
