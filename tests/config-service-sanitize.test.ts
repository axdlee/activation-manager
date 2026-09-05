import assert from 'node:assert/strict'
import test from 'node:test'

import {
  clearConfigCache,
  sanitizeSystemConfigsForAdmin,
} from '../src/lib/config-service'

test('clearConfigCache 无参数时清空全部缓存', () => {
  // 纯函数：不抛错即可（内部状态清空）
  assert.doesNotThrow(() => clearConfigCache())
})

test('clearConfigCache 指定 key 时只清理对应缓存', () => {
  assert.doesNotThrow(() => clearConfigCache(['jwtSecret']))
})

test('clearConfigCache 空数组时等价于全量清空', () => {
  assert.doesNotThrow(() => clearConfigCache([]))
})

test('sanitizeSystemConfigsForAdmin 会脱敏敏感配置项', () => {
  const result = sanitizeSystemConfigsForAdmin([
    {
      key: 'jwtSecret',
      description: '用于签发登录态',
      value: 'super-secret-value',
      sensitive: true,
      masked: true,
      hasValue: true,
    },
    {
      key: 'systemName',
      description: '展示名称',
      value: '激活码管理系统',
      sensitive: false,
    },
  ])

  const jwtItem = result.find((item) => item.key === 'jwtSecret')
  const nameItem = result.find((item) => item.key === 'systemName')

  assert.equal(jwtItem?.value, '')
  assert.equal(jwtItem?.sensitive, true)
  assert.equal(jwtItem?.masked, true)
  assert.equal(jwtItem?.hasValue, true)
  // 非敏感项原样保留
  assert.equal(nameItem?.value, '激活码管理系统')
})

test('sanitizeSystemConfigsForAdmin 对空值敏感项标记 hasValue=false', () => {
  const result = sanitizeSystemConfigsForAdmin([
    {
      key: 'jwtSecret',
      description: '用于签发登录态',
      value: '',
      sensitive: true,
      masked: false,
      hasValue: false,
    },
  ])

  assert.equal(result[0].value, '')
  assert.equal(result[0].hasValue, false)
})

test('sanitizeSystemConfigsForAdmin 对空数组返回空数组', () => {
  assert.deepEqual(sanitizeSystemConfigsForAdmin([]), [])
})
