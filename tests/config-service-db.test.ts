import assert from 'node:assert/strict'
import test from 'node:test'

import { bootstrapDevelopmentDatabase } from '../src/lib/dev-bootstrap'
import {
  clearConfigCache,
  getAllConfigs,
  getConfig,
  setConfig,
} from '../src/lib/config-service'
import { prisma } from '../src/lib/db'

const silentLogger = {
  log: () => undefined,
  error: () => undefined,
}

test.before(async () => {
  await bootstrapDevelopmentDatabase({
    logger: silentLogger,
  })
})

test.after(async () => {
  await prisma.$disconnect()
})

test.afterEach(async () => {
  // 清理测试写入的配置，避免影响其他用例
  await prisma.systemConfig.deleteMany({
    where: { key: { startsWith: 'e2e_test_' } },
  })
  clearConfigCache()
})

test('getConfig 对不存在的配置返回 null', async () => {
  clearConfigCache()
  const value = await getConfig('e2e_test_not_exists')
  assert.equal(value, null)
})

test('setConfig + getConfig 能写入并读回字符串配置', async () => {
  await setConfig('e2e_test_string', 'hello', '测试配置')
  const value = await getConfig('e2e_test_string')
  assert.equal(value, 'hello')
})

test('setConfig + getConfig 能写入并读回数组配置（JSON 序列化）', async () => {
  await setConfig('e2e_test_array', ['127.0.0.1', '::1'])
  const value = await getConfig('e2e_test_array')
  assert.deepEqual(value, ['127.0.0.1', '::1'])
})

test('setConfig 带 description 时持久化描述', async () => {
  await setConfig('e2e_test_desc', 'v', '描述信息')
  const record = await prisma.systemConfig.findUnique({
    where: { key: 'e2e_test_desc' },
  })
  assert.equal(record?.description, '描述信息')
})

test('getAllConfigs 返回所有配置键值映射', async () => {
  await setConfig('e2e_test_alpha', 'a')
  await setConfig('e2e_test_beta', 'b')

  const all = await getAllConfigs()
  assert.equal(all['e2e_test_alpha'], 'a')
  assert.equal(all['e2e_test_beta'], 'b')
})

test('clearConfigCache 指定 key 后重新读取走数据库', async () => {
  await setConfig('e2e_test_cache', 'v1')
  assert.equal(await getConfig('e2e_test_cache'), 'v1')

  // 直接改库（绕过缓存）
  await prisma.systemConfig.update({
    where: { key: 'e2e_test_cache' },
    data: { value: JSON.stringify('v2') },
  })

  // 未清缓存：仍读到旧值
  assert.equal(await getConfig('e2e_test_cache'), 'v1')

  // 清缓存后：读到新值
  clearConfigCache(['e2e_test_cache'])
  assert.equal(await getConfig('e2e_test_cache'), 'v2')
})

test('known 配置项读回时会做类型归一化（bcryptRounds → number）', async () => {
  await setConfig('bcryptRounds', 12)
  clearConfigCache(['bcryptRounds'])

  const value = await getConfig('bcryptRounds')
  assert.equal(value, 12)
})
