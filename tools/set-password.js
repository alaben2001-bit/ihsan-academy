'use strict';
// تغيير كلمة مرور مستخدم:  node tools/set-password.js البريد كلمة_المرور_الجديدة
// شغّله والخادم متوقف. تُحفظ كلمة المرور مجزّأة (scrypt) ولا تُكتب كنص صريح.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const [email, pw] = process.argv.slice(2);
if (!email || !pw) { console.log('الاستخدام: node tools/set-password.js البريد كلمة_المرور_الجديدة'); process.exit(1); }
if (pw.length < 8) { console.log('كلمة المرور قصيرة؛ استخدم 8 أحرف على الأقل.'); process.exit(1); }
const file = path.join(__dirname, '..', 'data', 'db.json');
const db = JSON.parse(fs.readFileSync(file, 'utf8'));
const u = db.users.find(x => String(x.email).toLowerCase() === email.toLowerCase());
if (!u) { console.log('لا يوجد مستخدم بهذا البريد.'); process.exit(1); }
const salt = crypto.randomBytes(16).toString('hex');
u.password = `scrypt$${salt}$${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
fs.writeFileSync(file, JSON.stringify(db, null, 2), 'utf8');
console.log('تم تغيير كلمة المرور للمستخدم: ' + u.name);
