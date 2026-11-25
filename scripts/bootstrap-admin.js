import { db, closeDb } from '../server/db.js';
import { hashPassword } from '../server/security.js';
const email=process.env.BOOTSTRAP_EMAIL?.trim().toLowerCase();
const password=process.env.BOOTSTRAP_PASSWORD;
if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length<16 || password.length>256){
 console.error('Set BOOTSTRAP_EMAIL and BOOTSTRAP_PASSWORD (minimum 16 characters) before running.');process.exit(1);
}
try{
 const database=await db();
 if(await database.collection('admins').countDocuments({})>0){console.error('Bootstrap blocked: an admin already exists.');process.exitCode=1;}
 else { await database.collection('admins').insertOne({email,role:'owner',passwordHash:await hashPassword(password),createdAt:new Date(),disabled:false});console.log('Owner administrator created. Remove BOOTSTRAP_PASSWORD from your environment.'); }
}catch(e){ console.error('Bootstrap error:',e.message);process.exitCode=1; }
finally{await closeDb();}
