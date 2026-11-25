import { generateKeyPairSync } from 'node:crypto';
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
console.log('PRIVATE KEY (Render/server env ONLY):');
console.log('LICENSE_SIGNING_PRIVATE_KEY_B64='+privateKey.export({format:'der',type:'pkcs8'}).toString('base64'));
console.log('\nPUBLIC KEY (paste into Android LicenseConfig.kt):');
console.log(publicKey.export({format:'der',type:'spki'}).toString('base64'));
console.log('\nSave private key in your secrets vault. Never commit it to git or send it to the tablet.');
