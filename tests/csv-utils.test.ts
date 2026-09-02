import assert from 'node:assert/strict'
import test from 'node:test'

import { createCsvRow, sanitizeCsvValue } from '../src/lib/csv-utils'

test('sanitizeCsvValue 保留普通值不变', () => {
  assert.equal(sanitizeCsvValue('abc'), 'abc')
  assert.equal(sanitizeCsvValue('激活码'), '激活码')
  assert.equal(sanitizeCsvValue(123), '123')
})

test('sanitizeCsvValue 对含逗号/引号/换行的值做引号转义', () => {
  assert.equal(sanitizeCsvValue('a,b'), '"a,b"')
  assert.equal(sanitizeCsvValue('say "hi"'), '"say ""hi"""')
  assert.equal(sanitizeCsvValue('line1\nline2'), '"line1\nline2"')
})

test('sanitizeCsvValue 对公式注入前缀值加制表符前缀', () => {
  assert.equal(sanitizeCsvValue('=SUM(A1)'), '\t=SUM(A1)')
  assert.equal(sanitizeCsvValue('+cmd|calc'), '\t+cmd|calc')
  assert.equal(sanitizeCsvValue('-1+2'), '\t-1+2')
  assert.equal(sanitizeCsvValue('@SUM'), '\t@SUM')
})

test('sanitizeCsvValue 对单个公式字符也加前缀', () => {
  assert.equal(sanitizeCsvValue('='), '\t=')
  assert.equal(sanitizeCsvValue('-'), '\t-')
})

test('sanitizeCsvValue 对数字类型不做公式前缀（统计差值等）', () => {
  assert.equal(sanitizeCsvValue(-1), '-1')
  assert.equal(sanitizeCsvValue(0), '0')
  assert.equal(sanitizeCsvValue(42), '42')
})

test('createCsvRow 组合多个值并应用转义', () => {
  const row = createCsvRow(['=EVIL()', '普通值', 42, -1])
  assert.equal(row, '\t=EVIL(),普通值,42,-1')
})
