'use strict';
const fs=require('fs'), path=require('path'), crypto=require('crypto');
const {JsonStorageAdapter,SqliteStorageAdapter}=require('../server/storage');
const root=path.join(__dirname,'..');
const source=path.resolve(process.argv[2]||process.env.ACADEMY_DB_FILE||path.join(root,'data','db.json'));
const target=path.resolve(process.argv[3]||process.env.ACADEMY_SQLITE_FILE||path.join(root,'data','academy-v30.sqlite'));
const backup=target+'.pre-migration-'+Date.now()+'.sqlite';
const jsonStore=new JsonStorageAdapter(source); const db=jsonStore.load();
const hadTarget=fs.existsSync(target); if(hadTarget) fs.copyFileSync(target,backup);
const store=new SqliteStorageAdapter(target);
try {
  store.save(db);
  const loaded=store.load();
  const names=[...new Set([...Object.keys(db),...Object.keys(loaded)])];
  const mismatches=[];
  for(const k of names){
    if(JSON.stringify(db[k])!==JSON.stringify(loaded[k])) mismatches.push(k);
  }
  if(mismatches.length){ if(hadTarget) fs.copyFileSync(backup,target); else fs.rmSync(target,{force:true}); throw new Error('فشل التحقق من الهجرة: '+mismatches.join(', ')); }
  const manifest={version:30,source:path.relative(root,source),target:path.relative(root,target),source_sha256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),tables:Object.keys(db).filter(k=>Array.isArray(db[k])).length,rows:Object.values(db).filter(Array.isArray).reduce((n,a)=>n+a.length,0),created_at:new Date().toISOString(),reversible:true};
  fs.writeFileSync(target+'.manifest.json',JSON.stringify(manifest,null,2));
  if(fs.existsSync(backup)) fs.rmSync(backup,{force:true});
  console.log(JSON.stringify({...manifest,health:store.health()},null,2));
} catch(e){ if(fs.existsSync(backup)&&hadTarget) fs.copyFileSync(backup,target); if(fs.existsSync(backup)) fs.rmSync(backup,{force:true}); console.error(e.message); process.exit(1); }
