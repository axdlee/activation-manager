import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest } from 'next/server'

import * as dbModule from '../src/lib/db'
import * as systemConfigRouteModule from '../src/app/api/admin/system-config/route'
import { signToken } from '../src/lib/jwt'

const { prisma } = dbModule
const { POST } = systemConfigRouteModule

function buildSystemConfigRecord(key: string, value: string) {
  return {
    id: Math.floor(Math.random() * 1000) + 1,
    key,
    value,
    description: key,
    createdAt: new Date('2026-03-25T00:00:00.000Z'),
    updatedAt: new Date('2026-03-25T00:00:00.000Z'),
  }
}

test('系统配置接口遇到非法配置项时返回 400 与明确错误信息', async (t) => {
  const originalFindSystemConfig = prisma.systemConfig.findUnique.bind(prisma.systemConfig)

  ;(
    prisma.systemConfig as typeof prisma.systemConfig & {
      findUnique: typeof prisma.systemConfig.findUnique
    }
  ).findUnique = async ({ where }: { where: { key: string } }) => {
    if (where.key === 'jwtSecret') {
      return buildSystemConfigRecord('jwtSecret', 'unit-test-jwt-secret')
    }

    if (where.key === 'jwtExpiresIn') {
      return buildSystemConfigRecord('jwtExpiresIn', '24h')
    }

    if (where.key === 'allowedIPs') {
      return buildSystemConfigRecord('allowedIPs', JSON.stringify(['127.0.0.1', '::1']))
    }

    return null
  }

  t.after(async () => {
    ;(
      prisma.systemConfig as typeof prisma.systemConfig & {
        findUnique: typeof prisma.systemConfig.findUnique
      }
    ).findUnique = originalFindSystemConfig
    await prisma.$disconnect()
  })

  const token = await signToken({ username: 'admin', isAdmin: true })
  const request = new NextRequest('http://127.0.0.1:3000/api/admin/system-config', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: `auth-token=${token}`,
    },
    body: JSON.stringify({
      configs: [
        {
          key: 'unexpectedKey',
          value: 'unexpected-value',
          description: '未知配置',
        },
      ],
    }),
  })

  const response = await POST(request)
  const body = await response.json()

  assert.equal(response.status, 400)
  assert.equal(body.success, false)
  assert.match(body.message, /unexpectedKey/)
})
