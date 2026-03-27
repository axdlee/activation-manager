import assert from 'node:assert/strict'
import test from 'node:test'

import {
  activationCodeWorkspaceTabs,
  auditLogWorkspaceTabs,
  apiDocsWorkspaceTabs,
  consumptionWorkspaceTabs,
  projectWorkspaceTabs,
} from '../src/lib/dashboard-workspace-tabs'

test('dashboard workspace tabs 按各自工作流顺序暴露配置', () => {
  assert.deepEqual(
    {
      project: projectWorkspaceTabs.map((tab) => tab.key),
      activationCode: activationCodeWorkspaceTabs.map((tab) => tab.key),
      consumption: consumptionWorkspaceTabs.map((tab) => tab.key),
      auditLogs: auditLogWorkspaceTabs.map((tab) => tab.key),
      apiDocs: apiDocsWorkspaceTabs.map((tab) => tab.key),
    },
    {
      project: ['manage'],
      activationCode: ['results', 'filters'],
      consumption: ['logs', 'filters'],
      auditLogs: ['logs', 'filters'],
      apiDocs: ['overview', 'endpoints', 'examples', 'admin'],
    },
  )
})

test('dashboard workspace tabs 为每个工作区提供标签、短标题与说明', () => {
  assert.deepEqual(apiDocsWorkspaceTabs[0], {
    key: 'overview',
    label: '接入概览',
    shortLabel: '概览',
    description: '先看调研路径、授权模型与字段规范',
  })
})
