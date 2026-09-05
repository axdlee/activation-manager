import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getActualExpiresAt,
  getCodeStatusLabel,
  getRemainingCount,
  isCodeActive,
  isCodeExpired,
  isCountCodeDepleted,
} from '../src/lib/license-status'

const COUNT_CODE = {
  licenseMode: 'COUNT' as const,
  remainingCount: 3,
  isUsed: false,
  usedAt: null,
  usedBy: null,
  expiresAt: null,
  validDays: null,
}

const TIME_CODE = {
  licenseMode: 'TIME' as const,
  remainingCount: null,
  isUsed: false,
  usedAt: null,
  usedBy: null,
  expiresAt: null,
  validDays: 30,
}

test('getRemainingCount 返回次数卡的剩余次数', () => {
  assert.equal(getRemainingCount(COUNT_CODE), 3)
  assert.equal(getRemainingCount({ ...COUNT_CODE, remainingCount: null }), 0)
  assert.equal(getRemainingCount({ ...COUNT_CODE, remainingCount: null, totalCount: 5 }), 5)
  assert.equal(getRemainingCount(TIME_CODE), null)
})

test('getActualExpiresAt 对未激活时间卡返回 null', () => {
  assert.equal(getActualExpiresAt(TIME_CODE), null)
})

test('isCodeExpired 对次数卡永远返回 false', () => {
  assert.equal(isCodeExpired(COUNT_CODE), false)
})

test('isCountCodeDepleted 对次数卡在剩余 0 时返回 true', () => {
  assert.equal(isCountCodeDepleted(COUNT_CODE), false)
  assert.equal(isCountCodeDepleted({ ...COUNT_CODE, remainingCount: 0 }), true)
  assert.equal(isCountCodeDepleted({ ...COUNT_CODE, remainingCount: -1 }), true)
  assert.equal(isCountCodeDepleted(TIME_CODE), false)
})

test('isCodeActive 对次数卡按剩余次数判断', () => {
  assert.equal(isCodeActive(COUNT_CODE), true)
  assert.equal(isCodeActive({ ...COUNT_CODE, remainingCount: 0 }), false)
})

test('isCodeActive 对未使用的时间卡返回 true', () => {
  assert.equal(isCodeActive(TIME_CODE), true)
})

test('getCodeStatusLabel 覆盖次数卡状态', () => {
  assert.equal(getCodeStatusLabel(COUNT_CODE), '未激活')
  assert.equal(getCodeStatusLabel({ ...COUNT_CODE, isUsed: true, remainingCount: 3 }), '使用中')
  assert.equal(getCodeStatusLabel({ ...COUNT_CODE, isUsed: true, remainingCount: 0 }), '已耗尽')
})

test('getCodeStatusLabel 覆盖时间卡状态', () => {
  const now = new Date('2026-01-01T00:00:00Z')
  assert.equal(getCodeStatusLabel(TIME_CODE, now), '未激活')
  assert.equal(getCodeStatusLabel({ ...TIME_CODE, isUsed: true }, now), '已使用')

  const expiredCode = {
    ...TIME_CODE,
    isUsed: true,
    usedAt: new Date('2025-01-01T00:00:00Z'),
    expiresAt: new Date('2025-01-31T00:00:00Z'),
  }
  assert.equal(getCodeStatusLabel(expiredCode, now), '已过期')
})
