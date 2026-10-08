'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PostgresStorageAdapter } = require('./postgres');

class StorageError extends Error {}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

class JsonStorageAdapter {
  constructor(file) {
    this.kind = 'json';
    this.file = path.resolve(file);
    this.lastWriteAt = null;
  }
  load() {
    const db = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    return db;
  }
  save(db) {
    const dir = path.dirname(this.file);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = this.file + '.tmp-' + process.pid + '-' + Date.now();
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tmp, this.file);
    this.lastWriteAt = new Date().toISOString();
  }
  health() {
    try {
      const st = fs.statSync(this.file);
      JSON.parse(fs.readFileSync(this.file, 'utf8'));
      return { healthy: true, kind: this.kind, file_exists: true, bytes: st.size, last_write_at: this.lastWriteAt, sha256: sha256File(this.file) };
    } catch (e) {
      return { healthy: false, kind: this.kind, file_exists: false, error: e.message };
    }
  }
}

class SqliteStorageAdapter {
  constructor(file) {
    this.kind = 'sqlite';
    this.file = path.resolve(file);
    this.lastWriteAt = null;
    try { this.sqlite = require('node:sqlite'); } catch (e) {
      throw new StorageError('SQLite adapter يحتاج Node.js 22+ بسبب node:sqlite.');
    }
    this.db = null;
    this.schemaVersion = 30;
  }
  _open() {
    if (this.db) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    this.db = new this.sqlite.DatabaseSync(this.file);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
    this.db.exec('CREATE TABLE IF NOT EXISTS academy_meta (key TEXT PRIMARY KEY, data TEXT NOT NULL);');
  }
  _tables(db) { return Object.keys(db).filter(k => Array.isArray(db[k])); }
  _rowKey(row) { return row && row.id != null ? String(row.id) : crypto.createHash('sha256').update(JSON.stringify(row)).digest('hex').slice(0,32); }
  load() {
    this._open();
    const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name <> 'academy_meta' ORDER BY name").all();
    const out = {};
    for (const { name } of tables) {
      if (!/^[_A-Za-z][_A-Za-z0-9]*$/.test(name)) continue;
      const rows = this.db.prepare(`SELECT id,data FROM "${name}"`).all();
      out[name] = rows.map(r => JSON.parse(r.data));
    }
    const meta = this.db.prepare('SELECT key,data FROM academy_meta').all();
    for (const row of meta) if (row.key !== '__schema_version') out[row.key] = JSON.parse(row.data);
    if (!out.users || !out.groups) throw new StorageError('SQLite قاعدة البيانات ناقصة: users/groups.');
    return out;
  }
  save(db) {
    this._open();
    const tables = this._tables(db);
    const meta = Object.keys(db).filter(k => !Array.isArray(db[k]));
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const existing = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name <> 'academy_meta'").all().map(x => x.name);
      for (const name of existing) if (!tables.includes(name)) this.db.exec(`DROP TABLE "${name.replace(/"/g,'""')}"`);
      for (const name of tables) {
        if (!/^[_A-Za-z][_A-Za-z0-9]*$/.test(name)) throw new StorageError(`اسم مجموعة غير صالح: ${name}`);
        this.db.exec(`CREATE TABLE IF NOT EXISTS "${name}" (id TEXT PRIMARY KEY, data TEXT NOT NULL)`);
        this.db.exec(`DELETE FROM "${name}"`);
        const stmt = this.db.prepare(`INSERT INTO "${name}" (id,data) VALUES (?,?)`);
        for (const row of db[name]) {
          if (!row) throw new StorageError(`السجل في ${name} غير صالح`);
          stmt.run(this._rowKey(row), JSON.stringify(row));
        }
      }
      this.db.exec('DELETE FROM academy_meta');
      const metaStmt = this.db.prepare('INSERT INTO academy_meta(key,data) VALUES (?,?)');
      metaStmt.run('__schema_version', JSON.stringify(this.schemaVersion));
      for (const key of meta) metaStmt.run(key, JSON.stringify(db[key]));
      this.db.exec('COMMIT');
      this.lastWriteAt = new Date().toISOString();
    } catch (e) {
      try { this.db.exec('ROLLBACK'); } catch {}
      throw e;
    }
  }
  transaction(fn) {
    this._open();
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(this.db); this.db.exec('COMMIT'); return result; }
    catch (e) { try { this.db.exec('ROLLBACK'); } catch {} throw e; }
  }
  backup(destination) {
    this._open();
    const out = path.resolve(destination);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    try { this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch {}
    fs.rmSync(out, { force: true });
    fs.copyFileSync(this.file, out);
    return out;
  }
  health() {
    try {
      this._open();
      const integrity = this.db.prepare('PRAGMA integrity_check').get();
      const tables = this.db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table'").get().n;
      return { healthy: integrity && integrity.integrity_check === 'ok', kind: this.kind, file_exists: fs.existsSync(this.file), bytes: fs.statSync(this.file).size, tables, last_write_at: this.lastWriteAt, sha256: sha256File(this.file), integrity: integrity?.integrity_check || 'unknown' };
    } catch (e) { return { healthy: false, kind: this.kind, file_exists: fs.existsSync(this.file), error: e.message }; }
  }
}

function createStorage({ root, dataFile }) {
  const mode = String(process.env.ACADEMY_STORAGE || (process.env.ACADEMY_DB_MODE === 'sqlite' ? 'sqlite' : 'json')).toLowerCase();
  if (mode === 'sqlite') {
    const file = process.env.ACADEMY_SQLITE_FILE ? path.resolve(process.env.ACADEMY_SQLITE_FILE) : path.join(root, 'data', 'academy-v30.sqlite');
    return new SqliteStorageAdapter(file);
  }
  if (mode === 'postgres') { const url = process.env.DATABASE_URL || process.env.ACADEMY_POSTGRES_URL; if (!url) throw new StorageError('ACADEMY_STORAGE=postgres يتطلب DATABASE_URL أو ACADEMY_POSTGRES_URL.'); return new PostgresStorageAdapter(url); }
  if (mode !== 'json' && mode !== 'local') throw new StorageError(`ACADEMY_STORAGE غير معروف: ${mode}`);
  return new JsonStorageAdapter(dataFile);
}

module.exports = { StorageError, JsonStorageAdapter, SqliteStorageAdapter, PostgresStorageAdapter, createStorage, sha256File };
