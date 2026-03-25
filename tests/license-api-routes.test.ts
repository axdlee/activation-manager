import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { PrismaClient } from '@prisma/client'

import { bootstrapDevelopmentDatabase } from '../src/lib/dev-bootstrap'
import {
  handleActivateLicenseRequest,
  handleConsumeLicenseRequest,
  handleLicenseStatusRequest,
  handleVerifyLicenseRequest,
} from '../src/lib/license-route-handlers'
import { generateActivationCodes } from '../src/lib/license-generation-service'
import { createProject } from '../src/lib/license-project-service'

const silentLogger = {
  log: () => undefined,
  error: () => undefined,
}

async function createTestPrisma() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'activation-manager-license-api-'))
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

function createJsonRequest(url: string, body: Record<string, unknown>) {
  return new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

test('正式 activate 接口支持 camelCase 请求并返回剩余次数', async () => {
  const { prisma } = await createTestPrisma()

  try {
    await createProject(prisma, {
      name: '浏览器插件 API',
      projectKey: 'browser-plugin-api',
    })

    const [countCode] = await generateActivationCodes(prisma, {
      projectKey: 'browser-plugin-api',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 3,
      cardType: '3次卡',
    })

    const response = await handleActivateLicenseRequest(
      createJsonRequest('http://127.0.0.1:3000/api/license/activate', {
        projectKey: 'browser-plugin-api',
        code: countCode.code,
        machineId: 'machine-api-001',
      }),
      prisma,
    )
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(body.success, true)
    assert.equal(body.remainingCount, 3)
    assert.equal(body.remaining_count, 3)
    assert.equal(body.licenseMode, 'COUNT')
    assert.equal(body.license_mode, 'COUNT')
  } finally {
    await prisma.$disconnect()
  }
})

test('正式 status 接口支持 snake_case 请求并返回激活状态', async () => {
  const { prisma } = await createTestPrisma()

  try {
    await createProject(prisma, {
      name: '状态查询插件',
      projectKey: 'status-plugin',
    })

    const [countCode] = await generateActivationCodes(prisma, {
      projectKey: 'status-plugin',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 2,
      cardType: '2次卡',
    })

    await handleActivateLicenseRequest(
      createJsonRequest('http://127.0.0.1:3000/api/license/activate', {
        projectKey: 'status-plugin',
        code: countCode.code,
        machineId: 'machine-status-001',
      }),
      prisma,
    )

    const response = await handleLicenseStatusRequest(
      createJsonRequest('http://127.0.0.1:3000/api/license/status', {
        project_key: 'status-plugin',
        code: countCode.code,
        machine_id: 'machine-status-001',
      }),
      prisma,
    )
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(body.success, true)
    assert.equal(body.isActivated, true)
    assert.equal(body.is_activated, true)
    assert.equal(body.remainingCount, 2)
  } finally {
    await prisma.$disconnect()
  }
})

test('正式 consume 接口对相同 requestId 幂等且不会重复扣次', async () => {
  const { prisma } = await createTestPrisma()

  try {
    await createProject(prisma, {
      name: '消费插件',
      projectKey: 'consume-plugin',
    })

    const [countCode] = await generateActivationCodes(prisma, {
      projectKey: 'consume-plugin',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 2,
      cardType: '2次卡',
    })

    const firstResponse = await handleConsumeLicenseRequest(
      createJsonRequest('http://127.0.0.1:3000/api/license/consume', {
        projectKey: 'consume-plugin',
        code: countCode.code,
        machineId: 'machine-consume-001',
        requestId: 'consume-req-001',
      }),
      prisma,
    )
    const firstBody = await firstResponse.json()

    const secondResponse = await handleConsumeLicenseRequest(
      createJsonRequest('http://127.0.0.1:3000/api/license/consume', {
        projectKey: 'consume-plugin',
        code: countCode.code,
        machineId: 'machine-consume-001',
        requestId: 'consume-req-001',
      }),
      prisma,
    )
    const secondBody = await secondResponse.json()

    assert.equal(firstResponse.status, 200)
    assert.equal(firstBody.success, true)
    assert.equal(firstBody.remainingCount, 1)
    assert.equal(secondResponse.status, 200)
    assert.equal(secondBody.success, true)
    assert.equal(secondBody.remainingCount, 1)
    assert.equal(secondBody.idempotent, true)
  } finally {
    await prisma.$disconnect()
  }
})


test('兼容 verify 接口复用统一 handler，并返回 legacy snake_case 字段', async () => {
  const { prisma } = await createTestPrisma()

  try {
    await createProject(prisma, {
      name: '兼容插件',
      projectKey: 'legacy-plugin',
    })

    const [countCode] = await generateActivationCodes(prisma, {
      projectKey: 'legacy-plugin',
      amount: 1,
      licenseMode: 'COUNT',
      totalCount: 2,
      cardType: '2次卡',
    })

    const response = await handleVerifyLicenseRequest(
      createJsonRequest('http://127.0.0.1:3000/api/verify', {
        project_key: 'legacy-plugin',
        code: countCode.code,
        machine_id: 'machine-legacy-001',
      }),
      prisma,
    )
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(body.success, true)
    assert.equal(body.remaining_count, 1)
    assert.equal(body.license_mode, 'COUNT')
    assert.ok(!('remainingCount' in body))
    assert.ok(!('licenseMode' in body))
  } finally {
    await prisma.$disconnect()
  }
})
