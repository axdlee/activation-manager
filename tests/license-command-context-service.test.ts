import assert from 'node:assert/strict'
import test from 'node:test'

import { DEFAULT_PROJECT_KEY } from '../src/lib/dev-bootstrap'
import {
  resolveConsumeLicenseCommandContext,
  resolveLicenseActionCommandContext,
} from '../src/lib/license-command-context-service'

test('resolveLicenseActionCommandContext 在缺少激活码或机器ID时直接返回缺参结果且不查项目', async () => {
  let lookupCount = 0
  const client = {
    project: {
      findUnique: async () => {
        lookupCount += 1
        return { id: 1, isEnabled: true }
      },
    },
  } as never

  const resolution = await resolveLicenseActionCommandContext(client, {
    projectKey: 'browser-plugin',
    code: '   ',
    machineId: 'machine-001',
  })

  assert.equal(resolution.ok, false)
  if (resolution.ok) {
    throw new Error('expected missing params result')
  }

  assert.equal(resolution.result.status, 400)
  assert.equal(resolution.result.message, '激活码和机器ID不能为空')
  assert.equal(lookupCount, 0)
})

test('resolveLicenseActionCommandContext 会标准化输入并解析项目上下文', async () => {
  const lookups: Array<{ where: { projectKey: string } }> = []
  const client = {
    project: {
      findUnique: async (args: { where: { projectKey: string } }) => {
        lookups.push(args)
        return { id: 7, isEnabled: true }
      },
    },
  } as never

  const resolution = await resolveLicenseActionCommandContext(client, {
    projectKey: '   ',
    code: ' CODE-001 ',
    machineId: ' machine-001 ',
  })

  assert.equal(resolution.ok, true)
  if (!resolution.ok) {
    throw new Error('expected resolved command context')
  }

  assert.deepEqual(lookups, [
    {
      where: {
        projectKey: DEFAULT_PROJECT_KEY,
      },
    },
  ])
  assert.deepEqual(resolution.context, {
    projectId: 7,
    code: 'CODE-001',
    machineId: 'machine-001',
  })
})

test('resolveConsumeLicenseCommandContext 会标准化 requestId 并构建幂等请求上下文', async () => {
  const client = {
    project: {
      findUnique: async () => ({ id: 11, isEnabled: true }),
    },
  } as never

  const resolution = await resolveConsumeLicenseCommandContext(client, {
    projectKey: 'browser-plugin',
    code: ' COUNT-001 ',
    machineId: ' machine-002 ',
    requestId: ' req-001 ',
  })

  assert.equal(resolution.ok, true)
  if (!resolution.ok) {
    throw new Error('expected resolved consume command context')
  }

  assert.deepEqual(resolution.context, {
    projectId: 11,
    code: 'COUNT-001',
    machineId: 'machine-002',
    requestId: 'req-001',
    requestContext: {
      projectId: 11,
      code: 'COUNT-001',
      machineId: 'machine-002',
    },
  })
})
