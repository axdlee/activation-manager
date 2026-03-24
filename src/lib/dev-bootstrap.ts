import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import bcrypt from 'bcryptjs'

import {
  defaultConfigValues,
  defaultSystemConfigs,
  stringifyConfigValue,
} from './system-config-defaults'

export const DEFAULT_ADMIN_USERNAME = 'admin'
export const DEFAULT_ADMIN_PASSWORD = '123456'
export const DEFAULT_PROJECT_KEY = 'default'
export const DEFAULT_PROJECT_NAME = '默认项目'

const REQUIRED_TABLES = ['activation_codes', 'admins', 'license_consumptions', 'projects', 'system_configs'] as const
const DEFAULT_DB_PATH = path.join(process.cwd(), 'prisma', 'dev.db')

type BootstrapLogger = Pick<Console, 'log' | 'error'>

function escapeSqlString(value: string) {
  return value.split("'").join("''")
}

function runSqlite(dbPath: string, sql: string) {
  return execFileSync('sqlite3', [dbPath], {
    encoding: 'utf8',
    input: sql,
  }).trim()
}

function querySingleValue(dbPath: string, sql: string) {
  return runSqlite(dbPath, sql)
}

function queryLines(dbPath: string, sql: string) {
  const output = runSqlite(dbPath, sql)
  return output ? output.split('\n').map((line) => line.trim()).filter(Boolean) : []
}

function tableExists(dbPath: string, tableName: string) {
  return (
    querySingleValue(
      dbPath,
      `SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = '${tableName}';`,
    ) === '1'
  )
}

function columnExists(dbPath: string, tableName: string, columnName: string) {
  return queryLines(dbPath, `PRAGMA table_info("${tableName}");`).some((line) => {
    const segments = line.split('|')
    return segments[1] === columnName
  })
}

function buildSchemaSql() {
  return `
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS "projects" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL,
      "projectKey" TEXT NOT NULL,
      "description" TEXT,
      "isEnabled" INTEGER NOT NULL DEFAULT 1,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "projects_projectKey_key"
    ON "projects"("projectKey");

    CREATE TABLE IF NOT EXISTS "activation_codes" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "code" TEXT NOT NULL,
      "isUsed" INTEGER NOT NULL DEFAULT 0,
      "usedAt" DATETIME,
      "usedBy" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "expiresAt" DATETIME,
      "validDays" INTEGER,
      "cardType" TEXT,
      "projectId" INTEGER,
      "licenseMode" TEXT NOT NULL DEFAULT 'TIME',
      "totalCount" INTEGER,
      "remainingCount" INTEGER,
      "consumedCount" INTEGER NOT NULL DEFAULT 0
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "activation_codes_code_key"
    ON "activation_codes"("code");

    CREATE INDEX IF NOT EXISTS "activation_codes_projectId_idx"
    ON "activation_codes"("projectId");

    CREATE TABLE IF NOT EXISTS "license_consumptions" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "requestId" TEXT NOT NULL,
      "activationCodeId" INTEGER NOT NULL,
      "machineId" TEXT NOT NULL,
      "remainingCountAfter" INTEGER NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "license_consumptions_requestId_key"
    ON "license_consumptions"("requestId");

    CREATE INDEX IF NOT EXISTS "license_consumptions_activationCodeId_idx"
    ON "license_consumptions"("activationCodeId");

    CREATE TABLE IF NOT EXISTS "admins" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "username" TEXT NOT NULL,
      "password" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "admins_username_key"
    ON "admins"("username");

    CREATE TABLE IF NOT EXISTS "system_configs" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "key" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      "description" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "system_configs_key_key"
    ON "system_configs"("key");
  `
}

function ensureActivationCodeCompatibility(dbPath: string) {
  const requiredColumns = [
    'updatedAt',
    'projectId',
    'licenseMode',
    'totalCount',
    'remainingCount',
    'consumedCount',
  ]

  const needsRebuild = requiredColumns.some(
    (columnName) => !columnExists(dbPath, 'activation_codes', columnName),
  )

  if (needsRebuild) {
    runSqlite(
      dbPath,
      `
        ALTER TABLE "activation_codes" RENAME TO "activation_codes_legacy";

        CREATE TABLE "activation_codes" (
          "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
          "code" TEXT NOT NULL,
          "isUsed" INTEGER NOT NULL DEFAULT 0,
          "usedAt" DATETIME,
          "usedBy" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "expiresAt" DATETIME,
          "validDays" INTEGER,
          "cardType" TEXT,
          "projectId" INTEGER,
          "licenseMode" TEXT NOT NULL DEFAULT 'TIME',
          "totalCount" INTEGER,
          "remainingCount" INTEGER,
          "consumedCount" INTEGER NOT NULL DEFAULT 0
        );

        INSERT INTO "activation_codes" (
          "id",
          "code",
          "isUsed",
          "usedAt",
          "usedBy",
          "createdAt",
          "updatedAt",
          "expiresAt",
          "validDays",
          "cardType",
          "projectId",
          "licenseMode",
          "totalCount",
          "remainingCount",
          "consumedCount"
        )
        SELECT
          "id",
          "code",
          "isUsed",
          "usedAt",
          "usedBy",
          "createdAt",
          COALESCE("createdAt", CURRENT_TIMESTAMP),
          "expiresAt",
          "validDays",
          "cardType",
          NULL,
          'TIME',
          NULL,
          NULL,
          0
        FROM "activation_codes_legacy";

        DROP TABLE "activation_codes_legacy";
      `,
    )
  }

  runSqlite(
    dbPath,
    `
      CREATE INDEX IF NOT EXISTS "activation_codes_projectId_idx"
      ON "activation_codes"("projectId");

      UPDATE "activation_codes"
      SET "updatedAt" = COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP);

      UPDATE "activation_codes"
      SET "licenseMode" = COALESCE("licenseMode", 'TIME')
      WHERE "licenseMode" IS NULL OR "licenseMode" = '';

      UPDATE "activation_codes"
      SET "consumedCount" = COALESCE("consumedCount", 0)
      WHERE "consumedCount" IS NULL;
    `,
  )
}

export function ensureSchema(dbPath: string = DEFAULT_DB_PATH) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  runSqlite(dbPath, buildSchemaSql())

  if (tableExists(dbPath, 'activation_codes')) {
    ensureActivationCodeCompatibility(dbPath)
  }

  const missingTables = REQUIRED_TABLES.filter((tableName) => !tableExists(dbPath, tableName))
  if (missingTables.length > 0) {
    throw new Error(`数据库表创建失败: ${missingTables.join(', ')}`)
  }
}

export function ensureDefaultProject(
  dbPath: string = DEFAULT_DB_PATH,
  logger: BootstrapLogger = console,
) {
  ensureSchema(dbPath)

  const existingProjectId = querySingleValue(
    dbPath,
    `SELECT "id" FROM "projects" WHERE "projectKey" = '${DEFAULT_PROJECT_KEY}' LIMIT 1;`,
  )

  if (existingProjectId) {
    logger.log('默认项目已存在，跳过初始化')
    return Number(existingProjectId)
  }

  runSqlite(
    dbPath,
    `
      INSERT INTO "projects" ("name", "projectKey", "description", "isEnabled", "createdAt", "updatedAt")
      VALUES (
        '${escapeSqlString(DEFAULT_PROJECT_NAME)}',
        '${escapeSqlString(DEFAULT_PROJECT_KEY)}',
        '系统兼容默认项目',
        1,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      );
    `,
  )

  logger.log(`✅ 默认项目创建成功: ${DEFAULT_PROJECT_NAME} (${DEFAULT_PROJECT_KEY})`)

  return Number(
    querySingleValue(
      dbPath,
      `SELECT "id" FROM "projects" WHERE "projectKey" = '${DEFAULT_PROJECT_KEY}' LIMIT 1;`,
    ),
  )
}

function backfillActivationCodesProject(dbPath: string, projectId: number) {
  runSqlite(
    dbPath,
    `
      UPDATE "activation_codes"
      SET "projectId" = ${projectId}
      WHERE "projectId" IS NULL
         OR "projectId" NOT IN (SELECT "id" FROM "projects");
    `,
  )
}

export async function ensureDefaultSystemConfigs(
  dbPath: string = DEFAULT_DB_PATH,
  logger: BootstrapLogger = console,
) {
  const defaultProjectId = ensureDefaultProject(dbPath, logger)
  backfillActivationCodesProject(dbPath, defaultProjectId)

  const existingKeys = new Set(queryLines(dbPath, 'SELECT "key" FROM "system_configs";'))
  const missingConfigs = defaultSystemConfigs.filter(({ key }) => !existingKeys.has(key))

  if (missingConfigs.length === 0) {
    logger.log('系统配置已存在，跳过初始化')
    return
  }

  const insertStatements = missingConfigs
    .map(
      ({ key, value, description }) => `
        INSERT OR IGNORE INTO "system_configs" ("key", "value", "description", "createdAt", "updatedAt")
        VALUES (
          '${escapeSqlString(key)}',
          '${escapeSqlString(stringifyConfigValue(value))}',
          '${escapeSqlString(description)}',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        );
      `,
    )
    .join('\n')

  runSqlite(
    dbPath,
    `
      BEGIN;
      ${insertStatements}
      COMMIT;
    `,
  )

  logger.log('✅ 系统配置初始化成功!')
  logger.log('默认配置项：')
  missingConfigs.forEach((config) => {
    logger.log(`- ${config.key}: ${config.description}`)
  })
}

export async function ensureDefaultAdmin(
  dbPath: string = DEFAULT_DB_PATH,
  logger: BootstrapLogger = console,
) {
  const defaultProjectId = ensureDefaultProject(dbPath, logger)
  backfillActivationCodesProject(dbPath, defaultProjectId)

  const adminCount = Number(querySingleValue(dbPath, 'SELECT COUNT(*) FROM "admins";'))
  if (adminCount > 0) {
    logger.log('管理员账号已存在，跳过初始化')
    return
  }

  const bcryptRounds = Number(defaultConfigValues.bcryptRounds)
  const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, bcryptRounds)

  runSqlite(
    dbPath,
    `
      INSERT INTO "admins" ("username", "password", "createdAt", "updatedAt")
      VALUES (
        '${escapeSqlString(DEFAULT_ADMIN_USERNAME)}',
        '${escapeSqlString(hashedPassword)}',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      );
    `,
  )

  logger.log('✅ 默认管理员账号创建成功!')
  logger.log(`用户名: ${DEFAULT_ADMIN_USERNAME}`)
  logger.log(`密码: ${DEFAULT_ADMIN_PASSWORD}`)
  logger.log('请登录后及时修改密码！')
}

export async function bootstrapDevelopmentDatabase({
  dbPath = DEFAULT_DB_PATH,
  logger = console,
}: {
  dbPath?: string
  logger?: BootstrapLogger
} = {}) {
  ensureSchema(dbPath)
  const defaultProjectId = ensureDefaultProject(dbPath, logger)
  backfillActivationCodesProject(dbPath, defaultProjectId)
  await ensureDefaultSystemConfigs(dbPath, logger)
  await ensureDefaultAdmin(dbPath, logger)
  logger.log(`✅ 开发环境初始化完成: ${dbPath}`)
}
