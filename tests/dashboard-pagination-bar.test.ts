import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { DashboardPaginationBar } from '../src/components/dashboard-pagination-bar'

test('DashboardPaginationBar 会渲染摘要、上一页下一页与页码按钮', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardPaginationBar, {
      currentPage: 2,
      totalPages: 4,
      summary: '显示第 11 - 20 条，共 35 条记录',
      onPageChange: () => undefined,
      buttonClassName: 'pagination-button',
      activeButtonClassName: 'pagination-active',
    }),
  )

  assert.match(html, /显示第 11 - 20 条，共 35 条记录/)
  assert.match(html, /上一页/)
  assert.match(html, /下一页/)
  assert.match(html, />1<\/button>/)
  assert.match(html, />2<\/button>/)
  assert.match(html, />4<\/button>/)
  assert.match(html, /mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between/)
  assert.match(html, /pagination-button pagination-active/)
})

test('DashboardPaginationBar 在边界页会正确输出 disabled 状态，并支持自定义容器样式', () => {
  const firstPageHtml = renderToStaticMarkup(
    React.createElement(DashboardPaginationBar, {
      currentPage: 1,
      totalPages: 3,
      summary: '第一页',
      onPageChange: () => undefined,
      buttonClassName: 'btn',
      activeButtonClassName: 'btn-active',
      className: 'custom-bar',
    }),
  )

  const lastPageHtml = renderToStaticMarkup(
    React.createElement(DashboardPaginationBar, {
      currentPage: 3,
      totalPages: 3,
      summary: '最后一页',
      onPageChange: () => undefined,
      buttonClassName: 'btn',
      activeButtonClassName: 'btn-active',
    }),
  )

  assert.match(firstPageHtml, /custom-bar/)
  assert.match(firstPageHtml, /上一页<\/button>/)
  assert.match(firstPageHtml, /disabled=""/)
  assert.match(lastPageHtml, /下一页<\/button>/)
  assert.match(lastPageHtml, /disabled=""/)
})

test('DashboardPaginationBar 在 totalPages 小于等于 1 时不渲染内容', () => {
  const html = renderToStaticMarkup(
    React.createElement(DashboardPaginationBar, {
      currentPage: 1,
      totalPages: 1,
      summary: '单页',
      onPageChange: () => undefined,
      buttonClassName: 'btn',
      activeButtonClassName: 'btn-active',
    }),
  )

  assert.equal(html, '')
})
