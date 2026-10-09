'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { JsonStorageAdapter, createStorage } = require('../server/storage');
const { ensureCoreCollections } = require('../server/storage/postgres');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihsan-academy-test-'));
try {
  const file = path.join(dir, 'db.json');
  const storage = new JsonStorageAdapter(file);
  const fixture = {
    users: [{ id: 'u-test', name: 'اختبار', role: 'admin', active: true }],
    groups: [{ id: 'g-test', name: 'فوج الاختبار' }],
    academy_name: 'أكاديمية الإحسان'
  };

  storage.save(fixture);
  assert.deepEqual(storage.load(), fixture, 'JSON storage must preserve all data');
  assert.equal(storage.health().healthy, true, 'JSON storage health check must pass');

  const emptyPostgres = ensureCoreCollections({});
  assert.deepEqual(emptyPostgres.users, [], 'a fresh PostgreSQL database must initialize users');
  assert.deepEqual(emptyPostgres.groups, [], 'a fresh PostgreSQL database must initialize groups');
  assert.deepEqual(emptyPostgres.students, [], 'a fresh PostgreSQL database must initialize students');
  assert.equal(ensureCoreCollections({ users: [{ id: 'u1' }], groups: [{ id: 'g1' }] }).users.length, 1, 'existing records must be preserved');

  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const migrations = fs.readdirSync(migrationsDir).filter(name => /^\d+_.+\.sql$/.test(name));
  const versions = migrations.map(name => Number(name.match(/^\d+/)[0]));
  assert.equal(new Set(versions).size, versions.length, 'PostgreSQL migration versions must be unique');

  const previousMode = process.env.ACADEMY_STORAGE;
  const previousDbMode = process.env.ACADEMY_DB_MODE;
  const previousUrl = process.env.DATABASE_URL;
  const previousPgUrl = process.env.ACADEMY_POSTGRES_URL;
  try {
    process.env.ACADEMY_STORAGE = 'postgres';
    delete process.env.ACADEMY_DB_MODE;
    delete process.env.DATABASE_URL;
    delete process.env.ACADEMY_POSTGRES_URL;
    assert.throws(
      () => createStorage({ root: dir, dataFile: file }),
      /يتطلب DATABASE_URL أو ACADEMY_POSTGRES_URL/,
      'Postgres mode must fail clearly when no database URL is configured'
    );
  } finally {
    for (const [key, value] of [
      ['ACADEMY_STORAGE', previousMode],
      ['ACADEMY_DB_MODE', previousDbMode],
      ['DATABASE_URL', previousUrl],
      ['ACADEMY_POSTGRES_URL', previousPgUrl]
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }

  process.stdout.write('Storage smoke tests passed.\n');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
