/**
 * 激活码任务页行为测试：生成页三段式、管理页筛选/详情抽屉（原函数覆盖 52-58%）。
 */
import './helpers/dom'
import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { LicenseGenerationPage } from '../src/components/admin/license-generation-page'
import { LicensesPage } from '../src/components/admin/licenses-page'
import { cardTypes } from '../src/lib/dashboard-page-types'
import type { LicenseModeValue } from '../src/lib/license-status'

test.afterEach(() => {
  cleanup()
  document.body.removeAttribute('data-scroll-locked')
  document.body.style.removeProperty('pointer-events')
})

function genProps(overrides: Record<string, unknown> = {}) {
  return {
    loading: false,
    projects: [{ id: 1, name: '默认项目', projectKey: 'default', isEnabled: true }],
    cardTypes,
    generatedCodes: [],
    onCopyCode: () => {},
    form: {
      selectedProjectKey: 'default',
      onProjectKeyChange: () => {},
      licenseMode: 'TIME' as LicenseModeValue,
      onLicenseModeChange: () => {},
      amount: 1,
      onAmountChange: () => {},
      selectedCardType: '',
      onCardTypeChange: () => {},
      expiryDaysValue: 30,
      onExpiryDaysChange: () => {},
      totalCount: 10,
      onTotalCountChange: () => {},
      rebindPolicyValue: 'inherit',
      onRebindPolicyChange: () => {},
      rebindCooldownMinutesValue: '',
      onRebindCooldownMinutesChange: () => {},
      rebindMaxCountValue: '',
      onRebindMaxCountChange: () => {},
      onSubmit: () => {},
    },
    ...overrides,
  }
}

test('生成页：模式切换与高级折叠回调', () => {
  let mode = 'TIME'
  let policy = 'inherit'
  const utils = render(
    React.createElement(LicenseGenerationPage, genProps({
      form: {
        selectedProjectKey: 'default',
        onProjectKeyChange: () => {},
        licenseMode: 'TIME',
        onLicenseModeChange: (value: string) => {
          mode = value
        },
        amount: 1,
        onAmountChange: () => {},
        selectedCardType: '',
        onCardTypeChange: () => {},
        expiryDaysValue: 30,
        onExpiryDaysChange: () => {},
        totalCount: 10,
        onTotalCountChange: () => {},
        rebindPolicyValue: 'inherit',
        onRebindPolicyChange: (value: string) => {
          policy = value
        },
        rebindCooldownMinutesValue: '',
        onRebindCooldownMinutesChange: () => {},
        rebindMaxCountValue: '',
        onRebindMaxCountChange: () => {},
        onSubmit: () => {},
      },
    })),
  )

  fireEvent.change(utils.container.querySelector('#generate-license-mode')!, {
    target: { value: 'COUNT' },
  })
  assert.equal(mode, 'COUNT')

  const summary = utils.container.querySelector('details summary')!
  fireEvent.click(summary)
  fireEvent.change(utils.container.querySelector('#generate-rebind-policy')!, {
    target: { value: 'enabled' },
  })
  assert.equal(policy, 'enabled')
})

test('生成页：数量与有效期回调', () => {
  let expiry = 30
  const utils = render(
    React.createElement(LicenseGenerationPage, genProps({
      form: {
        selectedProjectKey: 'default',
        onProjectKeyChange: () => {},
        licenseMode: 'TIME',
        onLicenseModeChange: () => {},
        amount: 3,
        onAmountChange: () => {},
        selectedCardType: '自定义',
        onCardTypeChange: () => {},
        expiryDaysValue: 30,
        onExpiryDaysChange: (value: number) => {
          expiry = value
        },
        totalCount: 10,
        onTotalCountChange: () => {},
        rebindPolicyValue: 'inherit',
        onRebindPolicyChange: () => {},
        rebindCooldownMinutesValue: '',
        onRebindCooldownMinutesChange: () => {},
        rebindMaxCountValue: '',
        onRebindMaxCountChange: () => {},
        onSubmit: () => {},
      },
    })),
  )
  fireEvent.change(utils.container.querySelector('#generate-expiry-days')!, {
    target: { value: '45' },
  })
  assert.equal(expiry, 45)
})

// ── 管理页 ─────────────────────────────────────────────────

const logs = [
  {
    id: 1,
    code: 'CODE-001',
    licenseMode: 'TIME' as const,
    createdAt: '2026-03-01T00:00:00.000Z',
    usedAt: null,
    usedBy: 'machine-a',
    isUsed: true,
    expiresAt: null,
    validDays: 30,
    remainingCount: 4,
    totalCount: 10,
    consumedCount: 6,
    projectId: 1,
    allowAutoRebind: true,
    autoRebindCooldownMinutes: 60,
    autoRebindMaxCount: 3,
    lastBoundAt: null,
    lastRebindAt: null,
    rebindCount: 1,
    autoRebindCount: 0,
    project: { id: 1, name: '浏览器插件', projectKey: 'browser-plugin' },
  },
]

function mgmtProps(overrides: Record<string, unknown> = {}) {
  const spies = {
    copied: '',
    deleted: null as unknown as { id: number },
    opened: null as unknown as { id: number },
    exported: 0,
    cleaned: 0,
    page: 0,
    filterPatch: undefined as unknown as Record<string, unknown>,
  }
  const props = {
    loading: false,
    filters: { keyword: '', status: 'all' as const, projectKey: 'all', cardType: 'all', page: 1 },
    onFiltersChange: (patch: Record<string, unknown>) => {
      spies.filterPatch = patch
    },
    projectOptions: [{ id: 1, name: '浏览器插件', projectKey: 'browser-plugin' }],
    availableCardTypes: ['月卡'],
    statusSummary: { unused: 1, inUse: 0, risk: 0 },
    codes: logs,
    pagination: { currentPage: 1, totalPages: 2, totalItems: 12, startIndex: 1, endIndex: 10 },
    onPageChange: (page: number) => {
      spies.page = page
    },
    onCopyCode: (code: string) => {
      spies.copied = code
    },
    onDeleteRequest: (code: { id: number }) => {
      spies.deleted = code
    },
    onOpenDetail: (code: { id: number }) => {
      spies.opened = code
    },
    onExport: () => {
      spies.exported += 1
    },
    onCleanupRequest: () => {
      spies.cleaned += 1
    },
    ...spies,
    ...overrides,
  }
  return { props, spies }
}

test('管理页：筛选、导出、清理与分页回调', async () => {
  const { props, spies } = mgmtProps()
  render(React.createElement(LicensesPage, props))
  await screen.findByText('CODE-001')

  fireEvent.change(screen.getByLabelText('搜索激活码或机器ID'), { target: { value: 'CODE' } })
  assert.equal((spies.filterPatch as { keyword?: string }).keyword, 'CODE')

  fireEvent.click(screen.getByRole('button', { name: '导出筛选结果' }))
  fireEvent.click(screen.getByRole('button', { name: '清理过期绑定' }))
  fireEvent.click(screen.getByRole('button', { name: '下一页' }))
  await waitFor(() => {
    assert.equal(spies.exported, 1)
    assert.equal(spies.cleaned, 1)
    assert.equal(spies.page, 2)
  })
})

test('管理页：更多菜单复制与详情回调', async () => {
  const { props, spies } = mgmtProps()
  render(React.createElement(LicensesPage, props))
  const more = await screen.findByRole('button', { name: '更多操作' })
  fireEvent.pointerDown(more)
  fireEvent.click(more)
  fireEvent.click(await screen.findByText('复制激活码'))

  // 选择第一项后菜单关闭；重新打开执行第二项
  fireEvent.pointerDown(more)
  fireEvent.click(more)
  fireEvent.click(await screen.findByText('详情与策略'))
  await waitFor(() => {
    assert.equal(spies.copied, 'CODE-001')
    assert.equal(spies.opened?.id, 1)
  })
})
