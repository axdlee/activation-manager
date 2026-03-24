import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { PrismaClient } from '@prisma/client'

import { bootstrapDevelopmentDatabase } from '../src/lib/dev-bootstrap'
import {
  handleExportLicenseConsumptionsRequest,
  handleExportLicenseConsumptionTrendRequest,
  handleListLicenseConsumptionTrendRequest,
} from '../src/lib/admin-consumption-route-handlers'
import {
  consumeLicense,
  createProject,
  generateActivationCodes,
  updateProjectStatus,
} from '../src/lib/license-service'

const silentLogger = {
  log: () => undefined,
  error: () => undefined,
}

async function createTestPrisma() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'activation-manager-admin-consumption-'))
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

  return { prisma }
}

test('消费日志导出处理器返回 CSV 文件，并支持项目与关键字过滤', async () => {
  const { prisma } = await createTestPrisma()

  try {
    const project = await createProject(prisma, {
      name: '导出项目',
      projectKey: 'export-project',
    })
    await createProject(prisma, {
      name: '其他项目',
      projectKey: 'other-export-project',
    })

    const [exportCode] = await generateActivationCodes(prisma, {
      projectKey: 'export-project',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 3,
      cardType: '3次卡',
    })
    const [otherCode] = await generateActivationCodes(prisma, {
      projectKey: 'other-export-project',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 2,
      cardType: '2次卡',
    })

    await consumeLicense(prisma, {
      projectKey: 'export-project',
      code: exportCode.code,
      machineId: 'machine-export-001',
      requestId: 'export-req-001',
    })
    await consumeLicense(prisma, {
      projectKey: 'export-project',
      code: exportCode.code,
      machineId: 'machine-export-001',
      requestId: 'export-req-002',
    })
    await consumeLicense(prisma, {
      projectKey: 'other-export-project',
      code: otherCode.code,
      machineId: 'machine-other-001',
      requestId: 'other-req-001',
    })

    await updateProjectStatus(prisma, {
      id: project.id,
      isEnabled: false,
    })

    const response = await handleExportLicenseConsumptionsRequest(
      new Request(
        'http://127.0.0.1:3000/api/admin/consumptions/export?projectKey=export-project&keyword=req-002',
        {
          method: 'GET',
        },
      ),
      prisma,
    )

    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type') || '', /^text\/csv/)
    assert.match(
      response.headers.get('content-disposition') || '',
      /^attachment; filename=\"license_consumptions_\d{4}-\d{2}-\d{2}\.csv\"$/,
    )

    const body = await response.text()

    assert.ok(body.replace(/^\uFEFF/, '').startsWith('项目,项目标识,激活码,requestId,机器ID,授权类型,剩余次数,消费时间'))
    assert.match(body, /导出项目/)
    assert.match(body, /export-project/)
    assert.match(body, /export-req-002/)
    assert.doesNotMatch(body, /export-req-001/)
    assert.doesNotMatch(body, /other-export-project/)
  } finally {
    await prisma.$disconnect()
  }
})

test('消费日志导出处理器支持消费时间范围过滤', async () => {
  const { prisma } = await createTestPrisma()

  try {
    await createProject(prisma, {
      name: '时间导出项目',
      projectKey: 'range-export-project',
    })

    const [countCode] = await generateActivationCodes(prisma, {
      projectKey: 'range-export-project',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 3,
      cardType: '3次卡',
    })

    await consumeLicense(prisma, {
      projectKey: 'range-export-project',
      code: countCode.code,
      machineId: 'machine-range-export-001',
      requestId: 'range-export-req-001',
    })
    await consumeLicense(prisma, {
      projectKey: 'range-export-project',
      code: countCode.code,
      machineId: 'machine-range-export-001',
      requestId: 'range-export-req-002',
    })

    await prisma.licenseConsumption.update({
      where: {
        requestId: 'range-export-req-001',
      },
      data: {
        createdAt: new Date('2026-01-05T00:00:00.000Z'),
      },
    })
    await prisma.licenseConsumption.update({
      where: {
        requestId: 'range-export-req-002',
      },
      data: {
        createdAt: new Date('2026-03-05T00:00:00.000Z'),
      },
    })

    const response = await handleExportLicenseConsumptionsRequest(
      new Request(
        'http://127.0.0.1:3000/api/admin/consumptions/export?createdFrom=2026-03-01T00:00:00.000Z&createdTo=2026-03-31T23:59:59.999Z',
        {
          method: 'GET',
        },
      ),
      prisma,
    )

    assert.equal(response.status, 200)

    const body = await response.text()

    assert.match(body, /range-export-req-002/)
    assert.doesNotMatch(body, /range-export-req-001/)
  } finally {
    await prisma.$disconnect()
  }
})

test('消费趋势处理器返回最近 7 天序列，并支持项目过滤', async () => {
  const { prisma } = await createTestPrisma()

  try {
    await createProject(prisma, {
      name: '趋势处理器项目',
      projectKey: 'trend-handler-project',
    })
    await createProject(prisma, {
      name: '其他趋势项目',
      projectKey: 'other-trend-handler-project',
    })

    const [countCode] = await generateActivationCodes(prisma, {
      projectKey: 'trend-handler-project',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 3,
      cardType: '3次卡',
    })
    const [otherCode] = await generateActivationCodes(prisma, {
      projectKey: 'other-trend-handler-project',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 2,
      cardType: '2次卡',
    })

    await consumeLicense(prisma, {
      projectKey: 'trend-handler-project',
      code: countCode.code,
      machineId: 'machine-trend-handler-001',
      requestId: 'trend-handler-req-001',
    })
    await consumeLicense(prisma, {
      projectKey: 'trend-handler-project',
      code: countCode.code,
      machineId: 'machine-trend-handler-001',
      requestId: 'trend-handler-req-002',
    })
    await consumeLicense(prisma, {
      projectKey: 'other-trend-handler-project',
      code: otherCode.code,
      machineId: 'machine-other-trend-handler-001',
      requestId: 'other-trend-handler-req-001',
    })

    const now = new Date()
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 8))
    const yesterdayStart = new Date(todayStart)
    yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1)

    await prisma.licenseConsumption.update({
      where: {
        requestId: 'trend-handler-req-001',
      },
      data: {
        createdAt: yesterdayStart,
      },
    })
    await prisma.licenseConsumption.update({
      where: {
        requestId: 'trend-handler-req-002',
      },
      data: {
        createdAt: todayStart,
      },
    })
    await prisma.licenseConsumption.update({
      where: {
        requestId: 'other-trend-handler-req-001',
      },
      data: {
        createdAt: todayStart,
      },
    })

    const response = await handleListLicenseConsumptionTrendRequest(
      new Request(
        'http://127.0.0.1:3000/api/admin/consumptions/trend?projectKey=trend-handler-project&days=7',
        {
          method: 'GET',
        },
      ),
      prisma,
    )

    assert.equal(response.status, 200)

    const body = await response.json()
    const todayKey = todayStart.toISOString().slice(0, 10)
    const yesterdayKey = yesterdayStart.toISOString().slice(0, 10)
    const todayPoint = body.trend.points.find((point: { date: string }) => point.date === todayKey)
    const yesterdayPoint = body.trend.points.find((point: { date: string }) => point.date === yesterdayKey)

    assert.equal(body.success, true)
    assert.equal(body.trend.days, 7)
    assert.equal(body.trend.totalConsumptions, 2)
    assert.equal(todayPoint?.count, 1)
    assert.equal(yesterdayPoint?.count, 1)
  } finally {
    await prisma.$disconnect()
  }
})

test('消费趋势导出处理器支持按周聚合导出 CSV', async () => {
  const { prisma } = await createTestPrisma()

  try {
    await createProject(prisma, {
      name: '趋势导出项目',
      projectKey: 'trend-export-project',
    })

    const [countCode] = await generateActivationCodes(prisma, {
      projectKey: 'trend-export-project',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 4,
      cardType: '4次卡',
    })

    await consumeLicense(prisma, {
      projectKey: 'trend-export-project',
      code: countCode.code,
      machineId: 'machine-trend-export-001',
      requestId: 'trend-export-req-001',
    })
    await consumeLicense(prisma, {
      projectKey: 'trend-export-project',
      code: countCode.code,
      machineId: 'machine-trend-export-001',
      requestId: 'trend-export-req-002',
    })

    await prisma.licenseConsumption.update({
      where: {
        requestId: 'trend-export-req-001',
      },
      data: {
        createdAt: new Date('2026-03-18T08:00:00.000Z'),
      },
    })
    await prisma.licenseConsumption.update({
      where: {
        requestId: 'trend-export-req-002',
      },
      data: {
        createdAt: new Date('2026-03-20T08:00:00.000Z'),
      },
    })

    const response = await handleExportLicenseConsumptionTrendRequest(
      new Request(
        'http://127.0.0.1:3000/api/admin/consumptions/trend/export?projectKey=trend-export-project&days=30&granularity=week&now=2026-04-10T12:00:00.000Z',
        {
          method: 'GET',
        },
      ),
      prisma,
    )

    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type') || '', /^text\/csv/)
    assert.match(
      response.headers.get('content-disposition') || '',
      /^attachment; filename=\"license_consumption_trend_\d{4}-\d{2}-\d{2}\.csv\"$/,
    )

    const body = await response.text()

    assert.ok(
      body.replace(/^\uFEFF/, '').startsWith('项目,项目标识,统计粒度,时间范围,消费次数'),
    )
    assert.match(body, /趋势导出项目/)
    assert.match(body, /trend-export-project/)
    assert.match(body, /week/)
    assert.match(body, /03-16~03-22/)
    assert.match(body, /,2/)
  } finally {
    await prisma.$disconnect()
  }
})

test('消费趋势导出处理器支持仅导出非零桶', async () => {
  const { prisma } = await createTestPrisma()

  try {
    await createProject(prisma, {
      name: '非零桶趋势导出项目',
      projectKey: 'trend-export-non-zero-project',
    })

    const [countCode] = await generateActivationCodes(prisma, {
      projectKey: 'trend-export-non-zero-project',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 4,
      cardType: '4次卡',
    })

    await consumeLicense(prisma, {
      projectKey: 'trend-export-non-zero-project',
      code: countCode.code,
      machineId: 'machine-trend-export-non-zero-001',
      requestId: 'trend-export-non-zero-req-001',
    })
    await consumeLicense(prisma, {
      projectKey: 'trend-export-non-zero-project',
      code: countCode.code,
      machineId: 'machine-trend-export-non-zero-001',
      requestId: 'trend-export-non-zero-req-002',
    })

    await prisma.licenseConsumption.update({
      where: {
        requestId: 'trend-export-non-zero-req-001',
      },
      data: {
        createdAt: new Date('2026-03-18T08:00:00.000Z'),
      },
    })
    await prisma.licenseConsumption.update({
      where: {
        requestId: 'trend-export-non-zero-req-002',
      },
      data: {
        createdAt: new Date('2026-03-20T08:00:00.000Z'),
      },
    })

    const response = await handleExportLicenseConsumptionTrendRequest(
      new Request(
        'http://127.0.0.1:3000/api/admin/consumptions/trend/export?projectKey=trend-export-non-zero-project&days=30&granularity=week&now=2026-04-10T12:00:00.000Z&hideZeroBuckets=true',
        {
          method: 'GET',
        },
      ),
      prisma,
    )

    assert.equal(response.status, 200)

    const body = await response.text()
    const normalizedBody = body.replace(/^\uFEFF/, '')

    assert.match(normalizedBody, /03-16~03-22/)
    assert.match(normalizedBody, /,2/)
    assert.doesNotMatch(normalizedBody, /03-09~03-15/)
    assert.doesNotMatch(normalizedBody, /03-23~03-29/)
    assert.doesNotMatch(normalizedBody, /03-30~04-05/)
    assert.doesNotMatch(normalizedBody, /04-06~04-12/)
  } finally {
    await prisma.$disconnect()
  }
})

test('消费趋势导出处理器支持导出双项目对比 CSV', async () => {
  const { prisma } = await createTestPrisma()

  try {
    await createProject(prisma, {
      name: '主趋势项目',
      projectKey: 'trend-export-primary-project',
    })
    await createProject(prisma, {
      name: '对比趋势项目',
      projectKey: 'trend-export-secondary-project',
    })

    const [primaryCode] = await generateActivationCodes(prisma, {
      projectKey: 'trend-export-primary-project',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 4,
      cardType: '4次卡',
    })
    const [secondaryCode] = await generateActivationCodes(prisma, {
      projectKey: 'trend-export-secondary-project',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 4,
      cardType: '4次卡',
    })

    await consumeLicense(prisma, {
      projectKey: 'trend-export-primary-project',
      code: primaryCode.code,
      machineId: 'machine-trend-export-primary-001',
      requestId: 'trend-export-primary-req-001',
    })
    await consumeLicense(prisma, {
      projectKey: 'trend-export-primary-project',
      code: primaryCode.code,
      machineId: 'machine-trend-export-primary-001',
      requestId: 'trend-export-primary-req-002',
    })
    await consumeLicense(prisma, {
      projectKey: 'trend-export-secondary-project',
      code: secondaryCode.code,
      machineId: 'machine-trend-export-secondary-001',
      requestId: 'trend-export-secondary-req-001',
    })
    await consumeLicense(prisma, {
      projectKey: 'trend-export-secondary-project',
      code: secondaryCode.code,
      machineId: 'machine-trend-export-secondary-001',
      requestId: 'trend-export-secondary-req-002',
    })

    await prisma.licenseConsumption.update({
      where: { requestId: 'trend-export-primary-req-001' },
      data: { createdAt: new Date('2026-03-18T08:00:00.000Z') },
    })
    await prisma.licenseConsumption.update({
      where: { requestId: 'trend-export-primary-req-002' },
      data: { createdAt: new Date('2026-03-20T08:00:00.000Z') },
    })
    await prisma.licenseConsumption.update({
      where: { requestId: 'trend-export-secondary-req-001' },
      data: { createdAt: new Date('2026-03-19T08:00:00.000Z') },
    })
    await prisma.licenseConsumption.update({
      where: { requestId: 'trend-export-secondary-req-002' },
      data: { createdAt: new Date('2026-04-02T08:00:00.000Z') },
    })

    const response = await handleExportLicenseConsumptionTrendRequest(
      new Request(
        'http://127.0.0.1:3000/api/admin/consumptions/trend/export?projectKey=trend-export-primary-project&compareProjectKey=trend-export-secondary-project&days=30&granularity=week&now=2026-04-10T12:00:00.000Z&hideZeroBuckets=true',
        {
          method: 'GET',
        },
      ),
      prisma,
    )

    assert.equal(response.status, 200)

    const body = (await response.text()).replace(/^\uFEFF/, '')

    assert.ok(
      body.startsWith('项目,项目标识,对比项目,对比项目标识,统计粒度,时间范围,当前项目消费次数,对比项目消费次数,差值'),
    )
    assert.match(body, /主趋势项目/)
    assert.match(body, /trend-export-primary-project/)
    assert.match(body, /对比趋势项目/)
    assert.match(body, /trend-export-secondary-project/)
    assert.match(body, /03-16~03-22,2,1,1/)
    assert.match(body, /03-30~04-05,0,1,-1/)
    assert.doesNotMatch(body, /03-09~03-15/)
    assert.doesNotMatch(body, /03-23~03-29/)
    assert.doesNotMatch(body, /04-06~04-12/)
  } finally {
    await prisma.$disconnect()
  }
})

test('消费趋势处理器返回当前周期相对上一周期的对比数据', async () => {
  const { prisma } = await createTestPrisma()

  try {
    await createProject(prisma, {
      name: '趋势对比处理器项目',
      projectKey: 'trend-compare-handler-project',
    })

    const [countCode] = await generateActivationCodes(prisma, {
      projectKey: 'trend-compare-handler-project',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 6,
      cardType: '6次卡',
    })

    for (const requestId of [
      'trend-compare-handler-req-001',
      'trend-compare-handler-req-002',
      'trend-compare-handler-req-003',
    ]) {
      await consumeLicense(prisma, {
        projectKey: 'trend-compare-handler-project',
        code: countCode.code,
        machineId: 'machine-trend-compare-handler-001',
        requestId,
      })
    }

    await prisma.licenseConsumption.update({
      where: {
        requestId: 'trend-compare-handler-req-001',
      },
      data: {
        createdAt: new Date('2026-03-14T08:00:00.000Z'),
      },
    })
    await prisma.licenseConsumption.update({
      where: {
        requestId: 'trend-compare-handler-req-002',
      },
      data: {
        createdAt: new Date('2026-03-20T08:00:00.000Z'),
      },
    })
    await prisma.licenseConsumption.update({
      where: {
        requestId: 'trend-compare-handler-req-003',
      },
      data: {
        createdAt: new Date('2026-03-22T08:00:00.000Z'),
      },
    })

    const response = await handleListLicenseConsumptionTrendRequest(
      new Request(
        'http://127.0.0.1:3000/api/admin/consumptions/trend?projectKey=trend-compare-handler-project&days=7&now=2026-03-24T12:00:00.000Z',
        {
          method: 'GET',
        },
      ),
      prisma,
    )

    assert.equal(response.status, 200)

    const body = await response.json()

    assert.deepEqual(body.trend.comparison, {
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
