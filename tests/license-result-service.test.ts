import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createActivationSuccessResult,
  createCountConsumeSuccessResult,
  createLicenseNotFoundResult,
  createLicenseStatusSuccessResult,
  createMissingParamsResult,
  createPendingConsumptionRequestResult,
  createRequestIdConflictResult,
  createTimeConsumeSuccessResult,
} from '../src/lib/license-result-service'

test('基础失败结果构造器会返回稳定错误对象', () => {
  assert.deepEqual(createMissingParamsResult(), {
    success: false,
    message: '激活码和机器ID不能为空',
    status: 400,
  })

  assert.deepEqual(createLicenseNotFoundResult(), {
    success: false,
    message: '激活码不存在',
    status: 404,
  })

  assert.deepEqual(createPendingConsumptionRequestResult(), {
    success: false,
    message: 'requestId 正在处理中，请稍后重试',
    status: 409,
  })

  assert.deepEqual(createRequestIdConflictResult(), {
    success: false,
    message: 'requestId 已被其他请求使用',
    status: 409,
  })
})

test('createActivationSuccessResult 会为次数型激活码返回剩余次数与有效性', () => {
  const result = createActivationSuccessResult(
    {
      licenseMode: 'COUNT',
      totalCount: 5,
      remainingCount: 2,
      isUsed: true,
      usedAt: new Date('2026-03-25T00:00:00.000Z'),
      expiresAt: null,
      validDays: null,
    },
    '激活码激活成功',
  )

  assert.deepEqual(result, {
    success: true,
    message: '激活码激活成功',
    status: 200,
    licenseMode: 'COUNT',
    expiresAt: null,
    remainingCount: 2,
    isActivated: true,
    valid: true,
  })
})

test('createLicenseStatusSuccessResult 会正确处理未激活时间型激活码状态', () => {
  const result = createLicenseStatusSuccessResult({
    licenseMode: 'TIME',
    isUsed: false,
    usedAt: null,
    expiresAt: null,
    validDays: 30,
    remainingCount: null,
  })

  assert.deepEqual(result, {
    success: true,
    message: '获取激活码状态成功',
    status: 200,
    licenseMode: 'TIME',
    expiresAt: null,
    remainingCount: null,
    isActivated: false,
    valid: true,
  })
})

test('消费成功结果构造器会按时间型与次数型输出对应字段', () => {
  const timeResult = createTimeConsumeSuccessResult({
    licenseMode: 'TIME',
    isUsed: true,
    usedAt: new Date('2026-03-25T00:00:00.000Z'),
    expiresAt: null,
    validDays: 30,
    remainingCount: null,
  })

  assert.deepEqual(timeResult, {
    success: true,
    message: '激活码验证成功',
    status: 200,
    licenseMode: 'TIME',
    expiresAt: new Date('2026-04-24T00:00:00.000Z'),
    isActivated: true,
    valid: true,
  })

  const countResult = createCountConsumeSuccessResult(
    {
      licenseMode: 'COUNT',
      totalCount: 5,
      remainingCount: 1,
      isUsed: true,
      usedAt: new Date('2026-03-25T00:00:00.000Z'),
      expiresAt: null,
      validDays: null,
    },
    {
      remainingCount: 0,
      idempotent: true,
      message: '请求已处理',
      includeExpiresAt: true,
    },
  )

  assert.deepEqual(countResult, {
    success: true,
    message: '请求已处理',
    status: 200,
    licenseMode: 'COUNT',
    remainingCount: 0,
    expiresAt: null,
    isActivated: true,
    valid: false,
    idempotent: true,
  })
})
