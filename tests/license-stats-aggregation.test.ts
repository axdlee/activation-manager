import assert from 'node:assert/strict'
import test from 'node:test'

import { getActivationCodeStats, listProjectStats } from '../src/lib/license-analytics-service'

test('getActivationCodeStats 在数据库聚合路径下返回总览统计', async () => {
  const queryCalls: unknown[][] = []

  const client = {
    activationCode: {
      findMany: async () => {
        throw new Error('总览统计不应再回退到 activationCode.findMany 全量查询')
      },
    },
    $queryRaw: async (...args: unknown[]) => {
      queryCalls.push(args)

      return [
        {
          totalCodes: '5',
          usedCodes: '4',
          expiredCodes: '1',
          activeCodes: '4',
        },
      ]
    },
  }

  const stats = await getActivationCodeStats(client as never)

  assert.equal(queryCalls.length, 1)
  assert.deepEqual(stats, {
    total: 5,
    used: 4,
    expired: 1,
    active: 4,
  })
})

test('listProjectStats 在数据库聚合路径下返回按项目聚合后的统计结果', async () => {
  const queryCalls: unknown[][] = []

  const client = {
    project: {
      findMany: async () => {
        throw new Error('项目统计不应再回退到 project.findMany(include codes) 全量聚合')
      },
    },
    $queryRaw: async (...args: unknown[]) => {
      queryCalls.push(args)

      return [
        {
          id: 2,
          name: '统计项目 A',
          projectKey: 'stats-project-a',
          isEnabled: 1,
          totalCodes: '4',
          usedCodes: '3',
          expiredCodes: '1',
          activeCodes: '3',
          countRemainingTotal: '3',
          countConsumedTotal: '2',
        },
        {
          id: 3,
          name: '统计项目 B',
          projectKey: 'stats-project-b',
          isEnabled: 0,
          totalCodes: '1',
          usedCodes: '1',
          expiredCodes: '0',
          activeCodes: '1',
          countRemainingTotal: '1',
          countConsumedTotal: '1',
        },
      ]
    },
  }

  const projectStats = await listProjectStats(client as never)

  assert.equal(queryCalls.length, 1)
  assert.deepEqual(projectStats, [
    {
      id: 2,
      name: '统计项目 A',
      projectKey: 'stats-project-a',
      isEnabled: true,
      totalCodes: 4,
      usedCodes: 3,
      expiredCodes: 1,
      activeCodes: 3,
      countRemainingTotal: 3,
      countConsumedTotal: 2,
    },
    {
      id: 3,
      name: '统计项目 B',
      projectKey: 'stats-project-b',
      isEnabled: false,
      totalCodes: 1,
      usedCodes: 1,
      expiredCodes: 0,
      activeCodes: 1,
      countRemainingTotal: 1,
      countConsumedTotal: 1,
    },
  ])
})
