/**
 * 通知渠道子 Tab + 支付渠道 Tab 行为测试（渠道分组渲染/切换/兜底）。
 */
import './helpers/dom'
import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { SystemConfigWorkspace } from '../src/components/system-config-workspace'
import type { SystemConfigDisplayItem, SystemConfigGroup } from '../src/lib/system-config-ui'

test.afterEach(() => {
  cleanup()
  document.body.removeAttribute('data-scroll-locked')
  document.body.style.removeProperty('pointer-events')
})

const notificationItems: SystemConfigDisplayItem[] = [
  {
    key: 'notifyWebhookUrl',
    label: '通用通知 Webhook',
    description: 'Webhook 描述',
    hint: '留空表示不通知',
    value: '',
    inputKind: 'text',
    placeholder: 'https://example.com/hooks',
    layout: 'full',
    badges: [{ label: '未启用', tone: 'warning' }],
  },
  {
    key: 'notifyEmailSmtpHost',
    label: 'SMTP 服务器',
    description: 'SMTP 描述',
    hint: '例如 smtp.qq.com',
    value: 'smtp.qq.com',
    inputKind: 'text',
    placeholder: 'smtp.example.com',
    layout: 'default',
    badges: [{ label: '邮件通知已启用', tone: 'success' }],
  },
  {
    key: 'notifySmsApiUrl',
    label: '短信接口地址',
    description: '短信描述',
    hint: '留空表示不启用短信',
    value: '',
    inputKind: 'text',
    placeholder: 'https://sms.example.com/send',
    layout: 'full',
    badges: [{ label: '未启用', tone: 'warning' }],
  },
]

const notificationGroup: SystemConfigGroup = {
  key: 'notification',
  title: '通知与告警',
  description: '通知渠道测试分组',
  badge: '通知',
  items: notificationItems,
}

function renderWorkspace(groups: SystemConfigGroup[]) {
  return render(
    React.createElement(SystemConfigWorkspace, {
      pageModel: {
        groups,
        summaryCards: [{ label: '配置项', value: '3', description: '测试' }],
      },
      systemConfigsCount: 3,
      sensitiveCount: 0,
      whitelistEntryCount: 0,
      loading: false,
      inputClassName: 'test-input',
      initialTab: 'notification',
      showHeader: false,
      onSubmit: () => undefined,
      updateConfigValue: () => undefined,
      toggleSensitiveConfigVisibility: () => undefined,
      isSensitiveConfigVisible: () => false,
    }),
  )
}

test('通知分区按渠道渲染子 Tab，默认 Webhook 面板', () => {
  renderWorkspace([notificationGroup])
  const tabs = screen.getAllByRole('tab')
  assert.equal(tabs.length, 3)
  assert.ok(screen.getByText('通用通知 Webhook'))
  assert.ok(!screen.queryByText('SMTP 服务器'))
  // Webhook 未启用 → 灰色状态圆点
  assert.ok(document.querySelector('button[role="tab"] span.bg-muted-foreground\\/40'))
})

test('切换邮件 Tab 后仅渲染 SMTP 字段且启用徽标生效', () => {
  renderWorkspace([notificationGroup])
  fireEvent.click(screen.getByText('邮件通知（SMTP）'))
  assert.ok(screen.getByText('SMTP 服务器'))
  assert.ok(!screen.queryByText('通用通知 Webhook'))
  // SMTP Host 已填 → 邮件渠道启用（绿色状态点）
  assert.ok(document.querySelector('button[role="tab"] span.bg-emerald-500'))
})

test('未知配置 key 兜底进入 Webhook 渠道桶', () => {
  renderWorkspace([
    {
      ...notificationGroup,
      items: [{ ...notificationItems[0], key: 'notifyCustomFutureKey', label: '未来通知项' }],
    },
  ])
  assert.ok(screen.getByText('未来通知项'))
})
