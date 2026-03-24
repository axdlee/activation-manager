import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import bcrypt from 'bcryptjs'

import {
  bootstrapDevelopmentDatabase,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_USERNAME,
  DEFAULT_PROJECT_KEY,
  DEFAULT_PROJECT_NAME,
} from '../src/lib/dev-bootstrap'
import { defaultSystemConfigs } from '../src/lib/system-config-defaults'

function querySqlite(dbPath: string, sql: string) {
  return execFileSync('sqlite3', [dbPath], {
    encoding: 'utf8',
    input: sql,
  }).trim()
}

const silentLogger = {
  log: () => undefined,
  error: () => undefined,
}

test('bootstrapDevelopmentDatabase 会创建所需表和默认数据', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'activation-manager-bootstrap-'))
  const dbPath = path.join(tempDir, 'dev.db')

  await bootstrapDevelopmentDatabase({
    dbPath,
    logger: silentLogger,
  })

  const tables = querySqlite(
    dbPath,
    "SELECT group_concat(name, ',') FROM (SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('activation_codes', 'admins', 'license_consumptions', 'projects', 'system_configs') ORDER BY name);",
  )

  assert.equal(tables, 'activation_codes,admins,license_consumptions,projects,system_configs')
  assert.equal(querySqlite(dbPath, 'SELECT COUNT(*) FROM admins;'), '1')
  assert.equal(querySqlite(dbPath, 'SELECT COUNT(*) FROM projects;'), '1')
  assert.equal(
    querySqlite(dbPath, 'SELECT COUNT(*) FROM system_configs;'),
    String(defaultSystemConfigs.length),
  )
  assert.equal(
    querySqlite(dbPath, 'SELECT username FROM admins LIMIT 1;'),
    DEFAULT_ADMIN_USERNAME,
  )

  const passwordHash = querySqlite(dbPath, 'SELECT password FROM admins LIMIT 1;')
  assert.equal(await bcrypt.compare(DEFAULT_ADMIN_PASSWORD, passwordHash), true)
  assert.equal(
    querySqlite(dbPath, 'SELECT projectKey FROM projects LIMIT 1;'),
    DEFAULT_PROJECT_KEY,
  )
  assert.equal(
    querySqlite(dbPath, 'SELECT name FROM projects LIMIT 1;'),
    DEFAULT_PROJECT_NAME,
  )
})

test('bootstrapDevelopmentDatabase 可重复执行且不会产生重复种子数据', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'activation-manager-bootstrap-'))
  const dbPath = path.join(tempDir, 'dev.db')

  await bootstrapDevelopmentDatabase({
    dbPath,
    logger: silentLogger,
  })

  await bootstrapDevelopmentDatabase({
    dbPath,
    logger: silentLogger,
  })

  assert.equal(querySqlite(dbPath, 'SELECT COUNT(*) FROM admins;'), '1')
  assert.equal(querySqlite(dbPath, 'SELECT COUNT(*) FROM projects;'), '1')
  assert.equal(
    querySqlite(dbPath, 'SELECT COUNT(*) FROM system_configs;'),
    String(defaultSystemConfigs.length),
  )
})

test('bootstrapDevelopmentDatabase 会补齐旧版激活码表的项目与授权类型字段', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'activation-manager-bootstrap-'))
  const dbPath = path.join(tempDir, 'dev.db')

  querySqlite(
    dbPath,
    `
      CREATE TABLE "activation_codes" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "code" TEXT NOT NULL,
        "isUsed" INTEGER NOT NULL DEFAULT 0,
        "usedAt" DATETIME,
        "usedBy" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "expiresAt" DATETIME,
        "validDays" INTEGER,
        "cardType" TEXT
      );
      CREATE UNIQUE INDEX "activation_codes_code_key" ON "activation_codes"("code");
      INSERT INTO "activation_codes" ("code", "isUsed", "validDays") VALUES ('LEGACY-CODE', 0, 30);
    `,
  )

  await bootstrapDevelopmentDatabase({
    dbPath,
    logger: silentLogger,
  })

  assert.equal(
    querySqlite(
      dbPath,
      "SELECT group_concat(name, ',') FROM pragma_table_info('activation_codes') WHERE name IN ('projectId','licenseMode','totalCount','remainingCount','consumedCount');",
    ),
    'projectId,licenseMode,totalCount,remainingCount,consumedCount',
  )
  assert.equal(
    querySqlite(
      dbPath,
      "SELECT p.projectKey FROM activation_codes ac JOIN projects p ON p.id = ac.projectId WHERE ac.code = 'LEGACY-CODE';",
    ),
    DEFAULT_PROJECT_KEY,
  )
  assert.equal(
    querySqlite(
      dbPath,
      "SELECT licenseMode FROM activation_codes WHERE code = 'LEGACY-CODE';",
    ),
    'TIME',
  )
})
