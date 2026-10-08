'use strict';
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process'),crypto=require('crypto');
const ROOT=path.join(__dirname,'..');
const OUT=path.resolve(process.env.ACADEMY_BACKUP_DIR||path.join(ROOT,'backups'));
const HOURS=Math.max(1,Number(process.env.ACADEMY_BACKUP_INTERVAL_HOURS)||24);
const KEEP=Math.max(1,Number(process.env.ACADEMY_BACKUP_KEEP)||14);
function stamp(){return new Date().toISOString().replace(/[:.]/g,'-')}
function sha(p){return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}
function run(){fs.mkdirSync(OUT,{recursive:true});const mode=process.env.ACADEMY_STORAGE||'json', base=stamp(); let out;
 if(mode==='postgres'){out=path.join(OUT,`postgres-${base}.dump`);const r=spawnSync('pg_dump',[process.env.DATABASE_URL||process.env.ACADEMY_POSTGRES_URL||'', '--format=custom','--file',out],{stdio:'inherit'});if(r.status!==0){try{fs.rmSync(out,{force:true})}catch{};throw new Error('فشل pg_dump')}}
 else if(mode==='sqlite'){const src=path.resolve(process.env.ACADEMY_SQLITE_FILE||path.join(ROOT,'data','academy-v30.sqlite'));out=path.join(OUT,`sqlite-${base}.db`);fs.copyFileSync(src,out)}
 else {const src=path.resolve(process.env.ACADEMY_DB_FILE||path.join(ROOT,'data','db.json'));out=path.join(OUT,`json-${base}.json`);fs.copyFileSync(src,out)}
 const manifest={file:path.basename(out),sha256:sha(out),bytes:fs.statSync(out).size,created_at:new Date().toISOString(),mode};fs.writeFileSync(out+'.sha256',JSON.stringify(manifest,null,2));
 const files=fs.readdirSync(OUT).filter(x=>/^(postgres|sqlite|json)-/.test(x)&&!x.endsWith('.sha256')).sort().reverse();files.slice(KEEP).forEach(f=>{fs.rmSync(path.join(OUT,f),{force:true});fs.rmSync(path.join(OUT,f+'.sha256'),{force:true})});console.log('Backup created:',manifest.file,manifest.sha256);}
run();
if(process.env.ACADEMY_BACKUP_DAEMON==='1'){setInterval(()=>{try{run()}catch(e){console.error(e.message)}},HOURS*3600000);console.log(`Backup daemon enabled: every ${HOURS}h, keep ${KEEP}.`);}
