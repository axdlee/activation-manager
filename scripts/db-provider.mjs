#!/usr/bin/env node
// 切换 prisma/schema.prisma datasource provider：sqlite <-> postgresql
// 用法：npm run db:provider -- postgresql   或   npm run db:provider -- sqlite
// 注意：切换 provider 后必须重新 npx prisma generate；PG 初始化走
// bootstrapRuntimeDatabase（内部自动 db push + generate），勿用 prisma/migrations。
import fs from 'node:fs'
import path from 'node:path'

const target = process.argv[2]
if (target !== 'sqlite' && target !== 'postgresql') {
  console.error('用法: node scripts/db-provider.mjs <sqlite|postgresql>')
  process.exit(1)
}

const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma')
const text = fs.readFileSync(schemaPath, 'utf8')
const providerRe = /(provider\s*=\s*")(sqlite|postgresql)(")/

if (!providerRe.test(text)) {
  console.error('未在 prisma/schema.prisma 中找到 datasource provider 声明')
  process.exit(1)
}

fs.writeFileSync(schemaPath, text.replace(providerRe, `$1${target}$3`))
console.log(`✅ schema.prisma datasource provider -> ${target}`)

if (target === 'postgresql') {
  console.log('提示: PostgreSQL 初始化请执行 `npm run bootstrap:runtime`（自动 db push + generate + 种子）。')
  console.log('提示: prisma/migrations 为 sqlite 方言迁移历史，对 PostgreSQL 请勿执行 prisma migrate deploy。')
} else {
  console.log('提示: 切回 sqlite 后请执行 `npx prisma generate`，再按需执行 `npm run db:push` 或 `npm run bootstrap:runtime`。')
}
