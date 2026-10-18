'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const CORE_COLLECTIONS = ['users','groups','students','attendance','grades','tests','teacher_notes','reports','memorization','goals','subjects','lessons','schedule','posts','post_reads','notifications','lesson_progress','audit_log','quran_sessions','quran_evaluations','quran_levels','assignments','assignment_submissions','calendar_events','messages','group_join_requests','optional_enrollments','student_tasks','media_posts','media_reads','media_reactions','media_comments','quran_halaqas','quran_plans','quran_reviews','quran_attendance','quran_certificates','academic_years','terms','journey_items','student_journey','student_diagnostics','challenges','challenge_participants','anonymous_feedback','exam_excuses','teacher_profiles','donation_intents','learning_plans','quran_submissions','question_bank','question_attempts','discussions','discussion_replies','media_bookmarks','security_events','privacy_requests','app_metrics','teams','team_members','team_tasks','team_supervisors','quran_schools','schools','school_staff','attendance_weekly','transport_routes','transport_assignments'];
function ensureCoreCollections(out) { for (const key of CORE_COLLECTIONS) if (!Array.isArray(out[key])) out[key] = []; return out; }
class PostgresStorageAdapter {
  constructor(connectionString) { this.kind='postgres'; this.connectionString=connectionString; this.pool=null; this.lastWriteAt=null; this.schemaVersion=1; this.writeQueue=Promise.resolve(); }
  async _pool(){ if(this.pool)return this.pool; let pg; try{pg=require('pg')}catch{throw new Error('PostgreSQL يحتاج حزمة pg: npm install')}; this.pool=new pg.Pool({connectionString:this.connectionString,max:Number(process.env.ACADEMY_PG_POOL_MAX||10),idleTimeoutMillis:30000,connectionTimeoutMillis:Number(process.env.ACADEMY_PG_CONNECT_TIMEOUT_MS||10000),ssl:process.env.ACADEMY_PG_SSL==='1'?{rejectUnauthorized:process.env.ACADEMY_PG_SSL_VERIFY!=='0'}:undefined}); return this.pool; }
  async migrate(){const pool=await this._pool(); await pool.query('CREATE TABLE IF NOT EXISTS academy_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())'); const dir=path.join(__dirname,'..','..','migrations'); const files=fs.existsSync(dir)?fs.readdirSync(dir).filter(f=>/^\d+_.+\.sql$/.test(f)).sort():[]; for(const file of files){const version=Number(file.match(/^\d+/)[0]); const done=await pool.query('SELECT 1 FROM academy_migrations WHERE version=$1',[version]); if(done.rowCount)continue; const sql=fs.readFileSync(path.join(dir,file),'utf8'); const c=await pool.connect(); try{await c.query('BEGIN');await c.query(sql);await c.query('INSERT INTO academy_migrations(version,name) VALUES($1,$2)',[version,file]);await c.query('COMMIT')}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}} await pool.query(`INSERT INTO academy_meta(key,data) VALUES('schema_version',$1::jsonb) ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data`,[JSON.stringify(this.schemaVersion)]);}
  async load(){await this.migrate();const pool=await this._pool(),out={};for(const r of (await pool.query('SELECT collection,id,data FROM academy_records ORDER BY collection,id')).rows)(out[r.collection]??=[]).push(r.data);for(const r of (await pool.query('SELECT key,data FROM academy_meta')).rows)if(r.key!=='schema_version')out[r.key]=r.data;ensureCoreCollections(out);return out;}
  async _save(db){
    await this.migrate();
    const pool=await this._pool(),client=await pool.connect();
    try{
      await client.query('BEGIN');
      await client.query('CREATE TEMP TABLE academy_records_snapshot (collection TEXT NOT NULL,id TEXT NOT NULL,data JSONB NOT NULL,PRIMARY KEY(collection,id)) ON COMMIT DROP');
      await client.query('CREATE TEMP TABLE academy_meta_snapshot (key TEXT PRIMARY KEY,data JSONB NOT NULL) ON COMMIT DROP');
      const records=[],meta=[];
      for(const [collection,rows] of Object.entries(db)){
        if(Array.isArray(rows)){
          for(const row of rows){
            const id=row?.id!=null?String(row.id):crypto.createHash('sha256').update(JSON.stringify(row)).digest('hex').slice(0,32);
            records.push([collection,id,JSON.stringify(row)]);
          }
        }else meta.push([collection,JSON.stringify(rows)]);
      }
      meta.push(['schema_version',JSON.stringify(this.schemaVersion)]);
      const insertBatches=async(table,columns,rows)=>{
        const batchSize=50;
        for(let i=0;i<rows.length;i+=batchSize){
          const batch=rows.slice(i,i+batchSize),values=[],params=[];
          for(const row of batch){
            const marks=row.map((_,j)=>'$'+(params.length+j+1)+(j===row.length-1?'::jsonb':''));
            values.push('('+marks.join(',')+')');
            params.push(...row);
          }
          await client.query('INSERT INTO '+table+' ('+columns.join(',')+') VALUES '+values.join(','),params);
        }
      };
      await insertBatches('academy_records_snapshot',['collection','id','data'],records);
      await insertBatches('academy_meta_snapshot',['key','data'],meta);
      await client.query('DELETE FROM academy_records target WHERE NOT EXISTS (SELECT 1 FROM academy_records_snapshot snap WHERE snap.collection=target.collection AND snap.id=target.id)');
      await client.query('INSERT INTO academy_records(collection,id,data) SELECT collection,id,data FROM academy_records_snapshot ON CONFLICT(collection,id) DO UPDATE SET data=EXCLUDED.data WHERE academy_records.data IS DISTINCT FROM EXCLUDED.data');
      await client.query('DELETE FROM academy_meta target WHERE NOT EXISTS (SELECT 1 FROM academy_meta_snapshot snap WHERE snap.key=target.key)');
      await client.query('INSERT INTO academy_meta(key,data) SELECT key,data FROM academy_meta_snapshot ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data WHERE academy_meta.data IS DISTINCT FROM EXCLUDED.data');
      await client.query('COMMIT');
      this.lastWriteAt=new Date().toISOString();
    }catch(e){try{await client.query('ROLLBACK')}catch{}throw e}
    finally{client.release()}
  }
  save(db){
    const next=this.writeQueue.catch(()=>{}).then(()=>this._save(db));
    this.writeQueue=next;
    return next;
  }
  async health(){try{await this.migrate();const pool=await this._pool(),r=await pool.query('SELECT current_database() AS database,current_schema() AS schema');return{healthy:true,kind:this.kind,database:r.rows[0].database,schema:r.rows[0].schema,last_write_at:this.lastWriteAt}}catch(e){return{healthy:false,kind:this.kind,error:e.message}}}
  async close(){if(this.pool)await this.pool.end();this.pool=null;}
}
module.exports={PostgresStorageAdapter,ensureCoreCollections};
