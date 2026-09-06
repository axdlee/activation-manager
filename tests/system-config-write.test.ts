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
    systemConfig: {
      upsert: () => Promise<never>
    }
  } = {
    persisted,
    transactionCalls: 0,
    systemConfig: {
      async upsert() {
        throw new Error('系统配置写入必须通过事务执行')
      },
    },
    async $transaction<T>(callback: (tx: { systemConfig: { upsert: (args: { where: { key: string }; update: { value: string; description?: string }; create: { key: string; value: string; description?: string } }) => Promise<void> } }) => Promise<T>): Promise<T> {
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
    (error: unknown) => {
      assert.equal(error instanceof InvalidSystemConfigPayloadError, true)
      assert.match(String((error as Error).message), /unexpectedKey/)
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
    (error: unknown) => {
      assert.equal(error instanceof InvalidSystemConfigPayloadError, true)
      assert.match(String((error as Error).message), /jwtExpiresIn/)
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

test('normalizeSystemConfigUpdates 会拒绝空 IP 白名单', () => {
  assert.throws(
    () =>
      normalizeSystemConfigUpdates([
        { key: 'allowedIPs', value: [], description: '白名单' },
      ]),
    (error: unknown) => {
      assert.match(String((error as Error).message), /至少需要保留一个 IP/)
      return true
    },
  )
})

test('normalizeSystemConfigUpdates 会拒绝非数组 allowedIPs', () => {
  assert.throws(
    () =>
      normalizeSystemConfigUpdates([
        { key: 'allowedIPs', value: '127.0.0.1', description: '白名单' },
      ]),
    (error: unknown) => {
      assert.match(String((error as Error).message), /必须是字符串数组/)
      return true
    },
  )
})

test('normalizeSystemConfigUpdates 会拒绝越界 bcryptRounds', () => {
  for (const value of [3, 16]) {
    assert.throws(
      () =>
        normalizeSystemConfigUpdates([
          { key: 'bcryptRounds', value, description: '强度' },
        ]),
      (error: unknown) => {
        assert.match(String((error as Error).message), /必须在 4 到 15 之间/)
        return true
      },
    )
  }
})

test('normalizeSystemConfigUpdates 会拒绝非整数 bcryptRounds', () => {
  assert.throws(
    () =>
      normalizeSystemConfigUpdates([
        { key: 'bcryptRounds', value: 12.5, description: '强度' },
      ]),
    (error: unknown) => {
      assert.match(String((error as Error).message), /必须是整数/)
      return true
    },
  )
})

test('normalizeSystemConfigUpdates 会拒绝越界 autoRebindCooldownMinutes', () => {
  assert.throws(
    () =>
      normalizeSystemConfigUpdates([
        { key: 'autoRebindCooldownMinutes', value: -1, description: '冷却' },
      ]),
    (error: unknown) => {
      assert.match(String((error as Error).message), /autoRebindCooldownMinutes 必须在/)
      return true
    },
  )
  assert.throws(
    () =>
      normalizeSystemConfigUpdates([
        { key: 'autoRebindCooldownMinutes', value: 30 * 24 * 60 + 1, description: '冷却' },
      ]),
    (error: unknown) => {
      assert.match(String((error as Error).message), /autoRebindCooldownMinutes 必须在/)
      return true
    },
  )
})

test('normalizeSystemConfigUpdates 会拒绝越界 autoRebindMaxCount', () => {
  assert.throws(
    () =>
      normalizeSystemConfigUpdates([
        { key: 'autoRebindMaxCount', value: -1, description: '上限' },
      ]),
    (error: unknown) => {
      assert.match(String((error as Error).message), /autoRebindMaxCount 必须在/)
      return true
    },
  )
})

test('normalizeSystemConfigUpdates 会拒绝同一 key 重复出现', () => {
  assert.throws(
    () =>
      normalizeSystemConfigUpdates([
        { key: 'systemName', value: '名称A', description: 'a' },
        { key: 'systemName', value: '名称B', description: 'b' },
      ]),
    (error: unknown) => {
      assert.match(String((error as Error).message), /同一次提交中重复出现/)
      return true
    },
  )
})

test('normalizeSystemConfigUpdates 会拒绝空字符串配置值', () => {
  assert.throws(
    () =>
      normalizeSystemConfigUpdates([
        { key: 'systemName', value: '   ', description: '名称' },
      ]),
    (error: unknown) => {
      assert.match(String((error as Error).message), /不能为空/)
      return true
    },
  )
})

test('normalizeSystemConfigUpdates 接受合法 jwtExpiresIn 与布尔值', () => {
  const normalized = normalizeSystemConfigUpdates([
    { key: 'jwtExpiresIn', value: '24h', description: '有效期' },
    { key: 'allowAutoRebind', value: 'true', description: '换绑策略' },
  ])

  assert.deepEqual(normalized, [
    { key: 'jwtExpiresIn', value: '24h', description: '有效期' },
    { key: 'allowAutoRebind', value: true, description: '换绑策略' },
  ])
})

test('normalizeSystemConfigUpdates 会把空 description 规范化为 undefined', () => {
  const normalized = normalizeSystemConfigUpdates([
    { key: 'systemName', value: '名称', description: '  ' },
  ])

  assert.deepEqual(normalized, [
    { key: 'systemName', value: '名称', description: undefined },
  ])
})
