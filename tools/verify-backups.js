'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const dir=path.resolve(process.env.ACADEMY_BACKUP_DIR||path.join(__dirname,'..','backups'));
let ok=0,fail=0;
if(!fs.existsSync(dir)){console.log('No backup directory:',dir);process.exit(0)}
for(const f of fs.readdirSync(dir).filter(x=>x.endsWith('.sha256'))){try{const m=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));const fp=path.join(dir,m.file);const h=crypto.createHash('sha256').update(fs.readFileSync(fp)).digest('hex');if(h!==m.sha256)throw new Error('SHA-256 mismatch');ok++;console.log('OK',m.file)}catch(e){fail++;console.error('FAIL',f,e.message)}}
console.log(`Backup verification: ${ok} ok, ${fail} failed`);process.exit(fail?1:0);
