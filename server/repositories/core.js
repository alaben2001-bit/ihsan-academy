'use strict';

/**
 * V32 Core Repository
 * يحدد حدًا واضحًا بين HTTP/الصلاحيات وبين طريقة تخزين البيانات.
 * لا يحتوي على صلاحيات؛ الصلاحيات تبقى في Service/handler.
 */
class CoreRepository {
  constructor({ getDb, persist }) {
    this.getDb = getDb;
    this.persist = persist;
  }
  _db() { return this.getDb(); }
  allUsers() { return this._db().users; }
  findUserById(id) { return this._db().users.find(x => x.id === id) || null; }
  findUserByEmail(email) {
    const e = String(email || '').toLowerCase();
    return this._db().users.find(x => String(x.email || '').toLowerCase() === e) || null;
  }
  insertUser(row) { this._db().users.push(row); return row; }
  updateUser(id, patch) {
    const row = this.findUserById(id); if (!row) return null;
    Object.assign(row, patch); return row;
  }
  allGroups() { return this._db().groups; }
  findGroupById(id) { return this._db().groups.find(x => x.id === id) || null; }
  allStudents() { return this._db().students; }
  findStudentById(id) { return this._db().students.find(x => x.id === id) || null; }
  memberships() { return this._db().memberships; }
  teacherGroups() { return this._db().teacher_groups; }
  replaceStudentMemberships(studentId, rows) {
    const db = this._db();
    db.memberships = db.memberships.filter(x => x.student_id !== studentId);
    db.memberships.push(...rows);
  }
  save() { this.persist(); }
}

module.exports = { CoreRepository };
