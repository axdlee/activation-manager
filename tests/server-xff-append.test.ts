import assert from 'node:assert/strict'
import test from 'node:test'

import {
  appendSocketAddressToForwardedFor,
  isLoopbackAddress,
  normalizeSocketAddress,
  resolveListenHost,
  resolveListenPort,
} from '../server.js'

test('直连请求：XFF 追加 socket 地址，伪造的单条目被挤到左侧', () => {
  assert.equal(
    appendSocketAddressToForwardedFor('10.9.9.9', '172.18.0.5'),
    '10.9.9.9, 172.18.0.5',
  )
})

test('无 XFF 请求：追加后链条仅含 socket 地址', () => {
  assert.equal(appendSocketAddressToForwardedFor(undefined, '203.0.113.7'), '203.0.113.7')
  assert.equal(appendSocketAddressToForwardedFor(null, '203.0.113.7'), '203.0.113.7')
})

test('多段伪造 XFF：全部保留在左侧，尾部为 socket 地址', () => {
  assert.equal(
    appendSocketAddressToForwardedFor('9.9.9.9, 8.8.8.8', '192.168.1.9'),
    '9.9.9.9, 8.8.8.8, 192.168.1.9',
  )
})

test('IPv4-mapped IPv6 socket 地址归一化后追加', () => {
  assert.equal(
    appendSocketAddressToForwardedFor('10.9.9.9', '::ffff:192.168.0.11'),
    '10.9.9.9, 192.168.0.11',
  )
  assert.equal(normalizeSocketAddress('::FFFF:10.1.2.3'), '10.1.2.3')
  assert.equal(normalizeSocketAddress('2001:db8::1'), '2001:db8::1')
})

test('回环 socket 无密钥头时一律追加（v2.11.0 反转：不再无条件豁免回环）', () => {
  // v2.9.1 语义：回环 socket 一律不追加（保护 middleware 内部跳）。
  // v2.11.0 评审·高危 2：该豁免让同机 nginx 反代的伪造 XFF 直接命中
  // 取位——现改为「回环 + 进程随机密钥头」才豁免，普通回环连接照常追加。
  assert.equal(
    appendSocketAddressToForwardedFor('10.9.9.9, 172.18.0.5', '127.0.0.1'),
    '10.9.9.9, 172.18.0.5, 127.0.0.1',
  )
  assert.equal(
    appendSocketAddressToForwardedFor('10.9.9.9, 172.18.0.5', '::1'),
    '10.9.9.9, 172.18.0.5, ::1',
  )
  assert.equal(isLoopbackAddress('::ffff:127.0.0.1'), true)
  assert.equal(isLoopbackAddress('192.168.1.9'), false)
})

test('socket 地址缺失时不改动原头', () => {
  assert.equal(appendSocketAddressToForwardedFor('10.9.9.9', ''), '10.9.9.9')
  assert.equal(appendSocketAddressToForwardedFor('10.9.9.9', undefined), '10.9.9.9')
  assert.equal(appendSocketAddressToForwardedFor(undefined, ''), null)
})

test('XFF 头两侧空白被清理后追加', () => {
  assert.equal(
    appendSocketAddressToForwardedFor('  10.9.9.9  ', '192.168.1.9'),
    '10.9.9.9, 192.168.1.9',
  )
})

test('监听地址与端口解析', () => {
  assert.equal(resolveListenPort('3567'), 3567)
  assert.equal(resolveListenPort(undefined), 3000)
  assert.equal(resolveListenPort('abc'), 3000)
  assert.equal(resolveListenHost(undefined), '0.0.0.0')
  assert.equal(resolveListenHost('127.0.0.1'), '127.0.0.1')
  assert.equal(resolveListenHost('  '), '0.0.0.0')
})

test('回环 socket + 进程随机密钥头：可信内部跳保持 XFF 原样', () => {
  const original = process.env.LICENSE_INTERNAL_XFF_SECRET
  process.env.LICENSE_INTERNAL_XFF_SECRET = 'exp-internal-secret'
  try {
    assert.equal(
      appendSocketAddressToForwardedFor('203.0.113.7, 127.0.0.1', '127.0.0.1', 'exp-internal-secret'),
      '203.0.113.7, 127.0.0.1',
    )
    assert.equal(
      appendSocketAddressToForwardedFor('203.0.113.7, 127.0.0.1', '::1', 'exp-internal-secret'),
      '203.0.113.7, 127.0.0.1',
    )
  } finally {
    if (original === undefined) {
      delete process.env.LICENSE_INTERNAL_XFF_SECRET
    } else {
      process.env.LICENSE_INTERNAL_XFF_SECRET = original
    }
  }
})

test('回环 socket 无密钥/错密钥：一律追加（同机 nginx 伪造 XFF 被挤出取位）', () => {
  const original = process.env.LICENSE_INTERNAL_XFF_SECRET
  process.env.LICENSE_INTERNAL_XFF_SECRET = 'exp-internal-secret'
  try {
    // 无密钥（外部经同机 nginx 进来的回环连接）
    assert.equal(
      appendSocketAddressToForwardedFor('203.0.113.7, 198.51.100.9', '127.0.0.1'),
      '203.0.113.7, 198.51.100.9, 127.0.0.1',
    )
    assert.equal(appendSocketAddressToForwardedFor(undefined, '::1'), '::1')
    // 错误密钥（伪造内部跳）
    assert.equal(
      appendSocketAddressToForwardedFor('203.0.113.7', '127.0.0.1', 'wrong-secret'),
      '203.0.113.7, 127.0.0.1',
    )
    assert.equal(
      appendSocketAddressToForwardedFor('203.0.113.7', '127.0.0.1', ''),
      '203.0.113.7, 127.0.0.1',
    )
    // env 未设置时密钥头不可能匹配
    delete process.env.LICENSE_INTERNAL_XFF_SECRET
    assert.equal(
      appendSocketAddressToForwardedFor('203.0.113.7', '127.0.0.1', 'exp-internal-secret'),
      '203.0.113.7, 127.0.0.1',
    )
  } finally {
    if (original === undefined) {
      delete process.env.LICENSE_INTERNAL_XFF_SECRET
    } else {
      process.env.LICENSE_INTERNAL_XFF_SECRET = original
    }
  }
})

test('非回环 socket 即使带密钥头也照常追加（密钥只豁免回环内部跳）', () => {
  const original = process.env.LICENSE_INTERNAL_XFF_SECRET
  process.env.LICENSE_INTERNAL_XFF_SECRET = 'exp-internal-secret'
  try {
    assert.equal(
      appendSocketAddressToForwardedFor('10.9.9.9', '172.18.0.5', 'exp-internal-secret'),
      '10.9.9.9, 172.18.0.5',
    )
  } finally {
    if (original === undefined) {
      delete process.env.LICENSE_INTERNAL_XFF_SECRET
    } else {
      process.env.LICENSE_INTERNAL_XFF_SECRET = original
    }
  }
})

test('模块加载时生成进程随机密钥（require("next") 之前，middleware 可读）', () => {
  const secret = process.env.LICENSE_INTERNAL_XFF_SECRET
  assert.equal(typeof secret, 'string')
  assert.ok((secret ?? '').length >= 32, '密钥应为 24 字节 hex（48 字符）')
  assert.notEqual(secret, '')
})
