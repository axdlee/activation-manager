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

test('回环 socket 不追加：保护 middleware 内部校验回环跳的 XFF 一致性', () => {
  assert.equal(appendSocketAddressToForwardedFor('10.9.9.9, 172.18.0.5', '127.0.0.1'), '10.9.9.9, 172.18.0.5')
  assert.equal(appendSocketAddressToForwardedFor('10.9.9.9, 172.18.0.5', '::1'), '10.9.9.9, 172.18.0.5')
  assert.equal(appendSocketAddressToForwardedFor('10.9.9.9, 172.18.0.5', '::ffff:127.0.0.1'), '10.9.9.9, 172.18.0.5')
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
