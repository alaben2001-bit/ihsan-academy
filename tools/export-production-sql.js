'use strict';
const fs=require('fs'), path=require('path'), crypto=require('crypto');
const root=path.join(__dirname,'..');
const src=process.env.ACADEMY_DB_FILE?path.resolve(process.env.ACADEMY_DB_FILE):path.join(root,'data','db.json');
const out=path.resolve(process.argv[2]||path.join(root,'data','academy-v29-migration.sql'));
const db=JSON.parse(fs.readFileSync(src,'utf8'));
const q=s=>`'${String(s??'').replace(/'/g,"''")}'`;
const json=o=>q(JSON.stringify(o));
const tables=[];
for(const [name,value] of Object.entries(db)) if(Array.isArray(value)) tables.push(name);
let sql=`-- أكاديمية الإحسان — V29 JSON-compatible production migration\n-- Generated: ${new Date().toISOString()}\n-- Source SHA-256: ${crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex')}\n\nPRAGMA foreign_keys = ON;\n\n`;
for(const name of tables){
  sql+=`CREATE TABLE IF NOT EXISTS ${name.replace(/[^a-zA-Z0-9_]/g,'_')} (id TEXT PRIMARY KEY, data TEXT NOT NULL);\n`;
}
sql+='\nBEGIN TRANSACTION;\n';
for(const name of tables){ const safe=name.replace(/[^a-zA-Z0-9_]/g,'_'); for(const row of db[name]){ const id=row&&row.id?String(row.id):crypto.createHash('sha256').update(JSON.stringify(row)).digest('hex').slice(0,24); sql+=`INSERT OR REPLACE INTO ${safe}(id,data) VALUES (${q(id)},${json(row)});\n`; } }
sql+='COMMIT;\n';
fs.mkdirSync(path.dirname(out),{recursive:true}); fs.writeFileSync(out,sql,'utf8');
console.log(JSON.stringify({output:out,tables:tables.length,rows:tables.reduce((n,k)=>n+db[k].length,0)},null,2));
