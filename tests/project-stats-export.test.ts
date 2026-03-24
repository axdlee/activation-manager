import assert from 'node:assert/strict'
import test from 'node:test'

import { buildProjectStatsCsv } from '../src/lib/project-stats-export'

const projectStats = [
  {
    id: 1,
    name: '默认项目',
    projectKey: 'default',
    isEnabled: true,
    totalCodes: 100,
    usedCodes: 0,
    expiredCodes: 0,
    activeCodes: 100,
    countRemainingTotal: 0,
    countConsumedTotal: 0,
  },
  {
    id: 2,
    name: '浏览器插件, 主线',
    projectKey: 'browser-plugin',
    isEnabled: false,
    totalCodes: 5,
    usedCodes: 4,
    expiredCodes: 1,
    activeCodes: 3,
    countRemainingTotal: 7,
    countConsumedTotal: 8,
  },
]

test('buildProjectStatsCsv 会生成带表头的项目统计 CSV', () => {
  const csv = buildProjectStatsCsv(projectStats)

  assert.ok(csv.startsWith('\uFEFF项目,项目标识,状态,总激活码,已激活,有效,已过期,次数剩余,次数消耗'))
  assert.match(csv, /默认项目,default,启用中,100,0,100,0,0,0/)
})

test('buildProjectStatsCsv 会正确转义包含逗号的项目名称', () => {
  const csv = buildProjectStatsCsv(projectStats.slice(1))

  assert.match(csv, /"浏览器插件, 主线",browser-plugin,已停用,5,4,3,1,7,8/)
})
