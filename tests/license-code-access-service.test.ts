import assert from 'node:assert/strict'
import test from 'node:test'

import { loadLicenseActionCodeForMachine } from '../src/lib/license-code-access-service'

test('loadLicenseActionCodeForMachine 在激活码不存在时返回统一的 not found 结果', async () => {
  const result = await loadLicenseActionCodeForMachine({
    machineId: 'machine-001',
    reloadActivationCode: async () => null,
  })

  assert.deepEqual(result, {
    result: {
      success: false,
      message: '激活码不存在',
      status: 404,
    },
  })
})

test('loadLicenseActionCodeForMachine 在激活码被其他设备占用时返回统一冲突结果', async () => {
  const result = await loadLicenseActionCodeForMachine({
    machineId: 'machine-001',
    reloadActivationCode: async () => ({
      id: 1,
      code: 'CODE-001',
      licenseMode: 'COUNT',
      isUsed: true,
      usedAt: new Date('2026-03-25T00:00:00.000Z'),
      expiresAt: null,
      validDays: null,
      remainingCount: 3,
      usedBy: 'machine-002',
    }),
  })

  assert.deepEqual(result, {
    result: {
      success: false,
      message: '激活码已被其他设备使用',
      status: 400,
    },
  })
})

test('loadLicenseActionCodeForMachine 在当前设备可用时返回激活码实体', async () => {
  const activationCode = {
    id: 1,
    code: 'CODE-001',
    licenseMode: 'TIME',
    isUsed: true,
    usedAt: new Date('2026-03-25T00:00:00.000Z'),
    expiresAt: new Date('2026-03-26T00:00:00.000Z'),
    validDays: 1,
    remainingCount: null,
    usedBy: 'machine-001',
  }

  const result = await loadLicenseActionCodeForMachine({
    machineId: 'machine-001',
    reloadActivationCode: async () => activationCode,
  })

  assert.deepEqual(result, {
    activationCode,
  })
})
