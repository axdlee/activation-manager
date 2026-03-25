import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { bootstrapDevelopmentDatabase } from '../src/lib/dev-bootstrap'

const silentLogger = {
  log: () => undefined,
  error: () => undefined,
}

function querySqlite(dbPath: string, sql: string) {
  return execFileSync('sqlite3', [dbPath], {
    encoding: 'utf8',
    input: sql,
  }).trim()
}

test('bootstrapDevelopmentDatabase 会为真实查询路径创建关键复合索引', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'activation-manager-indexes-'))
  const dbPath = path.join(tempDir, 'dev.db')

  await bootstrapDevelopmentDatabase({
    dbPath,
    logger: silentLogger,
  })

  assert.equal(
    querySqlite(
      dbPath,
      "SELECT group_concat(name, ',') FROM pragma_index_info('activation_codes_projectId_usedBy_isUsed_usedAt_idx');",
    ),
    'projectId,usedBy,isUsed,usedAt',
  )

  assert.equal(
    querySqlite(
      dbPath,
      "SELECT group_concat(name, ',') FROM pragma_index_info('license_consumptions_activationCodeId_createdAt_idx');",
    ),
    'activationCodeId,createdAt',
  )

  assert.equal(
    querySqlite(
      dbPath,
      "SELECT group_concat(name, ',') FROM pragma_index_info('license_consumptions_createdAt_id_idx');",
    ),
    'createdAt,id',
  )

  assert.equal(
    querySqlite(
      dbPath,
      "SELECT group_concat(name, ',') FROM pragma_index_info('activation_codes_projectId_usedBy_key');",
    ),
    'projectId,usedBy',
  )

  assert.equal(
    querySqlite(
      dbPath,
      "SELECT \"unique\" FROM pragma_index_list('activation_codes') WHERE name = 'activation_codes_projectId_usedBy_key';",
    ),
    '1',
  )
})
