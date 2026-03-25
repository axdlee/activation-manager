import assert from 'node:assert/strict'
import test from 'node:test'

import {
  InvalidSystemConfigPayloadError,
  normalizeSystemConfigUpdates,
  persistSystemConfigUpdates,
} from '../src/lib/system-config-write'
import { type PersistableSystemConfigItem } from '../src/lib/system-config-updates'

type PersistSystemConfigClient = NonNullable<Parameters<typeof persistSystemConfigUpdates>[1]>
type PersistedConfigRecord = {
  value: string
  description?: string
}

function createTransactionalConfigClient(options: {
  seed?: Record<string, PersistedConfigRecord>
  failOnKey?: string
} = {}) {
  const persisted = new Map(Object.entries(options.seed || {}))
  let transactionCalls = 0

  const client: PersistSystemConfigClient & {
    persisted: Map<string, PersistedConfigRecord>
    transactionCalls: number
  } = {
    persisted,
    transactionCalls: 0,
    systemConfig: {
      async upsert() {
        throw new Error('系统配置写入必须通过事务执行')
      },
    },
    async $transaction<T>(callback) {
      transactionCalls += 1
      client.transactionCalls = transactionCalls
      const pending = new Map(persisted)

      const tx = {
        systemConfig: {
          async upsert(args: {
            where: { key: string }
            update: { value: string; description?: string }
            create: { key: string; value: string; description?: string }
          }) {
            const key = args.where.key

            if (options.failOnKey && key === options.failOnKey) {
              throw new Error(`boom:${key}`)
            }

            pending.set(key, {
              value: args.update.value ?? args.create.value,
              description: args.update.description ?? args.create.description,
            })
          },
        },
      }

      const result = await callback(tx)
      persisted.clear()
      pending.forEach((value, key) => persisted.set(key, value))
      return result
    },
  }

  return client
}

test('normalizeSystemConfigUpdates 会拒绝不在 allowlist 中的配置项', () => {
  assert.throws(
    () =>
      normalizeSystemConfigUpdates([
        {
          key: 'unexpectedKey',
          value: 'unexpected-value',
          description: '未知配置',
        },
      ]),
    (error) => {
      assert.equal(error instanceof InvalidSystemConfigPayloadError, true)
      assert.match(String(error.message), /unexpectedKey/)
      return true
    },
  )
})

test('normalizeSystemConfigUpdates 会拒绝不符合 schema 的配置值', () => {
  assert.throws(
    () =>
      normalizeSystemConfigUpdates([
        {
          key: 'jwtExpiresIn',
          value: '30m',
          description: 'JWT过期时间',
        },
      ]),
    (error) => {
      assert.equal(error instanceof InvalidSystemConfigPayloadError, true)
      assert.match(String(error.message), /jwtExpiresIn/)
      return true
    },
  )
})

test('normalizeSystemConfigUpdates 会对合法配置做标准化处理', () => {
  const normalized = normalizeSystemConfigUpdates([
    {
      key: 'allowedIPs',
      value: [' 127.0.0.1 ', '::1', '127.0.0.1'],
      description: 'IP白名单列表',
    },
    {
      key: 'systemName',
      value: '  激活码平台  ',
      description: '系统名称',
    },
    {
      key: 'bcryptRounds',
      value: 12,
      description: 'bcrypt加密强度',
    },
  ])

  assert.deepEqual(normalized, [
    {
      key: 'allowedIPs',
      value: ['127.0.0.1', '::1'],
      description: 'IP白名单列表',
    },
    {
      key: 'systemName',
      value: '激活码平台',
      description: '系统名称',
    },
    {
      key: 'bcryptRounds',
      value: 12,
      description: 'bcrypt加密强度',
    },
  ])
})

test('persistSystemConfigUpdates 在事务内批量写入，任一项失败时不会部分提交', async () => {
  const client = createTransactionalConfigClient({
    seed: {
      systemName: {
        value: '旧系统名称',
        description: '系统名称',
      },
    },
    failOnKey: 'jwtExpiresIn',
  })

  const updates: PersistableSystemConfigItem[] = [
    {
      key: 'systemName',
      value: '新系统名称',
      description: '系统名称',
    },
    {
      key: 'jwtExpiresIn',
      value: '7d',
      description: 'JWT过期时间',
    },
  ]

  await assert.rejects(() => persistSystemConfigUpdates(updates, client), /boom:jwtExpiresIn/)

  assert.equal(client.transactionCalls, 1)
  assert.deepEqual(Array.from(client.persisted.entries()), [
    [
      'systemName',
      {
        value: '旧系统名称',
        description: '系统名称',
      },
    ],
  ])
})
