'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mimeMap = {'.pdf':'application/pdf','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4','.webm':'video/webm','.mp3':'audio/mpeg','.m4a':'audio/mp4','.wav':'audio/wav','.ogg':'audio/ogg','.txt':'text/plain'};
const quranSubmissionStatuses = ['pending','reviewed','needs_repeat'];
const questionTypes = ['single_choice','multiple_choice','true_false','short_answer'];
const discussionStatuses = ['open','closed'];

function now(){ return new Date().toISOString(); }
function ensure(db, key){ if(!Array.isArray(db[key])) db[key]=[]; return db[key]; }
function safeName(name){ return String(name||'file.bin').slice(0,140).replace(/[^\w\-.\u0600-\u06ff ]/g,'_'); }
function bytesFromData(data){ const raw=String(data||'').split(',').pop(); return {raw, bytes:Buffer.from(raw,'base64')}; }
function writeUpload(root, fileData, fileName, mime, opts={}){
  const {bytes}=bytesFromData(fileData); const max=opts.maxBytes||12*1024*1024;
  if(!bytes.length) throw new Error('الملف فارغ');
  if(bytes.length>max) { const e=new Error('الملف أكبر من الحد المسموح'); e.status=413; throw e; }
  const name=safeName(fileName||'file.bin');
  const dir=path.resolve(opts.root || path.join(root,'data','uploads'));
  fs.mkdirSync(dir,{recursive:true});
  const id='up_'+crypto.randomBytes(12).toString('hex');
  const filePath=path.join(dir,id+'_'+name);
  const tmp=filePath+'.tmp'; fs.writeFileSync(tmp,bytes,{flag:'wx'}); fs.renameSync(tmp,filePath);
  return {filePath,fileName:name,mime:String(mime||'application/octet-stream').slice(0,120),size_bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),storage_key:path.relative(dir,filePath)};
}
function visibleStudentIds(user, scopedStudents){ return new Set((scopedStudents(user)||[]).map(s=>s.id)); }
function getSubmissionScope(user, db, scopedStudents){
  if(user.role==='admin') return null;
  return visibleStudentIds(user, scopedStudents);
}
function studentAllowed(user, student, canView){ return !!student && (user.role==='admin' || canView(user,student)); }
function discussionVisible(user, d, visibleGroupIds){ return !!d && (user.role==='admin' || !d.group_id || visibleGroupIds(user).includes(d.group_id)); }
function questionVisible(user,q,visibleGroupIds){ return !!q && q.active!==false && (user.role==='admin' || !q.group_id || visibleGroupIds(user).includes(q.group_id)); }
function autoGrade(question, answer){
  if(question.type==='true_false') return String(answer).toLowerCase()===String(question.correct_answer).toLowerCase();
  if(question.type==='single_choice') return String(answer||'')===String(question.correct_answer||'');
  if(question.type==='multiple_choice'){
    const a=Array.isArray(answer)?answer.map(String).sort():[]; const c=Array.isArray(question.correct_answer)?question.correct_answer.map(String).sort():[]; return JSON.stringify(a)===JSON.stringify(c);
  }
  return null;
}
function sanitizeQuestion(q){
  const out={id:q.id,title:q.title,type:q.type,points:q.points,options:q.options||[],subject_id:q.subject_id||null,group_id:q.group_id||null,active:q.active!==false,explanation:q.explanation||''};
  return out;
}

async function handleAdvanced(ctx){
  const {req,res,p,user,db,fail,json,body,uid,clean,isDate,isStaff,canView,canEdit,scopedStudents,studentForUser,studentGroupIds,visibleGroupIds,ownsGroup,audit,save,ROOT}=ctx;
  ensure(db,'quran_submissions'); ensure(db,'question_bank'); ensure(db,'question_attempts'); ensure(db,'discussions'); ensure(db,'discussion_replies'); ensure(db,'media_bookmarks'); ensure(db,'security_events'); ensure(db,'privacy_requests'); ensure(db,'app_metrics');
  const MEDIA_ROOT=path.resolve(process.env.ACADEMY_MEDIA_ROOT || path.join(ROOT,'data','uploads'));

  // V44 — تسليمات التلاوة
  if(p==='/api/quran/submissions' && req.method==='GET'){
    const scope=getSubmissionScope(user,db,scopedStudents);
    let list=db.quran_submissions;
    if(scope) list=list.filter(x=>scope.has(x.student_id));
    list=list.slice().sort((a,b)=>String(b.submitted_at).localeCompare(String(a.submitted_at)));
    return json(res,200,list.map(x=>({...x,student_name:(db.students.find(s=>s.id===x.student_id)||{}).name||''})));
  }
  if(p==='/api/quran/submissions' && req.method==='POST'){
    if(user.role!=='student') fail(403,'تسليم التلاوة متاح للطالب من حسابه');
    const s=studentForUser(user); if(!s) fail(404,'ملف الطالب غير موجود');
    const b=await body(req); const surah=clean(b.surah,120); const from=Number(b.from_ayah), to=Number(b.to_ayah);
    if(!surah||!Number.isInteger(from)||!Number.isInteger(to)||from<1||to<from||to-from>300) fail(400,'بيانات المقطع غير صحيحة');
    let file={};
    if(b.file_data){
      if(!String(b.mime||'').startsWith('audio/')) fail(400,'ملف التسميع يجب أن يكون صوتيًا');
      try { file=writeUpload(ROOT,b.file_data,b.file_name,b.mime,{root:MEDIA_ROOT,maxBytes:10*1024*1024}); } catch(e) { if(e.status) fail(e.status,e.message); throw e; }
    } else if(b.url){
      try{ const u=new URL(String(b.url)); if(!['http:','https:'].includes(u.protocol)) fail(400,'الرابط غير مسموح'); file.url=u.href; }catch{fail(400,'رابط التسجيل غير صالح');}
    } else fail(400,'أرفق تسجيلًا صوتيًا');
    const row={id:uid('qs'),student_id:s.id,surah,from_ayah:from,to_ayah:to,notes:clean(b.notes,1000),duration_seconds:Math.max(0,Math.min(7200,Number(b.duration_seconds)||0)),status:'pending',submitted_at:now(),reviewed_at:null,reviewed_by:null,score:null,teacher_note:'',file_path:file.filePath||'',file_name:file.fileName||'',mime:file.mime||'',size_bytes:file.size_bytes||0,sha256:file.sha256||'',url:file.url||''};
    db.quran_submissions.unshift(row); db.notifications.unshift({id:uid('n'),title:'تسميع جديد بانتظار المراجعة',body:`${s.name} أرسل تسميع ${surah} (${from}–${to}).`,group_id:studentGroupIds(s)[0]||null,created_at:row.submitted_at,read_by:[]}); audit(user,'quran_submission_create',{id:row.id}); await save(); return json(res,201,{...row,student_name:s.name});
  }
  const m= p.match(/^\/api\/quran\/submissions\/([^/]+)\/review$/);
  if(m && req.method==='POST'){
    if(!isStaff(user)) fail(403,'مراجعة التسميع للشيخ والإدارة');
    const row=db.quran_submissions.find(x=>x.id===decodeURIComponent(m[1])); if(!row) fail(404,'التسميع غير موجود');
    const s=db.students.find(x=>x.id===row.student_id); if(!s||!canEdit(user,s)) fail(403,'التسميع خارج نطاقك');
    const b=await body(req); if(!quranSubmissionStatuses.includes(b.status)) fail(400,'حالة المراجعة غير صحيحة');
    const score=b.score===''||b.score==null?null:Number(b.score); if(score!=null&&(!Number.isFinite(score)||score<0||score>100)) fail(400,'الدرجة يجب أن تكون بين 0 و100');
    row.status=b.status; row.score=score==null?null:Math.round(score); row.teacher_note=clean(b.teacher_note,1600); row.reviewed_by=user.id; row.reviewed_at=now();
    db.notifications.unshift({id:uid('n'),title:b.status==='needs_repeat'?'التسميع يحتاج إعادة':'تمت مراجعة التسميع',body:b.status==='needs_repeat'?'راجع الملاحظة وأعد التسجيل عند الاستطاعة.':'تمت مراجعة تسميعك من الشيخ.',user_id:s.user_id,created_at:row.reviewed_at,read_by:[]}); audit(user,'quran_submission_review',{id:row.id,status:row.status}); await save(); return json(res,200,row);
  }
  const mf=p.match(/^\/api\/quran\/submissions\/([^/]+)\/file$/);
  if(mf && req.method==='GET'){
    const row=db.quran_submissions.find(x=>x.id===decodeURIComponent(mf[1])); if(!row) fail(404,'الملف غير موجود');
    const s=db.students.find(x=>x.id===row.student_id); if(!s || !studentAllowed(user,s,canView)) fail(404,'الملف غير موجود');
    if(!row.file_path||!fs.existsSync(row.file_path)) fail(404,'ملف التسجيل غير موجود');
    const fp=path.resolve(row.file_path); if(!fp.startsWith(MEDIA_ROOT+path.sep)) fail(404,'الملف غير موجود');
    const stat=fs.statSync(fp), range=req.headers.range; const headers={'Accept-Ranges':'bytes','Content-Type':row.mime||'audio/mpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
    if(range){const mm=/bytes=(\d*)-(\d*)/.exec(range); if(mm){let start=mm[1]?Number(mm[1]):0; let end=mm[2]?Number(mm[2]):stat.size-1; if(!mm[1]&&mm[2])start=Math.max(0,stat.size-Number(mm[2])); end=Math.min(end,stat.size-1); if(start<=end){headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;headers['Content-Length']=end-start+1;res.writeHead(206,headers);return fs.createReadStream(fp,{start,end}).pipe(res);}}}
    headers['Content-Length']=stat.size; res.writeHead(200,headers); return fs.createReadStream(fp).pipe(res);
  }

  // V45 — بنك الأسئلة والاختبارات الإلكترونية
  if(p==='/api/question-bank' && req.method==='GET'){
    const subject=ctx.q?.subject_id || new URL(req.url,'http://localhost').searchParams.get('subject_id');
    let list=db.question_bank.filter(q=>questionVisible(user,q,visibleGroupIds)); if(subject) list=list.filter(q=>q.subject_id===subject);
    return json(res,200,list.map(sanitizeQuestion));
  }
  if(p==='/api/question-bank' && req.method==='POST'){
    if(!isStaff(user)) fail(403,'بنك الأسئلة للشيخ والإدارة'); const b=await body(req); if(!clean(b.title,400)) fail(400,'صياغة السؤال مطلوبة');
    const type=String(b.type||'single_choice'); if(!questionTypes.includes(type)) fail(400,'نوع السؤال غير صحيح'); const points=Math.max(1,Math.min(100,Number(b.points)||1));
    const options=Array.isArray(b.options)?b.options.map(x=>clean(x,240)).filter(Boolean).slice(0,8):[];
    if(['single_choice','multiple_choice'].includes(type)&&options.length<2) fail(400,'أضف خيارين على الأقل');
    const correct=type==='multiple_choice'?(Array.isArray(b.correct_answer)?b.correct_answer.map(String):[]):clean(b.correct_answer,240);
    if(type==='true_false'&&!['true','false','صحيح','خطأ'].includes(correct)) fail(400,'إجابة الصواب والخطأ غير صحيحة');
    if((type==='single_choice'||type==='multiple_choice') && (Array.isArray(correct)?correct.length<1:!options.includes(correct))) fail(400,'الإجابة الصحيحة غير موجودة ضمن الخيارات');
    const gid=b.group_id||null; if(gid&&!ownsGroup(user,gid)) fail(403,'الفوج خارج نطاقك');
    const row={id:uid('qb'),title:clean(b.title,400),type,points,options,correct_answer:correct,explanation:clean(b.explanation,1200),subject_id:b.subject_id||null,group_id:gid,active:b.active!==false,created_by:user.id,created_at:now()}; db.question_bank.push(row); audit(user,'question_create',{id:row.id}); await save(); return json(res,201,sanitizeQuestion(row));
  }
  const qm=p.match(/^\/api\/question-bank\/([^/]+)$/);
  if(qm && req.method==='PATCH'){
    if(!isStaff(user)) fail(403,'تعديل بنك الأسئلة للشيخ والإدارة');
    const q=db.question_bank.find(x=>x.id===decodeURIComponent(qm[1]));
    if(!q) fail(404,'السؤال غير موجود');
    // Teachers may edit only questions they created, and only within groups they manage.
    if(user.role!=='admin' && (q.created_by!==user.id || (q.group_id && !ownsGroup(user,q.group_id)))) fail(403,'لا تملك صلاحية تعديل هذا السؤال');
    const b=await body(req);
    const nextType=b.type!==undefined?String(b.type):q.type;
    if(!questionTypes.includes(nextType)) fail(400,'نوع السؤال غير صحيح');
    const nextOptions=b.options!==undefined?(Array.isArray(b.options)?b.options.map(x=>clean(x,240)).filter(Boolean).slice(0,8):[]):(q.options||[]);
    const nextCorrect=b.correct_answer!==undefined?(nextType==='multiple_choice'?(Array.isArray(b.correct_answer)?b.correct_answer.map(String):[]):clean(b.correct_answer,240)):q.correct_answer;
    if(['single_choice','multiple_choice'].includes(nextType) && nextOptions.length<2) fail(400,'أضف خيارين على الأقل');
    if(nextType==='true_false'&&!['true','false','صحيح','خطأ'].includes(nextCorrect)) fail(400,'إجابة الصواب والخطأ غير صحيحة');
    if((nextType==='single_choice'||nextType==='multiple_choice') && (Array.isArray(nextCorrect)?nextCorrect.length<1||nextCorrect.some(x=>!nextOptions.includes(x)):!nextOptions.includes(nextCorrect))) fail(400,'الإجابة الصحيحة غير موجودة ضمن الخيارات');
    if(b.subject_id!==undefined && b.subject_id && !db.subjects.some(x=>x.id===b.subject_id)) fail(400,'المادة غير موجودة');
    const nextGroup=b.group_id!==undefined?(b.group_id||null):q.group_id;
    if(nextGroup&&!ownsGroup(user,nextGroup)) fail(403,'الفوج خارج نطاقك');
    if(b.title!==undefined){if(!clean(b.title,400))fail(400,'صياغة السؤال مطلوبة');q.title=clean(b.title,400);}
    if(b.explanation!==undefined)q.explanation=clean(b.explanation,1200);
    if(b.points!==undefined){const pts=Number(b.points);if(!Number.isInteger(pts)||pts<1||pts>100)fail(400,'الدرجة يجب أن تكون بين 1 و100');q.points=pts;}
    if(b.type!==undefined||b.options!==undefined||b.correct_answer!==undefined){q.type=nextType;q.options=nextOptions;q.correct_answer=nextCorrect;}
    if(b.subject_id!==undefined)q.subject_id=b.subject_id||null;
    if(b.group_id!==undefined)q.group_id=nextGroup;
    if(b.active!==undefined)q.active=!!b.active;
    audit(user,'question_update',{id:q.id}); await save(); return json(res,200,sanitizeQuestion(q));
  }
  const qa=p.match(/^\/api\/question-bank\/([^/]+)\/attempt$/);
  if(qa && req.method==='POST'){
    if(user.role!=='student') fail(403,'حل الاختبار متاح للطالب'); const q=db.question_bank.find(x=>x.id===decodeURIComponent(qa[1])); if(!questionVisible(user,q,visibleGroupIds)) fail(404,'السؤال غير موجود'); const b=await body(req);
    const ans=b.answer; const auto=autoGrade(q,ans); const score=auto==null?null:(auto?q.points:0); const attempt={id:uid('qat'),question_id:q.id,student_id:studentForUser(user)?.id||null,answer:ans,correct:auto,score,max_score:q.points,status:auto==null?'pending_review':'graded',feedback:'',submitted_at:now(),reviewed_at:null,reviewed_by:null}; if(!attempt.student_id)fail(404,'ملف الطالب غير موجود'); db.question_attempts.unshift(attempt); audit(user,'question_attempt',{id:attempt.id,question_id:q.id}); await save(); return json(res,201,{...attempt,question:sanitizeQuestion(q)});
  }
  if(p==='/api/question-attempts' && req.method==='GET'){
    const scope=getSubmissionScope(user,db,scopedStudents); let list=db.question_attempts; if(scope)list=list.filter(x=>scope.has(x.student_id)); if(user.role==='student'){const s=studentForUser(user);list=list.filter(x=>x.student_id===s?.id);} return json(res,200,list.map(a=>({...a,question:sanitizeQuestion(db.question_bank.find(q=>q.id===a.question_id)||{}),student_name:(db.students.find(s=>s.id===a.student_id)||{}).name||''})));
  }
  const qar=p.match(/^\/api\/question-attempts\/([^/]+)\/review$/);
  if(qar&&req.method==='POST'){
    if(!isStaff(user))fail(403,'تصحيح الإجابات للشيخ والإدارة'); const a=db.question_attempts.find(x=>x.id===decodeURIComponent(qar[1])); if(!a)fail(404,'المحاولة غير موجودة'); const s=db.students.find(x=>x.id===a.student_id); if(!s||!canEdit(user,s))fail(403,'المحاولة خارج نطاقك'); const b=await body(req); const score=Number(b.score); const q=db.question_bank.find(x=>x.id===a.question_id); if(!q||!Number.isFinite(score)||score<0||score>q.points)fail(400,'الدرجة غير صحيحة'); a.score=score;a.max_score=q.points;a.feedback=clean(b.feedback,1200);a.status='graded';a.reviewed_by=user.id;a.reviewed_at=now();audit(user,'question_attempt_review',{id:a.id});await save();return json(res,200,a);
  }

  // V46 — مجتمع التعلم والنقاشات
  if(p==='/api/discussions'&&req.method==='GET'){
    return json(res,200,db.discussions.filter(x=>discussionVisible(user,x,visibleGroupIds)).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,100).map(d=>({...d,author_name:(db.users.find(u=>u.id===d.author_id)||{}).name||'',replies_count:db.discussion_replies.filter(r=>r.discussion_id===d.id).length})));
  }
  if(p==='/api/discussions'&&req.method==='POST'){
    const b=await body(req), title=clean(b.title,180), content=clean(b.content,2500), gid=b.group_id||null; if(!title||!content)fail(400,'عنوان الموضوع ونصه مطلوبان'); if(gid&&user.role!=='admin'&&!visibleGroupIds(user).includes(gid))fail(403,'الفوج خارج نطاقك'); const row={id:uid('ds'),title,content,group_id:gid,author_id:user.id,status:'open',created_at:now()};db.discussions.unshift(row);audit(user,'discussion_create',{id:row.id});await save();return json(res,201,row);
  }
  const dr=p.match(/^\/api\/discussions\/([^/]+)\/replies$/);
  if(dr&&req.method==='GET'){
    const d=db.discussions.find(x=>x.id===decodeURIComponent(dr[1]));if(!discussionVisible(user,d,visibleGroupIds))fail(404,'الموضوع غير موجود');return json(res,200,db.discussion_replies.filter(x=>x.discussion_id===d.id).sort((a,b)=>a.created_at.localeCompare(b.created_at)).map(x=>({...x,author_name:(db.users.find(u=>u.id===x.author_id)||{}).name||''})));
  }
  if(dr&&req.method==='POST'){
    const d=db.discussions.find(x=>x.id===decodeURIComponent(dr[1]));if(!discussionVisible(user,d,visibleGroupIds))fail(404,'الموضوع غير موجود');if(d.status==='closed')fail(409,'الموضوع مغلق');const b=await body(req),content=clean(b.content,1800);if(!content)fail(400,'الرد فارغ');const row={id:uid('dr'),discussion_id:d.id,author_id:user.id,content,created_at:now()};db.discussion_replies.push(row);audit(user,'discussion_reply',{id:row.id,discussion_id:d.id});await save();return json(res,201,{...row,author_name:user.name});
  }
  const dclose=p.match(/^\/api\/discussions\/([^/]+)$/);
  if(dclose&&req.method==='PATCH'){
    const d=db.discussions.find(x=>x.id===decodeURIComponent(dclose[1])); if(!discussionVisible(user,d,visibleGroupIds))fail(404,'الموضوع غير موجود'); if(user.role!=='admin'&&d.author_id!==user.id&&!isStaff(user))fail(403,'إدارة الموضوع لصاحبه والشيخ والإدارة'); const b=await body(req); if(b.status!==undefined&&!discussionStatuses.includes(b.status))fail(400,'حالة الموضوع غير صحيحة'); if(b.status!==undefined)d.status=b.status; await save(); return json(res,200,d);
  }

  // V47 — الإعدادات والتفضيلات والخصوصية
  if(p==='/api/settings'&&req.method==='GET') return json(res,200,{font_scale:Number(user.font_scale)||1,high_contrast:!!user.high_contrast,reduced_motion:!!user.reduced_motion,theme:['emerald','sand','indigo','olive'].includes(user.theme)?user.theme:'emerald',language:'ar'});
  if(p==='/api/settings'&&req.method==='PATCH'){
    const b=await body(req); if(b.font_scale!==undefined){const n=Number(b.font_scale);if(![.9,1,1.1,1.2,1.3].includes(n))fail(400,'حجم الخط غير صالح');user.font_scale=n;} if(b.high_contrast!==undefined)user.high_contrast=!!b.high_contrast;if(b.reduced_motion!==undefined)user.reduced_motion=!!b.reduced_motion;if(b.theme!==undefined){if(!['emerald','sand','indigo','olive'].includes(b.theme))fail(400,'لون الواجهة غير صالح');user.theme=b.theme;}audit(user,'settings_update');await save();return json(res,200,{font_scale:user.font_scale||1,high_contrast:!!user.high_contrast,reduced_motion:!!user.reduced_motion,theme:user.theme||'emerald'});
  }
  if(p==='/api/privacy/request'&&req.method==='POST'){
    const b=await body(req),type=String(b.type||'access');if(!['access','correct','delete'].includes(type))fail(400,'نوع الطلب غير صحيح');const row={id:uid('pr'),user_id:user.id,type,details:clean(b.details,1500),status:'pending',created_at:now(),handled_at:null,handled_by:null};db.privacy_requests.unshift(row);audit(user,'privacy_request',{id:row.id,type});await save();return json(res,201,row);
  }
  if(p==='/api/admin/privacy-requests'&&req.method==='GET'){if(user.role!=='admin')fail(403,'الإدارة فقط');return json(res,200,db.privacy_requests.map(r=>({...r,user_name:(db.users.find(u=>u.id===r.user_id)||{}).name||''})));}
  const pr=p.match(/^\/api\/admin\/privacy-requests\/([^/]+)$/); if(pr&&req.method==='PATCH'){if(user.role!=='admin')fail(403,'الإدارة فقط');const r=db.privacy_requests.find(x=>x.id===decodeURIComponent(pr[1]));if(!r)fail(404,'الطلب غير موجود');const b=await body(req);if(!['pending','processing','done','rejected'].includes(b.status))fail(400,'حالة الطلب غير صحيحة');r.status=b.status;r.handled_by=user.id;r.handled_at=now();await save();return json(res,200,r);}

  // V48 — إشارات التشغيل والملفات الإنتاجية
  if(p==='/api/admin/ops'&&req.method==='GET'){if(user.role!=='admin')fail(403,'الإدارة فقط');const mem=process.memoryUsage();return json(res,200,{uptime_seconds:Math.round(process.uptime()),node:process.version,storage:ctx.storageHealth?ctx.storageHealth():null,media_root:MEDIA_ROOT,media_root_exists:fs.existsSync(MEDIA_ROOT),memory_mb:{rss:Math.round(mem.rss/1048576),heap_used:Math.round(mem.heapUsed/1048576)},metrics:db.app_metrics.slice(-20)});}
  const mediaMark=p.match(/^\/api\/media\/([^/]+)\/bookmark$/); if(mediaMark&&req.method==='POST'){const id=decodeURIComponent(mediaMark[1]);const mrow=db.media_posts.find(x=>x.id===id);if(!discussionVisible(user,{group_id:mrow?.group_id},visibleGroupIds))fail(404,'المحتوى غير موجود');const i=db.media_bookmarks.findIndex(x=>x.media_id===id&&x.user_id===user.id);if(i>=0)db.media_bookmarks.splice(i,1);else db.media_bookmarks.push({id:uid('mb'),media_id:id,user_id:user.id,created_at:now()});await save();return json(res,200,{bookmarked:i<0});}
  if(p==='/api/media/bookmarks'&&req.method==='GET'){const ids=new Set(db.media_bookmarks.filter(x=>x.user_id===user.id).map(x=>x.media_id));return json(res,200,db.media_posts.filter(x=>ids.has(x.id)&&discussionVisible(user,x,visibleGroupIds)).map(x=>({...x,bookmarked:true})));}

  // V49 — مقاييس عامة وصحة تشغيلية
  if(p==='/api/ready'&&req.method==='GET'){const h=ctx.storageHealth?await Promise.resolve(ctx.storageHealth()):null;const ok=!!h?.healthy && !ctx.lastPersistenceError?.message;return json(res,ok?200:503,{ok,storage:h,version:'49'});}
  if(p==='/api/metrics'&&req.method==='GET'){
    if(user.role!=='admin')fail(403,'المقاييس للإدارة فقط');const mem=process.memoryUsage();return json(res,200,{requests:db.app_metrics.reduce((a,x)=>a+(x.count||0),0),recent:db.app_metrics.slice(-60),uptime_seconds:Math.round(process.uptime()),memory:{rss:mem.rss,heap_used:mem.heapUsed}});
  }
  return false;
}
module.exports={handleAdvanced,writeUpload,safeName};
