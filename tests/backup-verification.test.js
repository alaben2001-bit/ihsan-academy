'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const verifier = path.join(__dirname, '..', 'tools', 'verify-backups.js');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ihsan-backup-verify-'));
function run(dir) {
  return spawnSync(process.execPath, [verifier], {
    encoding: 'utf8',
    env: { ...process.env, ACADEMY_BACKUP_DIR: dir }
  });
}
function sha(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}
try {
  const goodDir = path.join(root, 'good');
  fs.mkdirSync(goodDir);
  const bytes = Buffer.from('test backup bytes');
  const file = 'sample.dump';
  fs.writeFileSync(path.join(goodDir, file), bytes);
  fs.writeFileSync(path.join(goodDir, file + '.sha256'), sha(bytes) + '  ' + file + '\n');
  assert.equal(run(goodDir).status, 0, 'must accept the SHA-256 sidecar format emitted by backup-postgres.js');

  const legacyDir = path.join(root, 'legacy');
  fs.mkdirSync(legacyDir);
  fs.writeFileSync(path.join(legacyDir, file), bytes);
  fs.writeFileSync(path.join(legacyDir, file + '.sha256'), JSON.stringify({ sha256: sha(bytes), file }));
  assert.equal(run(legacyDir).status, 0, 'must accept legacy JSON manifests');

  const tamperedDir = path.join(root, 'tampered');
  fs.mkdirSync(tamperedDir);
  fs.writeFileSync(path.join(tamperedDir, file), 'changed bytes');
  fs.writeFileSync(path.join(tamperedDir, file + '.sha256'), sha(bytes) + '  ' + file + '\n');
  assert.notEqual(run(tamperedDir).status, 0, 'must reject a checksum mismatch');

  const missingManifestDir = path.join(root, 'no-manifest');
  fs.mkdirSync(missingManifestDir);
  fs.writeFileSync(path.join(missingManifestDir, file), bytes);
  assert.notEqual(run(missingManifestDir).status, 0, 'must fail when no manifests exist');

  assert.notEqual(run(path.join(root, 'missing-directory')).status, 0, 'must fail when the backup directory is missing');
  console.log('Backup verification tests passed: generated sidecar, legacy JSON, tampered dump, missing manifest, missing directory');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
