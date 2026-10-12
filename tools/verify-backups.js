'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');

// Keep this default in sync with tools/backup-postgres.js.
const dir=path.resolve(process.env.ACADEMY_BACKUP_DIR||path.join(__dirname,'..','data','backups'));
let ok=0,fail=0;
if(!fs.existsSync(dir)){
  console.error('Backup directory does not exist:',dir);
  process.exit(1);
}
const manifests=fs.readdirSync(dir).filter(x=>x.endsWith('.sha256'));
if(!manifests.length){
  console.error('No .sha256 backup manifests found in:',dir);
  process.exit(1);
}
for(const manifest of manifests){
  try{
    const raw=fs.readFileSync(path.join(dir,manifest),'utf8').trim();
    let expected,file;
    // Support the JSON manifest format used by older backup tooling.
    if(raw.startsWith('{')){
      const parsed=JSON.parse(raw);
      expected=parsed.sha256;
      file=parsed.file;
    }else{
      // Format emitted by tools/backup-postgres.js: "<sha256>  <filename>"
      const match=raw.match(/^([a-f0-9]{64})\s+(.+)$/i);
      if(!match)throw new Error('Unrecognized SHA-256 manifest format');
      expected=match[1].toLowerCase();
      file=match[2].trim();
    }
    if(!file||path.basename(file)!==file)throw new Error('Invalid backup filename in manifest');
    const fp=path.join(dir,file);
    if(!fs.existsSync(fp))throw new Error('Backup file is missing');
    const actual=crypto.createHash('sha256').update(fs.readFileSync(fp)).digest('hex');
    if(actual!==String(expected).toLowerCase())throw new Error('SHA-256 mismatch');
    ok++;
    console.log('OK',file);
  }catch(e){
    fail++;
    console.error('FAIL',manifest,e.message);
  }
}
console.log(`Backup verification: ${ok} ok, ${fail} failed`);
if(fail||ok===0)process.exit(1);
