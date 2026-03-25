import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { ApiDocsAdminGroupCard } from '../src/components/api-docs-admin-group-card'

test('ApiDocsAdminGroupCard 会渲染后台接口分组卡与接口条目', () => {
  const html = renderToStaticMarkup(
    React.createElement(ApiDocsAdminGroupCard, {
      title: '项目与发码',
      description: '联调之前先准备 projectKey 和测试激活码。',
      endpoints: [
        {
          method: 'POST',
          path: '/api/admin/projects',
          description: '创建项目。',
        },
        {
          method: 'GET',
          path: '/api/admin/codes/list',
          description: '查看激活码列表。',
        },
      ],
      methodBadgeClassNameMap: {
        GET: 'badge-get',
        POST: 'badge-post',
        PATCH: 'badge-patch',
        DELETE: 'badge-delete',
      },
    }),
  )

  assert.match(
    html,
    /rounded-\[24px\] border border-slate-200\/80 bg-white\/92 p-5 shadow-\[0_18px_56px_-42px_rgba\(15,23,42,0\.22\)\]/,
  )
  assert.match(html, /项目与发码/)
  assert.match(html, /联调之前先准备 projectKey 和测试激活码/)
  assert.match(html, /badge-post/)
  assert.match(html, /badge-get/)
  assert.match(html, /\/api\/admin\/projects/)
  assert.match(html, /\/api\/admin\/codes\/list/)
  assert.match(html, /创建项目/)
  assert.match(html, /查看激活码列表/)
})

test('ApiDocsAdminGroupCard 支持覆盖容器、列表与条目样式', () => {
  const html = renderToStaticMarkup(
    React.createElement(ApiDocsAdminGroupCard, {
      title: '日志与统计',
      description: '用于排查消费异常。',
      endpoints: [
        {
          method: 'GET',
          path: '/api/admin/consumptions',
          description: '查询消费日志。',
        },
      ],
      methodBadgeClassNameMap: {
        GET: 'badge-get',
        POST: 'badge-post',
        PATCH: 'badge-patch',
        DELETE: 'badge-delete',
      },
      className: 'custom-group',
      endpointListClassName: 'custom-list',
      endpointClassName: 'custom-item',
    }),
  )

  assert.match(html, /custom-group/)
  assert.match(html, /custom-list/)
  assert.match(html, /custom-item/)
})
