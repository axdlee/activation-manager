import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import bcrypt from 'bcryptjs'

import { prisma } from './db'
import {
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_USERNAME,
  DEFAULT_PROJECT_KEY,
  DEFAULT_PROJECT_NAME,
} from './dev-bootstrap-shared'
import {
  buildDefaultSystemConfigs,
  defaultConfigValues,
  stringifyConfigValue,
} from './system-config-defaults'

type BootstrapLogger = Pick<Console, 'log' | 'error'>

const PRISMA_SCHEMA_PATH = path.join(process.cwd(), 'prisma', 'schema.prisma')

/** 识别 PostgreSQL 连接串（postgres:// 或 postgresql://） */
export function isPostgresDatabaseUrl(databaseUrl: string | undefined | null) {
  return /^postgres(ql)?:\/\//i.test(databaseUrl?.trim() || '')
}

/** 读取 schema.prisma 中 datasource 的 provider 声明 */
export function readSchemaProvider(schemaText: string = fs.readFileSync(PRISMA_SCHEMA_PATH, 'utf8')) {
  const match = schemaText.match(/provider\s*=\s*"(sqlite|postgresql)"/)
  return match?.[1] ?? null
}

function resolvePrismaCommand() {
  const localPrismaBinary = path.join(
    process.cwd(),
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'prisma.cmd' : 'prisma',
  )

  if (fs.existsSync(localPrismaBinary)) {
    return localPrismaBinary
  }

  return process.platform === 'win32' ? 'npx.cmd' : 'npx'
}

function runPrismaCommand(args: string[]) {
  const command = resolvePrismaCommand()
  const finalArgs = command.endsWith('npx') || command.endsWith('npx.cmd')
    ? ['prisma', ...args]
    : args

  return execFileSync(command, finalArgs, {
    encoding: 'utf8',
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/**
 * PostgreSQL 走 db push 同步 schema：prisma/migrations 目录保存的是 sqlite
 * 方言迁移（migration_lock.toml 锁定 sqlite），对 PG 执行 migrate deploy 会被拒绝。
 * db push 后重新 generate，保证生成的客户端与 provider 一致。
 *
 * 数据安全：一律不带 --accept-data-loss——空库首次初始化自然成功；
 * 存量库做加列等兼容变更也会成功；一旦 push 需要"删列/删表"等破坏性
 * 变更，prisma 会以非交互错误退出，绝不静默清掉生产数据。
 */
export async function ensurePostgresSchema(logger: BootstrapLogger = console) {
  if (readSchemaProvider() !== 'postgresql') {
    throw new Error(
      'PostgreSQL 初始化失败：prisma/schema.prisma 的 datasource provider 仍为 sqlite。\n' +
      '请先执行 `npm run db:provider -- postgresql` 切换 provider，再重新初始化。',
    )
  }

  logger.log('[bootstrap] PostgreSQL: 正在通过 prisma db push 同步 schema（拒绝破坏性变更）…')
  runPrismaCommand(['db', 'push', '--skip-generate'])

  logger.log('[bootstrap] PostgreSQL: 正在重新生成 Prisma Client…')
  runPrismaCommand(['generate'])
}

async function postgresTableExists(tableName: string) {
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count
    FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = ${tableName}
  `

  return Number(rows[0]?.count ?? 0) > 0
}

/**
 * 所有种子写入前必须确认对应表存在，避免在半初始化库上
 * 用不完整的 schema 覆盖式写入。
 */
async function requirePostgresTable(tableName: string) {
  if (!(await postgresTableExists(tableName))) {
    throw new Error(`PostgreSQL 初始化失败：缺少必需的表 "${tableName}"（schema 同步可能未完成）`)
  }
}

export async function ensurePostgresDefaultProjectRow() {
  await requirePostgresTable('projects')

  const selectId = async () => {
    const rows = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT "id" FROM "projects" WHERE "projectKey" = ${DEFAULT_PROJECT_KEY} LIMIT 1
    `
    return rows.length > 0 ? Number(rows[0].id) : null
  }

  const existingProjectId = await selectId()
  if (existingProjectId !== null) {
    return existingProjectId
  }

  await prisma.$executeRaw`
    INSERT INTO "projects" ("name", "projectKey", "description", "isEnabled", "createdAt", "updatedAt")
    VALUES (
      ${DEFAULT_PROJECT_NAME},
      ${DEFAULT_PROJECT_KEY},
      '系统兼容默认项目',
      true,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("projectKey") DO NOTHING
  `

  const createdProjectId = await selectId()
  if (createdProjectId === null) {
    throw new Error('默认项目创建失败')
  }

  return createdProjectId
}

export async function backfillPostgresActivationCodesProject(projectId: number) {
  await requirePostgresTable('activation_codes')

  await prisma.$executeRaw`
    UPDATE "activation_codes"
    SET "projectId" = ${projectId}
    WHERE "projectId" IS NULL
       OR "projectId" NOT IN (SELECT "id" FROM "projects")
  `
}

export async function ensurePostgresSystemConfigs(logger: BootstrapLogger) {
  await requirePostgresTable('system_configs')

  const existingRows = await prisma.$queryRaw<Array<{ key: string }>>`
    SELECT "key" FROM "system_configs"
  `
  const existingKeys = new Set(existingRows.map((row) => row.key))
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

  for (const { key, value, description } of missingConfigs) {
    await prisma.$executeRaw`
      INSERT INTO "system_configs" ("key", "value", "description", "createdAt", "updatedAt")
      VALUES (
        ${key},
        ${stringifyConfigValue(value)},
        ${description},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("key") DO NOTHING
    `
  }

  logger.log('✅ 系统配置初始化成功!')
  logger.log('默认配置项：')
  missingConfigs.forEach((config) => {
    logger.log(`- ${config.key}: ${config.description}`)
  })
}

export async function ensurePostgresShopPaymentConfigs(logger: BootstrapLogger) {
  await requirePostgresTable('shop_payment_configs')

  const existingRows = await prisma.$queryRaw<Array<{ provider: string }>>`
    SELECT "provider" FROM "shop_payment_configs"
  `
  const existing = new Set(existingRows.map((row) => row.provider))
  const seeds = [
    { provider: 'manual', configJson: '{}', isEnabled: true },
    { provider: 'webhook', configJson: '{}', isEnabled: false },
    { provider: 'yipay', configJson: '{}', isEnabled: false },
    { provider: 'wechat', configJson: '{}', isEnabled: false },
    { provider: 'alipay', configJson: '{}', isEnabled: false },
  ]

  let inserted = false
  for (const seed of seeds) {
    if (existing.has(seed.provider)) {
      continue
    }

    // ON CONFLICT DO NOTHING：并发 bootstrap 时避免唯一约束冲突
    const insertedRows = await prisma.$executeRaw`
      INSERT INTO "shop_payment_configs" ("provider", "configJson", "isEnabled", "createdAt", "updatedAt")
      VALUES (
        ${seed.provider},
        ${seed.configJson},
        ${seed.isEnabled},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("provider") DO NOTHING
    `

    if (Number(insertedRows) > 0) {
      inserted = true
    }
  }

  if (inserted) {
    logger.log('✅ 默认支付渠道初始化成功!')
  }
}

export async function ensurePostgresAdmin(logger: BootstrapLogger) {
  await requirePostgresTable('admins')

  const adminRows = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count FROM "admins"
  `
  if (Number(adminRows[0]?.count ?? 0) > 0) {
    logger.log('管理员账号已存在，跳过初始化')
    return
  }

  const nodeEnv = process.env.NODE_ENV || 'development'
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || DEFAULT_ADMIN_PASSWORD

  if (nodeEnv === 'production' && !process.env.ADMIN_INITIAL_PASSWORD) {
    throw new Error(
      '生产环境初始化失败：未设置 ADMIN_INITIAL_PASSWORD。\n' +
      '请通过环境变量 ADMIN_INITIAL_PASSWORD 设置管理员初始密码，\n' +
      '或创建一个已有管理员的数据库后再启动。',
    )
  }

  const bcryptRounds = Number(defaultConfigValues.bcryptRounds)
  const hashedPassword = await bcrypt.hash(adminPassword, bcryptRounds)

  await prisma.$executeRaw`
    INSERT INTO "admins" ("username", "password", "createdAt", "updatedAt")
    VALUES (
      ${DEFAULT_ADMIN_USERNAME},
      ${hashedPassword},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("username") DO NOTHING
  `

  logger.log('✅ 默认管理员账号创建成功!')
  logger.log(`用户名: ${DEFAULT_ADMIN_USERNAME}`)
  logger.log(`${nodeEnv === 'production' ? '' : `密码: ${adminPassword}`}`)
  logger.log('请登录后及时修改密码！')
}

export async function bootstrapPostgresDatabase({
  logger,
  completionLabel,
}: {
  logger: BootstrapLogger
  completionLabel: string
}) {
  await ensurePostgresSchema(logger)
  const defaultProjectId = await ensurePostgresDefaultProjectRow()
  await backfillPostgresActivationCodesProject(defaultProjectId)
  await ensurePostgresSystemConfigs(logger)
  await ensurePostgresShopPaymentConfigs(logger)
  await ensurePostgresAdmin(logger)
  logger.log(`✅ ${completionLabel}: ${process.env.DATABASE_URL}`)
}
