import assert from 'node:assert/strict'
import test from 'node:test'

import { buildChangePasswordPageModel } from '../src/lib/change-password-ui'

test('buildChangePasswordPageModel 会为未填写状态生成默认摘要与检查项', () => {
  const model = buildChangePasswordPageModel({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  assert.deepEqual(model.summaryCards, [
    {
      label: '已填写',
      value: '0/3',
      description: '当前密码、新密码与确认密码的完成度',
      tone: 'neutral',
    },
    {
      label: '新密码强度',
      value: '待设置',
      description: '请输入新密码后开始评估强度',
      tone: 'neutral',
    },
    {
      label: '确认状态',
      value: '待确认',
      description: '再次输入新密码以完成二次确认',
      tone: 'neutral',
    },
  ])

  assert.deepEqual(
    model.checklist.map((item) => ({
      key: item.key,
      satisfied: item.satisfied,
    })),
    [
      { key: 'length', satisfied: false },
      { key: 'difference', satisfied: false },
      { key: 'match', satisfied: false },
    ],
  )
})

test('buildChangePasswordPageModel 会为推荐密码生成正向状态', () => {
  const model = buildChangePasswordPageModel({
    currentPassword: 'OldPass#2024',
    newPassword: 'Admin#2026',
    confirmPassword: 'Admin#2026',
  })

  assert.deepEqual(model.summaryCards, [
    {
      label: '已填写',
      value: '3/3',
      description: '当前密码、新密码与确认密码的完成度',
      tone: 'success',
    },
    {
      label: '新密码强度',
      value: '推荐',
      description: '长度与复杂度较为均衡，适合管理员后台使用',
      tone: 'success',
    },
    {
      label: '确认状态',
      value: '已匹配',
      description: '新密码与确认密码保持一致',
      tone: 'success',
    },
  ])

  assert.deepEqual(
    model.checklist.map((item) => ({
      key: item.key,
      satisfied: item.satisfied,
    })),
    [
      { key: 'length', satisfied: true },
      { key: 'difference', satisfied: true },
      { key: 'match', satisfied: true },
    ],
  )
})

test('buildChangePasswordPageModel 会识别重复密码与确认不一致', () => {
  const model = buildChangePasswordPageModel({
    currentPassword: '123456',
    newPassword: '123456',
    confirmPassword: '12345',
  })

  assert.equal(model.summaryCards[1].value, '基础')
  assert.equal(model.summaryCards[1].tone, 'warning')
  assert.equal(model.summaryCards[2].value, '不一致')
  assert.equal(model.summaryCards[2].tone, 'danger')

  assert.deepEqual(
    model.checklist.map((item) => ({
      key: item.key,
      satisfied: item.satisfied,
    })),
    [
      { key: 'length', satisfied: true },
      { key: 'difference', satisfied: false },
      { key: 'match', satisfied: false },
    ],
  )
})
