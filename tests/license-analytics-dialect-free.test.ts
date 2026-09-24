/**
 * 批次4（v2.9.0 复查高危项 3）集成回归：三统计接口方言无关 + 软删除过滤。
 *
 * 真实 SQLite 库上跑 getActivationCodeStats / listProjectStats /
 * getLicenseConsumptionTrend：修复前走 SQLite 方言原生 SQL（PG 必挂），
 * 修复后统一 Prisma+JS 聚合；软删除码不得计入任何统计。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { prisma } from '../src/lib/db'
import { bootstrapDevelopmentDatabase } from '../src/lib/dev-bootstrap'
import { generateActivationCodes } from '../src/lib/license-generation-service'
import {
  consumeLicense,
} from '../src/lib/license-service'
import {
  getActivationCodeStats,
  getLicenseConsumptionTrend,
  listProjectStats,
} from '../src/lib/license-analytics-service'

const silentLogger = { log: () => undefined, error: () => undefined }
const machineId = `analytics-machine-${Date.now()}`

test.before(async () => {
  await bootstrapDevelopmentDatabase({ logger: silentLogger })
})

test.after(async () => {
  await prisma.$disconnect()
})

test.afterEach(async () => {
  // 清理顺序严格按 FK 依赖：消费流水/绑定历史 → 码 → 项目
  await prisma.licenseConsumption.deleteMany({ where: { machineId: { startsWith: machineId } } })
  const project = await prisma.project.findUnique({ where: { projectKey: 'analytics-dialect' } })
  if (project) {
    await prisma.activationCodeBindingHistory.deleteMany({ where: { projectId: project.id } })
  }
  await prisma.activationCode.deleteMany({ where: { project: { projectKey: 'analytics-dialect' } } })
  await prisma.project.deleteMany({ where: { projectKey: 'analytics-dialect' } })
})

async function seedAnalyticsProject() {
  const project = await prisma.project.create({
    data: {
      name: '统计方言回归项目',
      projectKey: 'analytics-dialect',
      isEnabled: true,
    },
  })

  // 3 张 TIME 码（激活 1 张：usedAt+validDays 30 天 → active）
  const timeCodes = await generateActivationCodes(prisma, {
    projectKey: 'analytics-dialect',
    amount: 3,
    licenseMode: 'TIME',
    validDays: 30,
  })
  await prisma.activationCode.update({
    where: { id: timeCodes[0].id },
    data: { isUsed: true, usedAt: new Date(), usedBy: machineId },
  })

  // 2 张 COUNT 码（10 次，消耗 1 张 1 次 → active + 消费流水）
  const countCodes = await generateActivationCodes(prisma, {
    projectKey: 'analytics-dialect',
    amount: 2,
    licenseMode: 'COUNT',
    totalCount: 10,
    cardType: '次卡',
  })
  // COUNT 消费用独立机器号：同项目 @@unique([projectId, usedBy])，
  // TIME 码已占用 machineId，复用会触发设备冲突 409
  const countMachineId = `${machineId}-count`
  const consumeResult = await consumeLicense(prisma, {
    projectKey: 'analytics-dialect',
    code: countCodes[0].code,
    machineId: countMachineId,
    // 带 requestId 才会写 license_consumptions 流水（趋势统计的数据源）
    requestId: `analytics-req-${Date.now()}`,
  })
  assert.equal(consumeResult.success, true)

  // 1 张软删除码（绑定历史 → 物理删除受限 → 走 deletedAt 路径）
  const softDeleteTarget = timeCodes[1]
  await prisma.activationCodeBindingHistory.create({
    data: {
      activationCodeId: softDeleteTarget.id,
      projectId: project.id,
      eventType: 'BOUND',
      operatorType: 'LICENSE',
      toMachineId: `${machineId}-legacy`,
    },
  })
  await prisma.activationCode.update({
    where: { id: softDeleteTarget.id },
    data: { deletedAt: new Date() },
  })

  return { project, timeCodes, countCodes, softDeleteTarget }
}

test('三统计接口：方言无关路径返回正确口径，软删除码不计入', async () => {
  const { project } = await seedAnalyticsProject()

  // 1. 总览：项目内 5 张实体码（3 TIME + 2 COUNT），1 张软删除 → 4 张可见
  const allStats = await getActivationCodeStats(prisma)
  const projectCodes = await prisma.activationCode.findMany({
    where: { projectId: project.id, deletedAt: null },
  })
  assert.equal(projectCodes.length, 4, '软删除码应被服务端 where 排除')
  // 全库统计含其他用例残留，只断言本项目口径经 listProjectStats 验证
  assert.ok(allStats.total >= 4)

  // 2. 项目统计
  const rows = await listProjectStats(prisma)
  const row = rows.find((item) => item.projectKey === 'analytics-dialect')
  assert.ok(row, '项目统计应包含目标项目')
  assert.equal(row!.totalCodes, 4, '软删除码不计入 totalCodes')
  assert.equal(row!.usedCodes, 2, 'TIME 激活 1 + COUNT 消耗 1')
  assert.equal(row!.activeCodes, 4, 'TIME 激活未到期 1 + TIME 未使用 1 + COUNT 有剩余 2')
  assert.equal(row!.countRemainingTotal, 19, 'COUNT 2 张各 10 次，1 张已耗 1 次')
  assert.equal(row!.countConsumedTotal, 1)

  // 3. 消费趋势：本机 1 条消费流水应落在今日桶
  const trend = await getLicenseConsumptionTrend(prisma, {
    projectKey: 'analytics-dialect',
    days: 7,
  })
  assert.equal(trend.totalConsumptions, 1)
  const todayKey = new Date().toISOString().slice(0, 10)
  const todayPoint = trend.points.find((point) => point.date === todayKey)
  assert.ok(todayPoint, '应存在今日桶')
  assert.equal(todayPoint!.count, 1)
})
