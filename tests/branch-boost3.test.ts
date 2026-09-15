/**
 * 分支覆盖最终补充：query 边界、toast 类型、快捷时间范围分支。
 */
import './helpers/dom'
import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import {
  buildAdminProjectsFilterQuery,
  parseAdminProjectsFilterQuery,
} from '../src/lib/admin-projects-query'
import {
  buildAdminLicensesFilterQuery,
  parseAdminLicensesFilterQuery,
} from '../src/lib/admin-licenses-query'
import { ConsumptionsPage } from '../src/components/admin/consumptions-page'
import { ToastProvider, useToast } from '../src/components/toast-provider'

test('admin-projects-query：projectKey 透传与 page=1 省略', () => {
  const q = buildAdminProjectsFilterQuery({ keyword: 'a', status: 'all', sortBy: 'nameDesc', page: 1 })
  assert.match(q, /keyword=a/)
  assert.match(q, /sort=nameDesc/)
  assert.doesNotMatch(q, /page=/)
  const parsed = parseAdminProjectsFilterQuery(new URLSearchParams('keyword=+b &page=2'))
  assert.equal(parsed.page, 2)
})

test('admin-licenses-query：projectKey/cardType 默认省略', () => {
  const q = buildAdminLicensesFilterQuery({
    keyword: '',
    status: 'all',
    projectKey: 'all',
    cardType: 'all',
    page: 1,
  })
  assert.equal(q, '')
  const parsed = parseAdminLicensesFilterQuery(new URLSearchParams('projectKey=p1&cardType=c1'))
  assert.equal(parsed.projectKey, 'p1')
  assert.equal(parsed.cardType, 'c1')
})

function ToastProbeAll() {
  const { toast } = useToast()
  return React.createElement(
    'div',
    null,
    React.createElement('button', { type: 'button', onClick: () => toast.error('错误消息') }, 'err'),
    React.createElement('button', { type: 'button', onClick: () => toast.info('信息消息') }, 'info'),
  )
}

test('toast-provider：error/info 两种提示', async () => {
  render(React.createElement(ToastProvider, null, React.createElement(ToastProbeAll)))
  fireEvent.click(screen.getByRole('button', { name: 'err' }))
  await screen.findByText('错误消息')
  fireEvent.click(screen.getByRole('button', { name: 'info' }))
  await screen.findByText('信息消息')
})

test('消费页：三种快捷时间范围分支', async () => {
  const patches: Array<Record<string, unknown>> = []
  const base = {
    projectOptions: [],
    logs: [],
    pagination: { currentPage: 1, totalPages: 1, totalItems: 0, startIndex: 0, endIndex: 0 },
    onPageChange: () => {},
    onExport: () => {},
    onOpenDetail: () => {},
  }
  render(
    React.createElement(ConsumptionsPage, {
      ...base,
      filters: { keyword: '', projectKey: 'all', createdFrom: '', createdTo: '', page: 1 },
      onFiltersChange: (patch: Record<string, unknown>) => patches.push(patch),
      autoRefresh: false,
      onAutoRefreshChange: () => {},
    }),
  )
  for (const label of ['今天', '最近30天', '清空时间']) {
    fireEvent.click(screen.getByRole('button', { name: label }))
  }
  await waitFor(() => {
    // 今天(0 天偏移) 与最近30天(29) 与清空 共 3 次 patch
    assert.equal(patches.length, 3)
    assert.equal('createdFrom' in patches[0], true)
    assert.equal('createdFrom' in patches[2], true)
  })
})
