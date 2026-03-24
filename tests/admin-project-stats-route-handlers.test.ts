import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { PrismaClient } from '@prisma/client'

import { bootstrapDevelopmentDatabase } from '../src/lib/dev-bootstrap'
import { handleExportProjectStatsRequest } from '../src/lib/admin-project-stats-route-handlers'
import { createProject, generateActivationCodes } from '../src/lib/license-service'

const silentLogger = {
  log: () => undefined,
  error: () => undefined,
}

async function createTestPrisma() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'activation-manager-admin-project-stats-'))
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

test('项目统计导出处理器返回 CSV 文件，并支持按项目过滤', async () => {
  const { prisma } = await createTestPrisma()

  try {
    await createProject(prisma, {
      name: '服务端导出项目',
      projectKey: 'server-export-project',
    })
    await createProject(prisma, {
      name: '其他统计项目',
      projectKey: 'other-stats-project',
    })

    await generateActivationCodes(prisma, {
      projectKey: 'server-export-project',
      amount: 2,
      licenseMode: 'COUNT',
      totalCount: 5,
      cardType: '5次卡',
    })
    await generateActivationCodes(prisma, {
      projectKey: 'other-stats-project',
      amount: 1,
      licenseMode: 'TIME',
      validDays: 30,
      cardType: '30天卡',
    })

    const response = await handleExportProjectStatsRequest(
      new Request('http://127.0.0.1:3000/api/admin/codes/stats/export?projectKey=server-export-project', {
        method: 'GET',
      }),
      prisma,
    )

    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type') || '', /^text\/csv/)
    assert.match(
      response.headers.get('content-disposition') || '',
      /^attachment; filename=\"project_stats_\d{4}-\d{2}-\d{2}\.csv\"$/,
    )

    const body = await response.text()

    assert.ok(body.replace(/^\uFEFF/, '').startsWith('项目,项目标识,状态,总激活码,已激活,有效,已过期,次数剩余,次数消耗'))
    assert.match(body, /服务端导出项目/)
    assert.match(body, /server-export-project,启用中,2,0,2,0,10,0/)
    assert.doesNotMatch(body, /other-stats-project/)
  } finally {
    await prisma.$disconnect()
  }
})
