import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import bcrypt from 'bcryptjs'

import {
  buildDefaultSystemConfigs,
  defaultConfigValues,
  stringifyConfigValue,
} from './system-config-defaults'
import { resolveDatabaseUrl } from './db'

export const DEFAULT_ADMIN_USERNAME = 'admin'
export const DEFAULT_ADMIN_PASSWORD = '123456'
export const DEFAULT_PROJECT_KEY = 'default'
export const DEFAULT_PROJECT_NAME = '默认项目'

const REQUIRED_TABLES = [
  'activation_code_binding_histories',
  'activation_codes',
  'admin_login_rate_limits',
  'admin_operation_audit_logs',
  'admins',
  'license_consumptions',
  'projects',
  'system_configs',
] as const

function resolveDefaultDbPath() {
  const databaseUrl = resolveDatabaseUrl()

  if (databaseUrl.startsWith('file:')) {
    const filePath = databaseUrl.slice('file:'.length)
    return filePath.startsWith('/') ? filePath : path.join(process.cwd(), 'prisma', filePath)
  }

  return path.join(process.cwd(), 'prisma', 'dev.db')
}

const DEFAULT_DB_PATH = resolveDefaultDbPath()
const PRISMA_SCHEMA_PATH = path.join(process.cwd(), 'prisma', 'schema.prisma')
const PRISMA_SCHEMA_DATASOURCE_PATTERN = /url\s+=\s+"file:\.\/dev\.db"/
const PRISMA_MIGRATIONS_DIR = path.join(process.cwd(), 'prisma', 'migrations')

type BootstrapLogger = Pick<Console, 'log' | 'error'>

function escapeSqlString(value: string) {
  return value.split("'").join("''")
}

function extractCommandOutput(error: unknown) {
  const rawStderr =
    typeof error === 'object' &&
    error !== null &&
    'stderr' in error
      ? (error as { stderr: unknown }).stderr
      : ''
  const rawStdout =
    typeof error === 'object' &&
    error !== null &&
    'stdout' in error
      ? (error as { stdout: unknown }).stdout
      : ''
  const stderr = typeof rawStderr === 'string' ? rawStderr : rawStderr instanceof Buffer ? rawStderr.toString('utf8') : ''
  const stdout = typeof rawStdout === 'string' ? rawStdout : rawStdout instanceof Buffer ? rawStdout.toString('utf8') : ''

  return { stderr: stderr.trim(), stdout: stdout.trim(), details: (stderr || stdout).trim() }
}

function runSqlite(dbPath: string, sql: string) {
  // .timeout 让 sqlite3 CLI 在数据库被并发占用时等待重试，
  // 避免测试并行初始化或运行期瞬时写入冲突时直接报 database is locked。
  return execFileSync('sqlite3', [dbPath], {
    encoding: 'utf8',
    input: `.timeout 5000\n${sql}`,
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

function prismaSqliteUrl(dbPath: string) {
  const normalizedPath = path.resolve(dbPath).split(path.sep).join('/')
  return `file:${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}`
}

function buildPrismaSchema(dbPath: string) {
  const schemaTemplate = fs.readFileSync(PRISMA_SCHEMA_PATH, 'utf8')

  if (!PRISMA_SCHEMA_DATASOURCE_PATTERN.test(schemaTemplate)) {
    throw new Error(`Prisma schema 数据源格式不受支持: ${PRISMA_SCHEMA_PATH}`)
  }

  return schemaTemplate.replace(
    PRISMA_SCHEMA_DATASOURCE_PATTERN,
    `url      = "${prismaSqliteUrl(dbPath)}"`,
  )
}

function resolvePrismaCommand() {
  const localPrismaBinary = path.join(
    process.cwd(),
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'prisma.cmd' : 'prisma',
  )

  if (fs.existsSync(localPrismaBinary)) {
    return {
      command: localPrismaBinary,
      argsPrefix: [] as string[],
    }
  }

  return {
    command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    argsPrefix: ['prisma'],
  }
}

function pushPrismaSchema(dbPath: string) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'activation-manager-prisma-'))
  const tempSchemaPath = path.join(tempDir, 'schema.prisma')
  const { command, argsPrefix } = resolvePrismaCommand()

  fs.writeFileSync(tempSchemaPath, buildPrismaSchema(dbPath), 'utf8')

  const nodeEnv = process.env.NODE_ENV || 'development'
  // 生产环境不传 --accept-data-loss，避免 schema 变更时静默丢数据；
  // 若需要破坏性变更（如删列），prisma 会报错提示，需手动处理或迁移。
  const acceptDataLossFlag = nodeEnv !== 'production' ? ['--accept-data-loss'] : []

  try {
    execFileSync(
      command,
      [...argsPrefix, 'db', 'push', '--skip-generate', ...acceptDataLossFlag, '--schema', tempSchemaPath],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: 'pipe',
      },
    )
  } catch (error) {
    const { details } = extractCommandOutput(error)

    throw new Error(details ? `Prisma schema 同步失败: ${details}` : 'Prisma schema 同步失败')
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

function migratePrismaSchema(dbPath: string) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'activation-manager-migrate-'))
  const tempSchemaPath = path.join(tempDir, 'schema.prisma')
  const { command, argsPrefix } = resolvePrismaCommand()

  // migrate deploy 需要 migrations 目录位于 schema 文件同级的 migrations 子目录
  fs.writeFileSync(tempSchemaPath, buildPrismaSchema(dbPath), 'utf8')
  fs.cpSync(PRISMA_MIGRATIONS_DIR, path.join(tempDir, 'migrations'), { recursive: true })

  try {
    execFileSync(
      command,
      [...argsPrefix, 'migrate', 'deploy', '--schema', tempSchemaPath],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: 'pipe',
      },
    )
  } catch (error) {
    const { details } = extractCommandOutput(error)

    throw new Error(details ? `Prisma migrate deploy 失败: ${details}` : 'Prisma migrate deploy 失败')
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

function isPrismaP3005Error(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  const { details } = extractCommandOutput(error)
  return /P3005/.test(`${message}\n${details}`)
}

function syncPrismaSchema(dbPath: string) {
  const nodeEnv = process.env.NODE_ENV || 'development'
  const hasMigrations = fs.existsSync(PRISMA_MIGRATIONS_DIR)

  // 生产环境优先使用版本化迁移；只有存量库（有表但无迁移历史）回退到 db push。
  if (nodeEnv === 'production' && hasMigrations) {
    try {
      migratePrismaSchema(dbPath)
      return
    } catch (error) {
      if (!isPrismaP3005Error(error)) {
        throw error
      }

      console.warn(
        '[bootstrap] 检测到存量数据库（无 Prisma 迁移历史），回退到 db push 同步 schema；' +
          '建议后续为存量库执行 prisma migrate resolve 补建迁移基线。',
      )
    }
  }

  pushPrismaSchema(dbPath)
}

function ensureProjectsTable(dbPath: string) {
  runSqlite(
    dbPath,
    `
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
    `,
  )
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

  // 启用 WAL 日志模式：读不阻塞写、写不阻塞读，显著降低并发下的 database is locked。
  // WAL 是数据库文件的持久属性，设置一次后 Prisma 连接自动继承。
  try {
    runSqlite(dbPath, 'PRAGMA journal_mode=WAL;')
    runSqlite(dbPath, 'PRAGMA busy_timeout=5000;')
  } catch (error) {
    // 部分只读场景（如备份挂载）可能无法设置，不阻塞启动
    console.warn('启用 SQLite WAL 失败（可忽略，若为只读挂载请忽略）:', error)
  }

  if (tableExists(dbPath, 'activation_codes')) {
    ensureActivationCodeCompatibility(dbPath)
    ensureProjectsTable(dbPath)
    backfillActivationCodesProject(dbPath, ensureDefaultProjectRow(dbPath))
  }

  syncPrismaSchema(dbPath)

  const missingTables = REQUIRED_TABLES.filter((tableName) => !tableExists(dbPath, tableName))
  if (missingTables.length > 0) {
    throw new Error(`数据库表创建失败: ${missingTables.join(', ')}`)
  }
}

function findDefaultProjectId(dbPath: string) {
  const projectId = querySingleValue(
    dbPath,
    `SELECT "id" FROM "projects" WHERE "projectKey" = '${DEFAULT_PROJECT_KEY}' LIMIT 1;`,
  )

  return projectId ? Number(projectId) : null
}

function ensureDefaultProjectRow(dbPath: string) {
  const existingProjectId = findDefaultProjectId(dbPath)

  if (existingProjectId !== null) {
    return existingProjectId
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

  const createdProjectId = findDefaultProjectId(dbPath)

  if (createdProjectId === null) {
    throw new Error('默认项目创建失败')
  }

  return createdProjectId
}

export function ensureDefaultProject(
  dbPath: string = DEFAULT_DB_PATH,
  logger: BootstrapLogger = console,
) {
  ensureSchema(dbPath)
  const existingProjectId = findDefaultProjectId(dbPath)

  if (existingProjectId !== null) {
    logger.log('默认项目已存在，跳过初始化')
    return existingProjectId
  }

  const projectId = ensureDefaultProjectRow(dbPath)

  logger.log(`✅ 默认项目创建成功: ${DEFAULT_PROJECT_NAME} (${DEFAULT_PROJECT_KEY})`)

  return projectId
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

async function ensureDefaultSystemConfigsInternal(
  dbPath: string,
  logger: BootstrapLogger,
) {
  const defaultProjectId = ensureDefaultProjectRow(dbPath)
  backfillActivationCodesProject(dbPath, defaultProjectId)

  const existingKeys = new Set(queryLines(dbPath, 'SELECT "key" FROM "system_configs";'))
  const systemConfigsToSeed = buildDefaultSystemConfigs()

  if (
    process.env.NODE_ENV === 'production' &&
    !existingKeys.has('jwtSecret') &&
    !systemConfigsToSeed.some((config) => config.key === 'jwtSecret')
  ) {
    throw new Error('生产环境初始化失败：请先提供 JWT_SECRET，或在数据库中显式配置 jwtSecret')
  }

  const missingConfigs = systemConfigsToSeed.filter(({ key }) => !existingKeys.has(key))

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

export async function ensureDefaultSystemConfigs(
  dbPath: string = DEFAULT_DB_PATH,
  logger: BootstrapLogger = console,
) {
  ensureSchema(dbPath)
  await ensureDefaultSystemConfigsInternal(dbPath, logger)
}

async function ensureDefaultAdminInternal(dbPath: string, logger: BootstrapLogger) {
  const defaultProjectId = ensureDefaultProjectRow(dbPath)
  backfillActivationCodesProject(dbPath, defaultProjectId)

  const adminCount = Number(querySingleValue(dbPath, 'SELECT COUNT(*) FROM "admins";'))
  if (adminCount > 0) {
    logger.log('管理员账号已存在，跳过初始化')
    return
  }

  const nodeEnv = process.env.NODE_ENV || 'development'
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || DEFAULT_ADMIN_PASSWORD

  if (nodeEnv === 'production' && !process.env.ADMIN_INITIAL_PASSWORD) {
    throw new Error(
      '生产环境初始化失败：未设置 ADMIN_INITIAL_PASSWORD。\n' +
      '请通过环境变量 ADMIN_INITIAL_PASSWORD 设置管理员初始密码，\n' +
      '或创建一个已有管理员的数据库文件再启动。',
    )
  }

  const bcryptRounds = Number(defaultConfigValues.bcryptRounds)
  const hashedPassword = await bcrypt.hash(adminPassword, bcryptRounds)

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
  logger.log(`${nodeEnv === 'production' ? '' : `密码: ${adminPassword}`}`)
  logger.log('请登录后及时修改密码！')
}

async function bootstrapDatabase({
  dbPath,
  logger,
  completionLabel,
}: {
  dbPath: string
  logger: BootstrapLogger
  completionLabel: string
}) {
  ensureSchema(dbPath)
  const defaultProjectId = ensureDefaultProjectRow(dbPath)
  backfillActivationCodesProject(dbPath, defaultProjectId)
  await ensureDefaultSystemConfigsInternal(dbPath, logger)
  await ensureDefaultAdminInternal(dbPath, logger)
  logger.log(`✅ ${completionLabel}: ${dbPath}`)
}

export async function ensureDefaultAdmin(
  dbPath: string = DEFAULT_DB_PATH,
  logger: BootstrapLogger = console,
) {
  ensureSchema(dbPath)
  await ensureDefaultAdminInternal(dbPath, logger)
}

export async function bootstrapDevelopmentDatabase({
  dbPath = DEFAULT_DB_PATH,
  logger = console,
}: {
  dbPath?: string
  logger?: BootstrapLogger
} = {}) {
  await bootstrapDatabase({
    dbPath,
    logger,
    completionLabel: '开发环境初始化完成',
  })
}

export async function bootstrapRuntimeDatabase({
  dbPath = DEFAULT_DB_PATH,
  logger = console,
}: {
  dbPath?: string
  logger?: BootstrapLogger
} = {}) {
  await bootstrapDatabase({
    dbPath,
    logger,
    completionLabel: '运行环境初始化完成',
  })
}
