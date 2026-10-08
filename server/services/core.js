'use strict';

/**
 * V32 Core Services
 * منطق العمليات الأساسية بعيدًا عن تفاصيل HTTP وقاعدة البيانات.
 */
class CoreService {
  constructor(repo, { hashPassword, uid, now }) {
    this.repo = repo;
    this.hashPassword = hashPassword;
    this.uid = uid;
    this.now = now || (() => new Date().toISOString());
  }

  authenticate(email, password, verifyPassword, dummyHash) {
    const user = this.repo.findUserByEmail(email);
    const valid = verifyPassword(String(password || ''), user ? user.password : dummyHash) && !!user;
    if (!valid || user.active === false) return null;
    return user;
  }

  createUser({ name, email, password, role }) {
    const row = { id: this.uid('u'), name, email, password: this.hashPassword(password), role, active: true, created_at: this.now() };
    return this.repo.insertUser(row);
  }

  updateUser(id, patch) { return this.repo.updateUser(id, patch); }
}

module.exports = { CoreService };
