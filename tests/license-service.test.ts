import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { PrismaClient } from '@prisma/client'

import { bootstrapDevelopmentDatabase } from '../src/lib/dev-bootstrap'
import {
  activateLicense,
  consumeLicense,
  generateActivationCodes,
  getLicenseStatus,
  getActivationCodeStats,
  getLicenseConsumptionTrend,
  listProjectStats,
  verifyActivationCode,
} from '../src/lib/license-service'
import {
  listLicenseConsumptions,
  listLicenseConsumptionsPage,
} from '../src/lib/license-consumption-service'
import {
  createProject,
  deleteProject,
  updateProjectDescription,
  updateProjectName,
  updateProjectStatus,
} from '../src/lib/license-project-service'

const silentLogger = {
  log: () => undefined,
  error: () => undefined,
}

async function createTestPrisma() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'activation-manager-license-'))
  const dbPath = path.join(tempDir, 'dev.db')

  await bootstrapDevelopmentDatabase({
    dbPath,
    logger: silentLogger,
  })

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: `file:${dbPath}`,
      },
    },
  })

  return { prisma, dbPath }
}

test('同一机器可在不同项目下分别激活时间型激活码', async () => {
  const { prisma } = await createTestPrisma()

  try {
    await createProject(prisma, {
      name: '插件 A',
      projectKey: 'plugin-a',
    })
    await createProject(prisma, {
      name: '插件 B',
      projectKey: 'plugin-b',
    })

    const [projectACode] = await generateActivationCodes(prisma, {
      projectKey: 'plugin-a',
      amount: 1,
      licenseMode: 'TIME',
      validDays: 30,
      cardType: '月卡',
    })
    const [projectBCode] = await generateActivationCodes(prisma, {
      projectKey: 'plugin-b',
      amount: 1,
      licenseMode: 'TIME',
      validDays: 30,
      cardType: '月卡',
    })

    const firstActivation = await verifyActivationCode(prisma, {
      projectKey: 'plugin-a',
      code: projectACode.code,
      machineId: 'machine-001',
    })
    const secondActivation = await verifyActivationCode(prisma, {
      projectKey: 'plugin-b',
      code: projectBCode.code,
      machineId: 'machine-001',
    })

    assert.equal(firstActivation.success, true)
    assert.equal(secondActivation.success, true)
  } finally {
    await prisma.$disconnect()
  }
})

test('次数型激活码会在每次验证时递减剩余次数', async () => {
  const { prisma } = await createTestPrisma()

  try {
    await createProject(prisma, {
      name: '浏览器插件',
      projectKey: 'browser-plugin',
    })

    const [countCode] = await generateActivationCodes(prisma, {
      projectKey: 'browser-plugin',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 2,
      cardType: '2次卡',
    })

    const firstUse = await verifyActivationCode(prisma, {
      projectKey: 'browser-plugin',
      code: countCode.code,
      machineId: 'machine-001',
    })
    const secondUse = await verifyActivationCode(prisma, {
      projectKey: 'browser-plugin',
      code: countCode.code,
      machineId: 'machine-001',
    })
    const thirdUse = await verifyActivationCode(prisma, {
      projectKey: 'browser-plugin',
      code: countCode.code,
      machineId: 'machine-001',
    })

    assert.equal(firstUse.success, true)
    assert.equal(firstUse.remainingCount, 1)
    assert.equal(secondUse.success, true)
    assert.equal(secondUse.remainingCount, 0)
    assert.equal(thirdUse.success, false)
    assert.equal(thirdUse.message, '激活码可用次数已用完')
  } finally {
    await prisma.$disconnect()
  }
})

test('activateLicense 对次数型激活码只绑定设备不扣减次数', async () => {
  const { prisma } = await createTestPrisma()

  try {
    await createProject(prisma, {
      name: '扩展插件',
      projectKey: 'extension-plugin',
    })

    const [countCode] = await generateActivationCodes(prisma, {
      projectKey: 'extension-plugin',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 5,
      cardType: '5次卡',
    })

    const activationResult = await activateLicense(prisma, {
      projectKey: 'extension-plugin',
      code: countCode.code,
      machineId: 'machine-activate-001',
    })
    const statusResult = await getLicenseStatus(prisma, {
      projectKey: 'extension-plugin',
      code: countCode.code,
      machineId: 'machine-activate-001',
    })

    assert.equal(activationResult.success, true)
    assert.equal(activationResult.remainingCount, 5)
    assert.equal(statusResult.success, true)
    assert.equal(statusResult.remainingCount, 5)
    assert.equal(statusResult.isActivated, true)
  } finally {
    await prisma.$disconnect()
  }
})

test('consumeLicense 对相同 requestId 只扣减一次', async () => {
  const { prisma } = await createTestPrisma()

  try {
    await createProject(prisma, {
      name: '浏览器插件幂等',
      projectKey: 'browser-plugin-idempotent',
    })

    const [countCode] = await generateActivationCodes(prisma, {
      projectKey: 'browser-plugin-idempotent',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 2,
      cardType: '2次卡',
    })

    const firstConsume = await consumeLicense(prisma, {
      projectKey: 'browser-plugin-idempotent',
      code: countCode.code,
      machineId: 'machine-idempotent-001',
      requestId: 'req-001',
    })
    const secondConsume = await consumeLicense(prisma, {
      projectKey: 'browser-plugin-idempotent',
      code: countCode.code,
      machineId: 'machine-idempotent-001',
      requestId: 'req-001',
    })
    const thirdConsume = await consumeLicense(prisma, {
      projectKey: 'browser-plugin-idempotent',
      code: countCode.code,
      machineId: 'machine-idempotent-001',
      requestId: 'req-002',
    })

    assert.equal(firstConsume.success, true)
    assert.equal(firstConsume.remainingCount, 1)
    assert.equal(secondConsume.success, true)
    assert.equal(secondConsume.remainingCount, 1)
    assert.equal(secondConsume.idempotent, true)
    assert.equal(thirdConsume.success, true)
    assert.equal(thirdConsume.remainingCount, 0)
  } finally {
    await prisma.$disconnect()
  }
})

test('listLicenseConsumptions 会返回最新消费记录并附带项目与激活码信息', async () => {
  const { prisma } = await createTestPrisma()

  try {
    await createProject(prisma, {
      name: '消费日志项目',
      projectKey: 'consumption-log-project',
    })

    const [countCode] = await generateActivationCodes(prisma, {
      projectKey: 'consumption-log-project',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 3,
      cardType: '3次卡',
    })

    await consumeLicense(prisma, {
      projectKey: 'consumption-log-project',
      code: countCode.code,
      machineId: 'machine-log-001',
      requestId: 'log-req-001',
    })

    await new Promise((resolve) => setTimeout(resolve, 10))

    await consumeLicense(prisma, {
      projectKey: 'consumption-log-project',
      code: countCode.code,
      machineId: 'machine-log-001',
      requestId: 'log-req-002',
    })

    const logs = await listLicenseConsumptions(prisma)

    assert.equal(logs.length, 2)
    assert.equal(logs[0].requestId, 'log-req-002')
    assert.equal(logs[0].machineId, 'machine-log-001')
    assert.equal(logs[0].remainingCountAfter, 1)
    assert.equal(logs[0].activationCode.code, countCode.code)
    assert.equal(logs[0].activationCode.project.projectKey, 'consumption-log-project')
    assert.equal(logs[1].requestId, 'log-req-001')
    assert.equal(logs[1].remainingCountAfter, 2)
  } finally {
    await prisma.$disconnect()
  }
})

test('listLicenseConsumptions 可按项目过滤消费记录', async () => {
  const { prisma } = await createTestPrisma()

  try {
    await createProject(prisma, {
      name: '项目 A',
      projectKey: 'consumption-project-a',
    })
    await createProject(prisma, {
      name: '项目 B',
      projectKey: 'consumption-project-b',
    })

    const [projectACode] = await generateActivationCodes(prisma, {
      projectKey: 'consumption-project-a',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 2,
      cardType: '2次卡',
    })
    const [projectBCode] = await generateActivationCodes(prisma, {
      projectKey: 'consumption-project-b',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 2,
      cardType: '2次卡',
    })

    await consumeLicense(prisma, {
      projectKey: 'consumption-project-a',
      code: projectACode.code,
      machineId: 'machine-a-001',
      requestId: 'project-a-req-001',
    })
    await consumeLicense(prisma, {
      projectKey: 'consumption-project-b',
      code: projectBCode.code,
      machineId: 'machine-b-001',
      requestId: 'project-b-req-001',
    })

    const projectALogs = await listLicenseConsumptions(prisma, {
      projectKey: 'consumption-project-a',
    })

    assert.equal(projectALogs.length, 1)
    assert.equal(projectALogs[0].requestId, 'project-a-req-001')
    assert.equal(projectALogs[0].activationCode.project.projectKey, 'consumption-project-a')
  } finally {
    await prisma.$disconnect()
  }
})

test('listLicenseConsumptions 允许查询已停用项目的消费记录', async () => {
  const { prisma } = await createTestPrisma()

  try {
    const project = await createProject(prisma, {
      name: '已停用消费项目',
      projectKey: 'disabled-consumption-project',
    })

    const [countCode] = await generateActivationCodes(prisma, {
      projectKey: 'disabled-consumption-project',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 2,
      cardType: '2次卡',
    })

    await consumeLicense(prisma, {
      projectKey: 'disabled-consumption-project',
      code: countCode.code,
      machineId: 'machine-disabled-001',
      requestId: 'disabled-req-001',
    })

    await updateProjectStatus(prisma, {
      id: project.id,
      isEnabled: false,
    })

    const logs = await listLicenseConsumptions(prisma, {
      projectKey: 'disabled-consumption-project',
    })

    assert.equal(logs.length, 1)
    assert.equal(logs[0].requestId, 'disabled-req-001')
    assert.equal(logs[0].activationCode.project.projectKey, 'disabled-consumption-project')
  } finally {
    await prisma.$disconnect()
  }
})

test('listLicenseConsumptions 可按关键字过滤 requestId、机器ID 与激活码', async () => {
  const { prisma } = await createTestPrisma()

  try {
    await createProject(prisma, {
      name: '关键字过滤项目',
      projectKey: 'keyword-consumption-project',
    })

    const [countCode] = await generateActivationCodes(prisma, {
      projectKey: 'keyword-consumption-project',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 3,
      cardType: '3次卡',
    })

    await consumeLicense(prisma, {
      projectKey: 'keyword-consumption-project',
      code: countCode.code,
      machineId: 'machine-keyword-001',
      requestId: 'keyword-req-001',
    })
    await consumeLicense(prisma, {
      projectKey: 'keyword-consumption-project',
      code: countCode.code,
      machineId: 'machine-keyword-001',
      requestId: 'keyword-req-002',
    })

    const requestIdLogs = await listLicenseConsumptions(prisma, {
      keyword: 'req-002',
    })
    const machineLogs = await listLicenseConsumptions(prisma, {
      keyword: 'MACHINE-KEYWORD-001',
    })
    const codeLogs = await listLicenseConsumptions(prisma, {
      keyword: countCode.code.toLowerCase(),
    })

    assert.equal(requestIdLogs.length, 1)
    assert.equal(requestIdLogs[0].requestId, 'keyword-req-002')

    assert.equal(machineLogs.length, 2)
    assert.equal(machineLogs[0].machineId, 'machine-keyword-001')
    assert.equal(machineLogs[1].machineId, 'machine-keyword-001')

    assert.equal(codeLogs.length, 2)
    assert.equal(codeLogs[0].activationCode.code, countCode.code)
    assert.equal(codeLogs[1].activationCode.code, countCode.code)
  } finally {
    await prisma.$disconnect()
  }
})

test('listLicenseConsumptions 可按消费时间范围过滤记录', async () => {
  const { prisma } = await createTestPrisma()

  try {
    await createProject(prisma, {
      name: '时间范围过滤项目',
      projectKey: 'range-consumption-project',
    })

    const [countCode] = await generateActivationCodes(prisma, {
      projectKey: 'range-consumption-project',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 3,
      cardType: '3次卡',
    })

    await consumeLicense(prisma, {
      projectKey: 'range-consumption-project',
      code: countCode.code,
      machineId: 'machine-range-001',
      requestId: 'range-req-001',
    })
    await consumeLicense(prisma, {
      projectKey: 'range-consumption-project',
      code: countCode.code,
      machineId: 'machine-range-001',
      requestId: 'range-req-002',
    })

    await prisma.licenseConsumption.update({
      where: {
        requestId: 'range-req-001',
      },
      data: {
        createdAt: new Date('2026-01-10T08:00:00.000Z'),
      },
    })
    await prisma.licenseConsumption.update({
      where: {
        requestId: 'range-req-002',
      },
      data: {
        createdAt: new Date('2026-02-15T08:00:00.000Z'),
      },
    })

    const januaryLogs = await listLicenseConsumptions(prisma, {
      createdFrom: '2026-01-01T00:00:00.000Z',
      createdTo: '2026-01-31T23:59:59.999Z',
    })

    assert.equal(januaryLogs.length, 1)
    assert.equal(januaryLogs[0].requestId, 'range-req-001')
  } finally {
    await prisma.$disconnect()
  }
})

test('listLicenseConsumptionsPage 会在服务端按条件过滤并分页返回记录', async () => {
  const { prisma } = await createTestPrisma()

  try {
    await createProject(prisma, {
      name: '服务端分页项目',
      projectKey: 'consumption-page-project',
    })
    await createProject(prisma, {
      name: '其他分页项目',
      projectKey: 'other-consumption-page-project',
    })

    const [pageCode] = await generateActivationCodes(prisma, {
      projectKey: 'consumption-page-project',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 4,
      cardType: '4次卡',
    })
    const [otherCode] = await generateActivationCodes(prisma, {
      projectKey: 'other-consumption-page-project',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 1,
      cardType: '单次卡',
    })

    await consumeLicense(prisma, {
      projectKey: 'consumption-page-project',
      code: pageCode.code,
      machineId: 'machine-page-001',
      requestId: 'page-req-001',
    })
    await consumeLicense(prisma, {
      projectKey: 'consumption-page-project',
      code: pageCode.code,
      machineId: 'machine-page-001',
      requestId: 'page-req-002',
    })
    await consumeLicense(prisma, {
      projectKey: 'consumption-page-project',
      code: pageCode.code,
      machineId: 'machine-page-001',
      requestId: 'page-req-003',
    })
    await consumeLicense(prisma, {
      projectKey: 'other-consumption-page-project',
      code: otherCode.code,
      machineId: 'machine-other-page-001',
      requestId: 'other-page-req-001',
    })

    await prisma.licenseConsumption.update({
      where: {
        requestId: 'page-req-001',
      },
      data: {
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
      },
    })
    await prisma.licenseConsumption.update({
      where: {
        requestId: 'page-req-002',
      },
      data: {
        createdAt: new Date('2026-03-02T00:00:00.000Z'),
      },
    })
    await prisma.licenseConsumption.update({
      where: {
        requestId: 'page-req-003',
      },
      data: {
        createdAt: new Date('2026-03-03T00:00:00.000Z'),
      },
    })

    const result = await listLicenseConsumptionsPage(prisma, {
      projectKey: 'consumption-page-project',
      keyword: 'page-req',
      createdFrom: '2026-03-01T00:00:00.000Z',
      createdTo: '2026-03-31T23:59:59.999Z',
      page: 2,
      pageSize: 1,
    })

    assert.equal(result.pagination.total, 3)
    assert.equal(result.pagination.page, 2)
    assert.equal(result.pagination.pageSize, 1)
    assert.equal(result.pagination.totalPages, 3)
    assert.equal(result.logs.length, 1)
    assert.equal(result.logs[0]?.requestId, 'page-req-002')
  } finally {
    await prisma.$disconnect()
  }
})

test('getLicenseConsumptionTrend 会按天补齐空桶并支持按项目过滤', async () => {
  const { prisma } = await createTestPrisma()

  try {
    await createProject(prisma, {
      name: '趋势项目 A',
      projectKey: 'trend-project-a',
    })
    await createProject(prisma, {
      name: '趋势项目 B',
      projectKey: 'trend-project-b',
    })

    const [projectACode] = await generateActivationCodes(prisma, {
      projectKey: 'trend-project-a',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 5,
      cardType: '5次卡',
    })
    const [projectBCode] = await generateActivationCodes(prisma, {
      projectKey: 'trend-project-b',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 2,
      cardType: '2次卡',
    })

    await consumeLicense(prisma, {
      projectKey: 'trend-project-a',
      code: projectACode.code,
      machineId: 'machine-trend-a-001',
      requestId: 'trend-a-req-001',
    })
    await consumeLicense(prisma, {
      projectKey: 'trend-project-a',
      code: projectACode.code,
      machineId: 'machine-trend-a-001',
      requestId: 'trend-a-req-002',
    })
    await consumeLicense(prisma, {
      projectKey: 'trend-project-b',
      code: projectBCode.code,
      machineId: 'machine-trend-b-001',
      requestId: 'trend-b-req-001',
    })

    await prisma.licenseConsumption.update({
      where: {
        requestId: 'trend-a-req-001',
      },
      data: {
        createdAt: new Date('2026-03-20T08:00:00.000Z'),
      },
    })
    await prisma.licenseConsumption.update({
      where: {
        requestId: 'trend-a-req-002',
      },
      data: {
        createdAt: new Date('2026-03-22T08:00:00.000Z'),
      },
    })
    await prisma.licenseConsumption.update({
      where: {
        requestId: 'trend-b-req-001',
      },
      data: {
        createdAt: new Date('2026-03-22T09:00:00.000Z'),
      },
    })

    const trend = await getLicenseConsumptionTrend(prisma, {
      projectKey: 'trend-project-a',
      days: 7,
      now: new Date('2026-03-24T12:00:00.000Z'),
    })

    assert.equal(trend.days, 7)
    assert.equal(trend.totalConsumptions, 2)
    assert.equal(trend.maxDailyConsumptions, 1)
    assert.deepEqual(trend.points, [
      { date: '2026-03-18', label: '03-18', count: 0 },
      { date: '2026-03-19', label: '03-19', count: 0 },
      { date: '2026-03-20', label: '03-20', count: 1 },
      { date: '2026-03-21', label: '03-21', count: 0 },
      { date: '2026-03-22', label: '03-22', count: 1 },
      { date: '2026-03-23', label: '03-23', count: 0 },
      { date: '2026-03-24', label: '03-24', count: 0 },
    ])
  } finally {
    await prisma.$disconnect()
  }
})

test('getLicenseConsumptionTrend 会拒绝非法 days 与不存在项目', async () => {
  const { prisma } = await createTestPrisma()

  try {
    await assert.rejects(
      () =>
        getLicenseConsumptionTrend(prisma, {
          days: 0,
        }),
      /days 必须是 1-90 之间的整数/,
    )

    await assert.rejects(
      () =>
        getLicenseConsumptionTrend(prisma, {
          projectKey: 'missing-project',
        }),
      /项目不存在: missing-project/,
    )
  } finally {
    await prisma.$disconnect()
  }
})

test('getLicenseConsumptionTrend 支持按周和按月聚合', async () => {
  const { prisma } = await createTestPrisma()

  try {
    await createProject(prisma, {
      name: '趋势聚合项目',
      projectKey: 'trend-aggregate-project',
    })

    const [countCode] = await generateActivationCodes(prisma, {
      projectKey: 'trend-aggregate-project',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 8,
      cardType: '8次卡',
    })

    const requestIds = [
      'trend-aggregate-req-001',
      'trend-aggregate-req-002',
      'trend-aggregate-req-003',
      'trend-aggregate-req-004',
      'trend-aggregate-req-005',
    ]

    for (const requestId of requestIds) {
      await consumeLicense(prisma, {
        projectKey: 'trend-aggregate-project',
        code: countCode.code,
        machineId: 'machine-trend-aggregate-001',
        requestId,
      })
    }

    await prisma.licenseConsumption.update({
      where: { requestId: 'trend-aggregate-req-001' },
      data: { createdAt: new Date('2026-03-18T08:00:00.000Z') },
    })
    await prisma.licenseConsumption.update({
      where: { requestId: 'trend-aggregate-req-002' },
      data: { createdAt: new Date('2026-03-20T08:00:00.000Z') },
    })
    await prisma.licenseConsumption.update({
      where: { requestId: 'trend-aggregate-req-003' },
      data: { createdAt: new Date('2026-03-30T08:00:00.000Z') },
    })
    await prisma.licenseConsumption.update({
      where: { requestId: 'trend-aggregate-req-004' },
      data: { createdAt: new Date('2026-04-02T08:00:00.000Z') },
    })
    await prisma.licenseConsumption.update({
      where: { requestId: 'trend-aggregate-req-005' },
      data: { createdAt: new Date('2026-04-08T08:00:00.000Z') },
    })

    const weeklyTrend = await getLicenseConsumptionTrend(prisma, {
      projectKey: 'trend-aggregate-project',
      days: 30,
      granularity: 'week',
      now: new Date('2026-04-10T12:00:00.000Z'),
    })

    const monthlyTrend = await getLicenseConsumptionTrend(prisma, {
      projectKey: 'trend-aggregate-project',
      days: 30,
      granularity: 'month',
      now: new Date('2026-04-10T12:00:00.000Z'),
    })

    assert.equal(weeklyTrend.granularity, 'week')
    assert.equal(weeklyTrend.totalConsumptions, 5)
    assert.equal(weeklyTrend.maxBucketConsumptions, 2)
    assert.deepEqual(weeklyTrend.points, [
      { date: '2026-03-09', label: '03-09~03-15', count: 0 },
      { date: '2026-03-16', label: '03-16~03-22', count: 2 },
      { date: '2026-03-23', label: '03-23~03-29', count: 0 },
      { date: '2026-03-30', label: '03-30~04-05', count: 2 },
      { date: '2026-04-06', label: '04-06~04-12', count: 1 },
    ])

    assert.equal(monthlyTrend.granularity, 'month')
    assert.equal(monthlyTrend.totalConsumptions, 5)
    assert.equal(monthlyTrend.maxBucketConsumptions, 3)
    assert.deepEqual(monthlyTrend.points, [
      { date: '2026-03-01', label: '2026-03', count: 3 },
      { date: '2026-04-01', label: '2026-04', count: 2 },
    ])
  } finally {
    await prisma.$disconnect()
  }
})

test('getLicenseConsumptionTrend 返回当前周期相对上一周期的对比摘要', async () => {
  const { prisma } = await createTestPrisma()

  try {
    await createProject(prisma, {
      name: '趋势对比项目',
      projectKey: 'trend-compare-project',
    })

    const [countCode] = await generateActivationCodes(prisma, {
      projectKey: 'trend-compare-project',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 6,
      cardType: '6次卡',
    })

    const requestIds = [
      'trend-compare-req-001',
      'trend-compare-req-002',
      'trend-compare-req-003',
    ]

    for (const requestId of requestIds) {
      await consumeLicense(prisma, {
        projectKey: 'trend-compare-project',
        code: countCode.code,
        machineId: 'machine-trend-compare-001',
        requestId,
      })
    }

    await prisma.licenseConsumption.update({
      where: { requestId: 'trend-compare-req-001' },
      data: { createdAt: new Date('2026-03-14T08:00:00.000Z') },
    })
    await prisma.licenseConsumption.update({
      where: { requestId: 'trend-compare-req-002' },
      data: { createdAt: new Date('2026-03-20T08:00:00.000Z') },
    })
    await prisma.licenseConsumption.update({
      where: { requestId: 'trend-compare-req-003' },
      data: { createdAt: new Date('2026-03-22T08:00:00.000Z') },
    })

    const trend = await getLicenseConsumptionTrend(prisma, {
      projectKey: 'trend-compare-project',
      days: 7,
      now: new Date('2026-03-24T12:00:00.000Z'),
    })

    assert.deepEqual(trend.comparison, {
      previousRangeStart: '2026-03-11',
      previousRangeEnd: '2026-03-17',
      previousTotalConsumptions: 1,
      changeCount: 1,
      changePercentage: 100,
    })
  } finally {
    await prisma.$disconnect()
  }
})

test('listProjectStats 与 getActivationCodeStats 会返回正确的项目级统计结果', async () => {
  const { prisma } = await createTestPrisma()

  try {
    await createProject(prisma, {
      name: '统计项目 A',
      projectKey: 'stats-project-a',
    })
    await createProject(prisma, {
      name: '统计项目 B',
      projectKey: 'stats-project-b',
    })

    const [timeCodeActive, timeCodeExpired, countCode] = await generateActivationCodes(prisma, {
      projectKey: 'stats-project-a',
      amount: 3,
      licenseMode: 'TIME',
      validDays: 30,
      cardType: '月卡',
    })

    const [countCodeA] = await generateActivationCodes(prisma, {
      projectKey: 'stats-project-a',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 5,
      cardType: '5次卡',
    })

    const [countCodeB] = await generateActivationCodes(prisma, {
      projectKey: 'stats-project-b',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 2,
      cardType: '2次卡',
    })

    await activateLicense(prisma, {
      projectKey: 'stats-project-a',
      code: timeCodeActive.code,
      machineId: 'machine-stats-time-active',
    })

    await activateLicense(prisma, {
      projectKey: 'stats-project-a',
      code: timeCodeExpired.code,
      machineId: 'machine-stats-time-expired',
    })

    await prisma.activationCode.update({
      where: { id: timeCodeExpired.id },
      data: {
        usedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      },
    })

    await activateLicense(prisma, {
      projectKey: 'stats-project-a',
      code: countCodeA.code,
      machineId: 'machine-stats-count-a',
    })
    await consumeLicense(prisma, {
      projectKey: 'stats-project-a',
      code: countCodeA.code,
      machineId: 'machine-stats-count-a',
      requestId: 'stats-project-a-req-001',
    })
    await consumeLicense(prisma, {
      projectKey: 'stats-project-a',
      code: countCodeA.code,
      machineId: 'machine-stats-count-a',
      requestId: 'stats-project-a-req-002',
    })

    await activateLicense(prisma, {
      projectKey: 'stats-project-b',
      code: countCodeB.code,
      machineId: 'machine-stats-count-b',
    })
    await consumeLicense(prisma, {
      projectKey: 'stats-project-b',
      code: countCodeB.code,
      machineId: 'machine-stats-count-b',
      requestId: 'stats-project-b-req-001',
    })

    const overviewStats = await getActivationCodeStats(prisma)
    const projectStats = await listProjectStats(prisma)

    const projectAStats = projectStats.find((item) => item.projectKey === 'stats-project-a')
    const projectBStats = projectStats.find((item) => item.projectKey === 'stats-project-b')

    assert.ok(projectAStats)
    assert.ok(projectBStats)

    assert.equal(overviewStats.total, 5)
    assert.equal(overviewStats.used, 4)
    assert.equal(overviewStats.expired, 1)
    assert.equal(overviewStats.active, 4)

    assert.equal(projectAStats.totalCodes, 4)
    assert.equal(projectAStats.usedCodes, 3)
    assert.equal(projectAStats.activeCodes, 3)
    assert.equal(projectAStats.expiredCodes, 1)
    assert.equal(projectAStats.countRemainingTotal, 3)
    assert.equal(projectAStats.countConsumedTotal, 2)

    assert.equal(projectBStats.totalCodes, 1)
    assert.equal(projectBStats.usedCodes, 1)
    assert.equal(projectBStats.activeCodes, 1)
    assert.equal(projectBStats.expiredCodes, 0)
    assert.equal(projectBStats.countRemainingTotal, 1)
    assert.equal(projectBStats.countConsumedTotal, 1)

    assert.equal(countCode.licenseMode, 'TIME')
  } finally {
    await prisma.$disconnect()
  }
})

test('createProject 会规范化项目名称描述并接受合法 projectKey', async () => {
  const { prisma } = await createTestPrisma()

  try {
    const project = await createProject(prisma, {
      name: '  浏览器插件项目  ',
      projectKey: 'browser-plugin-01',
      description: '  面向浏览器插件的授权空间  ',
    })

    assert.equal(project.name, '浏览器插件项目')
    assert.equal(project.projectKey, 'browser-plugin-01')
    assert.equal(project.description, '面向浏览器插件的授权空间')
    assert.equal(project.isEnabled, true)
  } finally {
    await prisma.$disconnect()
  }
})

test('createProject 会拒绝不符合规范的 projectKey', async () => {
  const { prisma } = await createTestPrisma()

  try {
    await assert.rejects(
      () =>
        createProject(prisma, {
          name: '空项目标识',
          projectKey: '   ',
        }),
      /项目标识不能为空/,
    )

    await assert.rejects(
      () =>
        createProject(prisma, {
          name: '大写项目标识',
          projectKey: 'Browser-Plugin',
        }),
      /项目标识仅支持小写字母、数字和短横线/,
    )

    await assert.rejects(
      () =>
        createProject(prisma, {
          name: '下划线项目标识',
          projectKey: 'browser_plugin',
        }),
      /项目标识仅支持小写字母、数字和短横线/,
    )

    await assert.rejects(
      () =>
        createProject(prisma, {
          name: '中文项目标识',
          projectKey: '浏览器插件',
        }),
      /项目标识仅支持小写字母、数字和短横线/,
    )

    await assert.rejects(
      () =>
        createProject(prisma, {
          name: '前缀短横线项目标识',
          projectKey: '-browser-plugin',
        }),
      /项目标识不能以短横线开头或结尾/,
    )

    await assert.rejects(
      () =>
        createProject(prisma, {
          name: '后缀短横线项目标识',
          projectKey: 'browser-plugin-',
        }),
      /项目标识不能以短横线开头或结尾/,
    )

    await assert.rejects(
      () =>
        createProject(prisma, {
          name: '连续短横线项目标识',
          projectKey: 'browser--plugin',
        }),
      /项目标识不能包含连续短横线/,
    )

    await assert.rejects(
      () =>
        createProject(prisma, {
          name: '过短项目标识',
          projectKey: 'a',
        }),
      /项目标识长度必须在 2-50 个字符之间/,
    )

    await assert.rejects(
      () =>
        createProject(prisma, {
          name: '过长项目标识',
          projectKey: 'a'.repeat(51),
        }),
      /项目标识长度必须在 2-50 个字符之间/,
    )
  } finally {
    await prisma.$disconnect()
  }
})

test('同一项目下绑定新次数卡前会释放已耗尽旧卡的设备绑定', async () => {
  const { prisma } = await createTestPrisma()

  try {
    await createProject(prisma, {
      name: '次数卡复用项目',
      projectKey: 'count-reuse-project',
    })

    const [firstCode, secondCode] = await generateActivationCodes(prisma, {
      projectKey: 'count-reuse-project',
      amount: 2,
      licenseMode: 'COUNT',
      totalCount: 1,
      cardType: '单次卡',
    })

    const firstConsumeResult = await consumeLicense(prisma, {
      projectKey: 'count-reuse-project',
      code: firstCode.code,
      machineId: 'machine-reuse-001',
      requestId: 'reuse-req-001',
    })

    const secondActivateResult = await activateLicense(prisma, {
      projectKey: 'count-reuse-project',
      code: secondCode.code,
      machineId: 'machine-reuse-001',
    })

    const refreshedFirstCode = await prisma.activationCode.findUnique({
      where: { code: firstCode.code },
    })
    const refreshedSecondCode = await prisma.activationCode.findUnique({
      where: { code: secondCode.code },
    })

    assert.equal(firstConsumeResult.success, true)
    assert.equal(firstConsumeResult.remainingCount, 0)
    assert.equal(secondActivateResult.success, true)
    assert.equal(refreshedFirstCode?.usedBy, null)
    assert.equal(refreshedSecondCode?.usedBy, 'machine-reuse-001')
  } finally {
    await prisma.$disconnect()
  }
})

test('updateProjectStatus 可启停项目，但默认项目不可停用', async () => {
  const { prisma } = await createTestPrisma()

  try {
    const createdProject = await createProject(prisma, {
      name: '可启停项目',
      projectKey: 'toggle-project',
    })

    const disabledProject = await updateProjectStatus(prisma, {
      id: createdProject.id,
      isEnabled: false,
    })
    const enabledProject = await updateProjectStatus(prisma, {
      id: createdProject.id,
      isEnabled: true,
    })

    assert.equal(disabledProject.isEnabled, false)
    assert.equal(enabledProject.isEnabled, true)

    await assert.rejects(
      () =>
        updateProjectStatus(prisma, {
          id: 1,
          isEnabled: false,
        }),
      /默认项目不允许停用/,
    )
  } finally {
    await prisma.$disconnect()
  }
})

test('deleteProject 仅允许删除空项目，默认项目和非空项目不可删除', async () => {
  const { prisma } = await createTestPrisma()

  try {
    const emptyProject = await createProject(prisma, {
      name: '空项目',
      projectKey: 'empty-project',
    })
    const nonEmptyProject = await createProject(prisma, {
      name: '非空项目',
      projectKey: 'non-empty-project',
    })

    await generateActivationCodes(prisma, {
      projectKey: 'non-empty-project',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 2,
      cardType: '2次卡',
    })

    await assert.rejects(
      () => deleteProject(prisma, { id: 1 }),
      /默认项目不允许删除/,
    )

    await assert.rejects(
      () => deleteProject(prisma, { id: nonEmptyProject.id }),
      /项目下仍有激活码，无法删除/,
    )

    const deletedProject = await deleteProject(prisma, { id: emptyProject.id })
    const existingProject = await prisma.project.findUnique({
      where: { id: emptyProject.id },
    })

    assert.equal(deletedProject.id, emptyProject.id)
    assert.equal(existingProject, null)
  } finally {
    await prisma.$disconnect()
  }
})

test('updateProjectDescription 会更新项目描述并支持清空描述', async () => {
  const { prisma } = await createTestPrisma()

  try {
    const project = await createProject(prisma, {
      name: '可编辑描述项目',
      projectKey: 'editable-project',
      description: '初始描述',
    })

    const updatedProject = await updateProjectDescription(prisma, {
      id: project.id,
      description: '  更新后的描述  ',
    })
    const clearedProject = await updateProjectDescription(prisma, {
      id: project.id,
      description: '   ',
    })

    assert.equal(updatedProject.description, '更新后的描述')
    assert.equal(clearedProject.description, null)

    await assert.rejects(
      () =>
        updateProjectDescription(prisma, {
          id: 999999,
          description: '不存在项目',
        }),
      /项目不存在/,
    )
  } finally {
    await prisma.$disconnect()
  }
})

test('updateProjectName 会更新项目名称并拒绝空名称与默认项目', async () => {
  const { prisma } = await createTestPrisma()

  try {
    const project = await createProject(prisma, {
      name: '旧项目名称',
      projectKey: 'rename-project',
    })

    const updatedProject = await updateProjectName(prisma, {
      id: project.id,
      name: '  新项目名称  ',
    })

    assert.equal(updatedProject.name, '新项目名称')

    await assert.rejects(
      () =>
        updateProjectName(prisma, {
          id: project.id,
          name: '   ',
        }),
      /项目名称不能为空/,
    )

    await assert.rejects(
      () =>
        updateProjectName(prisma, {
          id: 1,
          name: '修改默认项目名称',
        }),
      /默认项目不允许修改名称/,
    )

    await assert.rejects(
      () =>
        updateProjectName(prisma, {
          id: 999999,
          name: '不存在项目',
        }),
      /项目不存在/,
    )
  } finally {
    await prisma.$disconnect()
  }
})

test('activateLicense 在项目允许自动换绑且无冷却时，会将激活码从旧设备迁移到新设备', async () => {
  const { prisma } = await createTestPrisma()

  try {
    await createProject(prisma, {
      name: '自动换绑项目',
      projectKey: 'auto-rebind-project',
      allowAutoRebind: true,
      autoRebindCooldownMinutes: 0,
    })

    const [timeCode] = await generateActivationCodes(prisma, {
      projectKey: 'auto-rebind-project',
      amount: 1,
      licenseMode: 'TIME',
      validDays: 30,
      cardType: '月卡',
    })

    const firstActivation = await activateLicense(prisma, {
      projectKey: 'auto-rebind-project',
      code: timeCode.code,
      machineId: 'machine-old',
    })
    const rebindActivation = await activateLicense(prisma, {
      projectKey: 'auto-rebind-project',
      code: timeCode.code,
      machineId: 'machine-new',
    })
    const reboundStatus = await getLicenseStatus(prisma, {
      projectKey: 'auto-rebind-project',
      code: timeCode.code,
      machineId: 'machine-new',
    })
    const oldMachineStatus = await getLicenseStatus(prisma, {
      projectKey: 'auto-rebind-project',
      code: timeCode.code,
      machineId: 'machine-old',
    })

    const updatedCode = await prisma.activationCode.findUniqueOrThrow({
      where: {
        id: timeCode.id,
      },
    })

    assert.equal(firstActivation.success, true)
    assert.equal(rebindActivation.success, true)
    assert.equal(reboundStatus.success, true)
    assert.equal(oldMachineStatus.success, false)
    assert.equal(oldMachineStatus.message, '激活码已被其他设备使用')
    assert.equal(updatedCode.usedBy, 'machine-new')
    assert.equal(updatedCode.rebindCount, 1)
    assert.ok(updatedCode.lastRebindAt instanceof Date)
  } finally {
    await prisma.$disconnect()
  }
})

test('activateLicense 在自动换绑冷却期内会返回受限结果', async () => {
  const { prisma } = await createTestPrisma()

  try {
    await createProject(prisma, {
      name: '冷却换绑项目',
      projectKey: 'cooldown-rebind-project',
      allowAutoRebind: true,
      autoRebindCooldownMinutes: 240,
    })

    const [timeCode] = await generateActivationCodes(prisma, {
      projectKey: 'cooldown-rebind-project',
      amount: 1,
      licenseMode: 'TIME',
      validDays: 30,
      cardType: '月卡',
    })

    const firstActivation = await activateLicense(prisma, {
      projectKey: 'cooldown-rebind-project',
      code: timeCode.code,
      machineId: 'machine-old',
    })
    const secondActivation = await activateLicense(prisma, {
      projectKey: 'cooldown-rebind-project',
      code: timeCode.code,
      machineId: 'machine-new',
    })

    assert.equal(firstActivation.success, true)
    assert.equal(secondActivation.success, false)
    assert.equal(secondActivation.status, 409)
    assert.match(secondActivation.message, /换绑冷却期/)
    assert.ok(secondActivation.rebindAllowedAt instanceof Date)
  } finally {
    await prisma.$disconnect()
  }
})

test('activateLicense 在达到自助换绑次数上限后会拒绝继续自动换绑', async () => {
  const { prisma } = await createTestPrisma()

  try {
    await createProject(prisma, {
      name: '次数限制换绑项目',
      projectKey: 'limited-auto-rebind-project',
      allowAutoRebind: true,
      autoRebindCooldownMinutes: 0,
      autoRebindMaxCount: 1,
    })

    const [timeCode] = await generateActivationCodes(prisma, {
      projectKey: 'limited-auto-rebind-project',
      amount: 1,
      licenseMode: 'TIME',
      validDays: 30,
      cardType: '月卡',
    })

    const firstActivation = await activateLicense(prisma, {
      projectKey: 'limited-auto-rebind-project',
      code: timeCode.code,
      machineId: 'machine-old',
    })
    const secondActivation = await activateLicense(prisma, {
      projectKey: 'limited-auto-rebind-project',
      code: timeCode.code,
      machineId: 'machine-new',
    })
    const thirdActivation = await activateLicense(prisma, {
      projectKey: 'limited-auto-rebind-project',
      code: timeCode.code,
      machineId: 'machine-third',
    })

    const updatedCode = await prisma.activationCode.findUniqueOrThrow({
      where: {
        id: timeCode.id,
      },
    })

    assert.equal(firstActivation.success, true)
    assert.equal(secondActivation.success, true)
    assert.equal(thirdActivation.success, false)
    assert.equal(thirdActivation.status, 409)
    assert.match(thirdActivation.message, /自助换绑次数上限/)
    assert.equal(updatedCode.usedBy, 'machine-new')
    assert.equal(updatedCode.rebindCount, 1)
    assert.equal(updatedCode.autoRebindCount, 1)
  } finally {
    await prisma.$disconnect()
  }
})
