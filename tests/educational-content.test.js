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
