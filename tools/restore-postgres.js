'use strict';
const {spawnSync}=require('child_process'),fs=require('fs');
const url=process.env.DATABASE_URL||process.env.ACADEMY_POSTGRES_URL, source=process.argv[2], hashFile=source&&source+'.sha256';if(!url||!source)throw new Error('الاستخدام: DATABASE_URL=... node tools/restore-postgres.js backup.dump');if(!fs.existsSync(source))throw new Error('ملف النسخة غير موجود');
if(fs.existsSync(hashFile)){const crypto=require('crypto');const expected=fs.readFileSync(hashFile,'utf8').trim().split(/\s+/)[0];const actual=crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');if(expected!==actual)throw new Error('فشل التحقق من SHA-256 للنسخة الاحتياطية');}
const r=spawnSync(process.env.PG_RESTORE_BIN||'pg_restore',['--clean','--if-exists','--no-owner','--dbname',url,source],{stdio:'inherit'});if(r.status!==0)throw new Error('pg_restore فشل');console.log(JSON.stringify({restored:source},null,2));
