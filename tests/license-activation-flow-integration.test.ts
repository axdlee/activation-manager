/**
 * 激活流程集成测试（真实 SQLite）：
 * 单元测试对 updateMany 的 mock 恒返回 count:1，掩盖了抢占失败路径。
 * 这里用真实数据库验证条件更新语义：
 * 1. 异机激活已用码：updateMany count=0 → 「已被其他设备使用」
 * 2. COUNT 次数耗尽拒绝
 * 3. bindDevice=false 时不落 usedBy，异机二次激活仍成功
 * 4. TIME 码到期拒绝
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { prisma } from '../src/lib/db'
import { bootstrapDevelopmentDatabase } from '../src/lib/dev-bootstrap'
import {
  activateCountLicense,
  activateTimeLicense,
} from '../src/lib/license-activation-flow-service'

const silentLogger = { log: () => undefined, error: () => undefined }

test.before(async () => {
  await bootstrapDevelopmentDatabase({ logger: silentLogger })
})

test.after(async () => {
  await prisma.$disconnect()
})

test.afterEach(async () => {
  // 先清引用激活码的子表，再清码本身（外键约束）
  await prisma.activationCodeBindingHistory.deleteMany({})
  await prisma.licenseConsumption.deleteMany({})
  await prisma.shopProductCodeStock.deleteMany({})
  await prisma.activationCode.deleteMany({})
})

async function seedCountCode(overrides: Partial<{ remainingCount: number; totalCount: number }> = {}) {
  const project = await prisma.project.findFirstOrThrow({ where: { projectKey: 'default' } })
  return prisma.activationCode.create({
    data: {
      code: `COUNT-INTG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      projectId: project.id,
      licenseMode: 'COUNT',
      totalCount: overrides.totalCount ?? 5,
      remainingCount: overrides.remainingCount ?? 5,
      consumedCount: 0,
    },
  })
}

async function seedTimeCode(validDays: number | null) {
  const project = await prisma.project.findFirstOrThrow({ where: { projectKey: 'default' } })
  return prisma.activationCode.create({
    data: {
      code: `TIME-INTG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      projectId: project.id,
      licenseMode: 'TIME',
      validDays,
    },
  })
}

const conflictResolver = () => Promise.resolve({ success: false, status: 409, message: 'project-machine-conflict' } as never)

// 项目+设备 维度有唯一约束：每轮测试用独立机器号，避免历史绑定数据干扰
const MACHINE_A = `intg-a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const MACHINE_B = `intg-b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const MACHINE_C = `intg-c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

async function reloadCode(id: number) {
  return prisma.activationCode.findUniqueOrThrow({ where: { id } })
}

test('COUNT：首次激活真实抢占成功并落设备', async () => {
  const code = await seedCountCode()
  const record = await reloadCode(code.id)

  const result = await activateCountLicense({
    tx: prisma,
    activationCode: record,
    machineId: MACHINE_A,
    resolveProjectMachineConflict: conflictResolver,
  })

  assert.equal(result.success, true)
  const after = await reloadCode(code.id)
  assert.equal(after.isUsed, true)
  assert.equal(after.usedBy, MACHINE_A)
})

test('COUNT：异机激活已用码走真实 count=0 路径被拒', async () => {
  const code = await seedCountCode()
  const record = await reloadCode(code.id)

  await activateCountLicense({
    tx: prisma,
    activationCode: record,
    machineId: MACHINE_A,
    resolveProjectMachineConflict: conflictResolver,
  })

  // machine-B 拿着旧快照（isUsed=false）来激活：updateMany 条件不匹配
  const staleRecord = await reloadCode(code.id)
  staleRecord.isUsed = false
  staleRecord.usedBy = null

  const result = await activateCountLicense({
    tx: prisma,
    activationCode: staleRecord,
    machineId: MACHINE_B,
    resolveProjectMachineConflict: conflictResolver,
  })

  assert.equal(result.success, false)
  const after = await reloadCode(code.id)
  assert.equal(after.usedBy, MACHINE_A, '设备绑定不应被抢占失败的请求改写')
})

test('COUNT：同机重复激活幂等成功且不重复扣次数', async () => {
  const code = await seedCountCode()
  const record = await reloadCode(code.id)

  await activateCountLicense({
    tx: prisma,
    activationCode: record,
    machineId: MACHINE_A,
    resolveProjectMachineConflict: conflictResolver,
  })

  const usedRecord = await reloadCode(code.id)
  const result = await activateCountLicense({
    tx: prisma,
    activationCode: usedRecord,
    machineId: MACHINE_A,
    resolveProjectMachineConflict: conflictResolver,
  })

  assert.equal(result.success, true)
  const after = await reloadCode(code.id)
  assert.equal(after.consumedCount, usedRecord.consumedCount)
})

test('COUNT：次数耗尽后激活被拒', async () => {
  const code = await seedCountCode({ remainingCount: 0, totalCount: 3 })
  const record = await reloadCode(code.id)

  const result = await activateCountLicense({
    tx: prisma,
    activationCode: record,
    machineId: MACHINE_A,
    resolveProjectMachineConflict: conflictResolver,
  })

  assert.equal(result.success, false)
})

test('COUNT：bindDevice=false 首次不落设备，异机二次激活成功', async () => {
  const code = await seedCountCode()
  const record = await reloadCode(code.id)

  const first = await activateCountLicense({
    tx: prisma,
    activationCode: record,
    machineId: MACHINE_A,
    resolveProjectMachineConflict: conflictResolver,
    bindDevice: false,
  })
  assert.equal(first.success, true)

  const afterFirst = await reloadCode(code.id)
  assert.equal(afterFirst.isUsed, true)
  assert.equal(afterFirst.usedBy, null, 'bindDevice=false 不应写入设备')

  // 批次1修复的分支：isUsed=true 且 usedBy=null 时另一设备可激活
  const second = await activateCountLicense({
    tx: prisma,
    activationCode: afterFirst,
    machineId: MACHINE_B,
    resolveProjectMachineConflict: conflictResolver,
    bindDevice: false,
  })
  assert.equal(second.success, true)

  // 开启绑定的设备也能在此状态下补绑
  const third = await activateCountLicense({
    tx: prisma,
    activationCode: await reloadCode(code.id),
    machineId: MACHINE_C,
    resolveProjectMachineConflict: conflictResolver,
  })
  assert.equal(third.success, true)
  const afterThird = await reloadCode(code.id)
  assert.equal(afterThird.usedBy, MACHINE_C)
})

test('TIME：有效期内异机激活被拒', async () => {
  const code = await seedTimeCode(30)
  const record = await reloadCode(code.id)

  await activateTimeLicense({
    tx: prisma,
    activationCode: record,
    machineId: MACHINE_A,
    resolveProjectMachineConflict: conflictResolver,
  })

  const staleRecord = await reloadCode(code.id)
  staleRecord.isUsed = false
  staleRecord.usedBy = null

  const result = await activateTimeLicense({
    tx: prisma,
    activationCode: staleRecord,
    machineId: MACHINE_B,
    resolveProjectMachineConflict: conflictResolver,
  })

  assert.equal(result.success, false)
})

test('TIME：首次激活真实写入 expiresAt', async () => {
  const code = await seedTimeCode(30)
  const record = await reloadCode(code.id)

  const result = await activateTimeLicense({
    tx: prisma,
    activationCode: record,
    machineId: MACHINE_A,
    resolveProjectMachineConflict: conflictResolver,
  })

  assert.equal(result.success, true)
  const after = await reloadCode(code.id)
  assert.equal(after.isUsed, true)
  assert.ok(after.expiresAt !== null, 'TIME 首次激活应写入 expiresAt')
  assert.ok(after.expiresAt! > new Date(), '有效期应在未来')
})
