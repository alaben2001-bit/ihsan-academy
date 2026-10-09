'use strict';
const assert = require('node:assert/strict');
const { seedEducationalContent, LESSONS, QUESTIONS, REFLECTION_QUESTIONS, SUBJECTS } = require('../server/educational-content');

function blankDb(){ return {subjects:[],lessons:[],question_bank:[],journey_items:[]}; }
const db=blankDb();
const first=seedEducationalContent(db);
assert.equal(first.changed,true);
assert.ok(SUBJECTS.length >= 14, 'curriculum should cover core and enrichment domains');
assert.equal(db.subjects.length,SUBJECTS.length);
assert.ok(LESSONS.length >= 26, 'curriculum must contain a meaningful starter course, not only placeholders');
assert.ok(SUBJECTS.some(s=>s.key==='seeking' && s.name==='طلب العلم والدعوة إلى الإسلام'), 'curriculum must include the seeking knowledge and dawah pathway');
assert.ok(SUBJECTS.some(s=>s.key==='allah' && s.name==='معرفة الله تعالى'), 'curriculum must include a dedicated knowledge of Allah path');
assert.ok(SUBJECTS.some(s=>s.key==='prophet' && s.name==='معرفة الرسول ﷺ'), 'curriculum must include a dedicated knowledge of the Prophet path');
assert.ok(SUBJECTS.some(s=>s.key==='nawawi40' && s.name==='الأربعون النووية: حفظ وفهم وعمل'), 'curriculum must include a Nawawi Forty path');
assert.ok(LESSONS.some(l=>l.key==='seeking-knowledge-map'), 'the knowledge map lesson must be seeded');
assert.ok(LESSONS.some(l=>l.key==='seeking-good-teaching'), 'good teaching lesson must be seeded');
assert.ok(LESSONS.some(l=>l.key==='seeking-good-character'), 'good character lesson must be seeded');
assert.ok(LESSONS.some(l=>l.key==='seeking-dawah-with-knowledge'), 'responsible dawah lesson must be seeded');
assert.ok(LESSONS.some(l=>l.key==='allah-ikhlas'), 'knowledge of Allah path must have a source-noted starter lesson');
assert.ok(LESSONS.some(l=>l.key==='prophet-mercy'), 'knowledge of the Prophet path must have a source-noted starter lesson');
assert.ok(LESSONS.some(l=>l.key==='nawawi-five-pillars'), 'Nawawi Forty path must have a source-noted starter lesson');
assert.ok(QUESTIONS.some(q=>q.key==='allah-ikhlas-1'), 'knowledge of Allah path must include practice');
assert.ok(QUESTIONS.some(q=>q.key==='prophet-mercy-1'), 'knowledge of the Prophet path must include practice');
assert.ok(QUESTIONS.some(q=>q.key==='nawawi-pillars-1'), 'Nawawi Forty path must include practice');
assert.ok(QUESTIONS.some(q=>q.key==='seeking-dawah-1'), 'the new course must include practice questions');
assert.equal(db.lessons.length,LESSONS.length);
assert.equal(db.question_bank.length,QUESTIONS.length+REFLECTION_QUESTIONS.length);
assert.equal(db.journey_items.length,5);
for(const lesson of db.lessons){
  assert.ok(db.subjects.some(s=>s.id===lesson.subject_id),'lesson must reference a subject: '+lesson.id);
  assert.ok(lesson.content && lesson.content.explanation && lesson.content.action,'lesson must include instructional content: '+lesson.id);
  assert.ok(Array.isArray(lesson.content.reflection_questions),'lesson must include reflection questions: '+lesson.id);
}
for(const q of db.question_bank){
  assert.ok(db.subjects.some(s=>s.id===q.subject_id),'question must reference a subject: '+q.id);
  assert.ok(db.lessons.some(l=>l.id===q.lesson_id),'question must reference a lesson: '+q.id);
  if(q.type==='single_choice') assert.ok(q.options.includes(q.correct_answer),'answer must be one of the choices: '+q.id);
  if(q.type==='true_false') assert.ok(['true','false'].includes(q.correct_answer),'true/false answer invalid: '+q.id);
}
const counts={subjects:db.subjects.length,lessons:db.lessons.length,questions:db.question_bank.length,journey:db.journey_items.length};
const second=seedEducationalContent(db);
assert.equal(second.changed,false,'second seed must be idempotent');
assert.deepEqual({subjects:db.subjects.length,lessons:db.lessons.length,questions:db.question_bank.length,journey:db.journey_items.length},counts);

// Existing administrator-authored content must remain untouched.
db.lessons.push({id:'custom-lesson',title:'درس من المعلم',subject_id:db.subjects[0].id,content:{explanation:'لا تغيّرني'}});
db.question_bank.push({id:'custom-question',title:'سؤال من المعلم',type:'short_answer',active:true});
seedEducationalContent(db);
assert.equal(db.lessons.find(x=>x.id==='custom-lesson').content.explanation,'لا تغيّرني');
assert.equal(db.question_bank.find(x=>x.id==='custom-question').title,'سؤال من المعلم');
console.log('Educational content tests passed:', JSON.stringify(counts));
