import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { ChangePasswordWorkspace } from '../src/components/change-password-workspace'
import { buildChangePasswordPageModel } from '../src/lib/change-password-ui'

const defaultPageModel = buildChangePasswordPageModel({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const completedPageModel = buildChangePasswordPageModel({
  currentPassword: 'OldPass#2024',
  newPassword: 'Admin#2026',
  confirmPassword: 'Admin#2026',
})

test('ChangePasswordWorkspace 会渲染密码工作台摘要、行为提示与表单字段', () => {
  const html = renderToStaticMarkup(
    React.createElement(ChangePasswordWorkspace, {
      pageModel: defaultPageModel,
      completedChecklistCount: 0,
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      loading: false,
      inputClassName: 'input-class',
      onSubmit: () => {},
      onCurrentPasswordChange: () => {},
      onNewPasswordChange: () => {},
      onConfirmPasswordChange: () => {},
      togglePasswordFieldVisibility: () => {},
      isPasswordFieldVisible: () => false,
    }),
  )

  assert.equal(html.includes('管理员密码工作台'), true)
  assert.equal(html.includes('已填写'), true)
  assert.equal(html.includes('0/3'), true)
  assert.equal(html.includes('修改后行为'), true)
  assert.equal(html.includes('自动登出'), true)
  assert.equal(html.includes('当前密码'), true)
  assert.equal(html.includes('新密码'), true)
  assert.equal(html.includes('确认新密码'), true)
  assert.equal(html.includes('type="password"'), true)
  assert.equal(html.includes('当前密码安全检查'), true)
  assert.equal(html.includes('给管理员密码留一点冗余'), true)
  assert.equal(html.includes('修改密码'), true)
})

test('ChangePasswordWorkspace 会根据传入状态渲染通过检查、可见字段与 loading 提示', () => {
  const html = renderToStaticMarkup(
    React.createElement(ChangePasswordWorkspace, {
      pageModel: completedPageModel,
      completedChecklistCount: 3,
      currentPassword: 'OldPass#2024',
      newPassword: 'Admin#2026',
      confirmPassword: 'Admin#2026',
      loading: true,
      inputClassName: 'input-class',
      onSubmit: () => {},
      onCurrentPasswordChange: () => {},
      onNewPasswordChange: () => {},
      onConfirmPasswordChange: () => {},
      togglePasswordFieldVisibility: () => {},
      isPasswordFieldVisible: (key) => key === 'newPassword',
    }),
  )

  assert.match(html, />3<\/span>\s*\/\s*3 项安全检查。/u)
  assert.equal(html.includes('推荐'), true)
  assert.equal(html.includes('已匹配'), true)
  assert.equal(html.includes('type="text"'), true)
  assert.equal(html.includes('修改中...'), true)
  assert.equal(html.includes('已通过'), true)
  assert.equal(html.includes('✓'), true)
})
