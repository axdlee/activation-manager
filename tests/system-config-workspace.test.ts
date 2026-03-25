import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { SystemConfigWorkspace } from '../src/components/system-config-workspace'
import { buildSystemConfigWorkspaceTabs } from '../src/lib/dashboard-workspace-tabs'
import { buildSystemConfigPageModel } from '../src/lib/system-config-ui'

const pageModel = buildSystemConfigPageModel([
  {
    key: 'allowedIPs',
    value: ['127.0.0.1', '::1'],
    description: 'IP白名单列表',
  },
  {
    key: 'jwtSecret',
    value: '',
    description: 'JWT密钥',
    sensitive: true,
    masked: true,
    hasValue: true,
  },
  {
    key: 'jwtExpiresIn',
    value: '24h',
    description: 'JWT过期时间',
  },
  {
    key: 'bcryptRounds',
    value: 12,
    description: 'bcrypt加密强度',
  },
  {
    key: 'systemName',
    value: '激活码管理系统',
    description: '系统名称',
  },
])

test('buildSystemConfigWorkspaceTabs 会按总览到分区的顺序生成设置页 tabs', () => {
  assert.deepEqual(buildSystemConfigWorkspaceTabs(pageModel.groups), [
    {
      key: 'overview',
      label: '配置总览',
      shortLabel: '总览',
      description: '先看影响提示、分区入口与保存建议',
    },
    {
      key: 'access',
      label: '访问控制',
      shortLabel: '访问',
      description: '集中维护后台访问白名单与来源限制',
    },
    {
      key: 'security',
      label: '认证与会话',
      shortLabel: '安全',
      description: '统一处理 JWT、会话时长与密码强度',
    },
    {
      key: 'branding',
      label: '系统展示',
      shortLabel: '展示',
      description: '维护管理员侧可见的系统名称与品牌信息',
    },
  ])
})

test('SystemConfigWorkspace 支持以 security tab 作为初始工作区聚焦渲染安全配置', () => {
  const html = renderToStaticMarkup(
    React.createElement(SystemConfigWorkspace, {
      pageModel,
      systemConfigsCount: 5,
      sensitiveCount: 1,
      whitelistEntryCount: 2,
      loading: false,
      inputClassName: 'input-class',
      onSubmit: () => {},
      updateConfigValue: () => {},
      toggleSensitiveConfigVisibility: () => {},
      isSensitiveConfigVisible: () => false,
      initialTab: 'security',
    }),
  )

  assert.equal(html.includes('认证与会话'), true)
  assert.equal(html.includes('JWT 密钥'), true)
  assert.equal(html.includes('登录有效期'), true)
  assert.equal(html.includes('密码哈希强度'), true)
  assert.equal(html.includes('当前白名单预览'), false)
  assert.equal(html.includes('先确认这些关键影响'), false)
})

test('SystemConfigWorkspace 默认以 overview tab 展示影响提示与分区速览', () => {
  const html = renderToStaticMarkup(
    React.createElement(SystemConfigWorkspace, {
      pageModel,
      systemConfigsCount: 5,
      sensitiveCount: 1,
      whitelistEntryCount: 2,
      loading: false,
      inputClassName: 'input-class',
      onSubmit: () => {},
      updateConfigValue: () => {},
      toggleSensitiveConfigVisibility: () => {},
      isSensitiveConfigVisible: () => false,
    }),
  )

  assert.equal(html.includes('先确认这些关键影响'), true)
  assert.equal(html.includes('分区速览'), true)
  assert.equal(html.includes('访问控制'), true)
  assert.equal(html.includes('认证与会话'), true)
  assert.equal(html.includes('系统展示'), true)
})
