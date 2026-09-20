import '/Users/yeelight/Desktop/workspace/test/activation-manager/tests/helpers/dom'
import React from 'react'
import { render, fireEvent, screen } from '@testing-library/react'
import { SystemConfigWorkspace } from '/Users/yeelight/Desktop/workspace/test/activation-manager/src/components/system-config-workspace'
import type { SystemConfigDisplayItem, SystemConfigGroup } from '/Users/yeelight/Desktop/workspace/test/activation-manager/src/lib/system-config-ui'

test('debug email tab inputs', async () => {
  const items: SystemConfigDisplayItem[] = [
    { key: 'notifyEmailSmtpHost', label: 'SMTP 服务器', description: 'd', hint: 'h', value: 'smtp.qq.com', inputKind: 'text', placeholder: '', layout: 'default', badges: [] },
    { key: 'notifyEmailSmtpPort', label: 'SMTP 端口', description: 'd', hint: 'h', value: 465, inputKind: 'number', min: 1, max: 65535, step: 1, layout: 'default', badges: [] },
  ]
  const group: SystemConfigGroup = { key: 'notification', title: 't', description: 'd', badge: 'b', items }
  render(React.createElement(SystemConfigWorkspace, {
    pageModel: { groups: [group], summaryCards: [] },
    systemConfigsCount: 2, sensitiveCount: 0, whitelistEntryCount: 0, loading: false,
    inputClassName: '', initialTab: 'notification', showHeader: false,
    onSubmit: () => undefined, updateConfigValue: () => undefined,
    toggleSensitiveConfigVisibility: () => undefined, isSensitiveConfigVisible: () => false,
  }))
  const emailTab = [...document.querySelectorAll('button[role=tab]')].find(b => b.textContent?.includes('邮件'))
  fireEvent.click(emailTab!)
  await screen.findByDisplayValue('smtp.qq.com')
  const inputs = [...document.querySelectorAll('input')].map(i => `${i.type}=${i.value}`)
  console.log('INPUTS:', inputs.join(' | '))
})
