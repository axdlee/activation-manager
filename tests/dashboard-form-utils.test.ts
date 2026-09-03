import assert from 'node:assert/strict'
import test from 'node:test'

import {
  parseNullableCooldownMinutesInput,
  parseNullableMaxCountInput,
  normalizeOptionalAdminReason,
  handleCardTypeChange,
} from '../src/lib/dashboard-form-utils'

test('parseNullableCooldownMinutesInput 对空字符串返回 null', () => {
  assert.equal(parseNullableCooldownMinutesInput(''), null)
  assert.equal(parseNullableCooldownMinutesInput('  '), null)
})

test('parseNullableCooldownMinutesInput 对合法值返回数值', () => {
  assert.equal(parseNullableCooldownMinutesInput('60'), 60)
  assert.equal(parseNullableCooldownMinutesInput(' 120 '), 120)
})

test('parseNullableCooldownMinutesInput 对越界值抛错', () => {
  assert.throws(() => parseNullableCooldownMinutesInput('-1'), /换绑冷却时间/)
  assert.throws(() => parseNullableCooldownMinutesInput('999999'), /换绑冷却时间/)
})

test('parseNullableMaxCountInput 对空字符串返回 null', () => {
  assert.equal(parseNullableMaxCountInput(''), null)
})

test('parseNullableMaxCountInput 对合法值返回数值', () => {
  assert.equal(parseNullableMaxCountInput('3'), 3)
  assert.equal(parseNullableMaxCountInput(' 0 '), 0)
})

test('parseNullableMaxCountInput 对越界值抛错', () => {
  assert.throws(() => parseNullableMaxCountInput('-1'), /自助换绑次数上限/)
  assert.throws(() => parseNullableMaxCountInput('99999'), /自助换绑次数上限/)
})

test('normalizeOptionalAdminReason 对空值返回 undefined', () => {
  assert.equal(normalizeOptionalAdminReason(''), undefined)
  assert.equal(normalizeOptionalAdminReason('  '), undefined)
})

test('normalizeOptionalAdminReason 对非空值返回 trim 后字符串', () => {
  assert.equal(normalizeOptionalAdminReason(' 原因 '), '原因')
})

test('handleCardTypeChange 会设置选中卡片与天数', () => {
  const setSelectedCardType = (value: string) => { selected.set(value) }
  const setExpiryDays = (days: number) => { daysSet.set(days) }
  const selected = { set: (v: string) => { selected.value = v }, value: '' }
  const daysSet = { set: (v: number) => { daysSet.value = v }, value: 0 }

  const cardTypes = [
    { name: '月卡', days: 30, description: '30天' },
    { name: '年卡', days: 365, description: '一年' },
  ]

  handleCardTypeChange('年卡', selected.set, daysSet.set, cardTypes)
  assert.equal(selected.value, '年卡')
  assert.equal(daysSet.value, 365)
})