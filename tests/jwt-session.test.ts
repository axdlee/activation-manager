import assert from 'node:assert/strict'
import test from 'node:test'

import * as jwtSessionModule from '../src/lib/jwt-session'

const { parseJwtExpiresInToSeconds } = jwtSessionModule

test('parseJwtExpiresInToSeconds 支持小时与天等常用会话时长格式', () => {
  assert.equal(parseJwtExpiresInToSeconds('1h'), 60 * 60)
  assert.equal(parseJwtExpiresInToSeconds('6h'), 6 * 60 * 60)
  assert.equal(parseJwtExpiresInToSeconds('24h'), 24 * 60 * 60)
  assert.equal(parseJwtExpiresInToSeconds('7d'), 7 * 24 * 60 * 60)
})

test('parseJwtExpiresInToSeconds 会忽略首尾空白并兼容大写单位', () => {
  assert.equal(parseJwtExpiresInToSeconds(' 12H '), 12 * 60 * 60)
})

test('parseJwtExpiresInToSeconds 对非法格式抛出显式错误', () => {
  assert.throws(() => parseJwtExpiresInToSeconds('forever'), /不支持的 JWT 有效期格式/)
})
