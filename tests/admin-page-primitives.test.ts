import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { PageHeader } from '../src/components/admin/page-header'
import { PageToolbar } from '../src/components/admin/page-toolbar'
import { PageSection } from '../src/components/admin/page-section'
import { DetailDrawer } from '../src/components/admin/detail-drawer'
import { ConfirmDialog } from '../src/components/admin/confirm-dialog'
import { EmptyState } from '../src/components/admin/empty-state'
import { ErrorState } from '../src/components/admin/error-state'
import { StickySaveBar } from '../src/components/admin/sticky-save-bar'

test('PageHeader：单 h1、描述与动作槽', () => {
  const html = renderToStaticMarkup(
    React.createElement(PageHeader, {
      title: '项目管理',
      description: '维护项目与 projectKey',
      eyebrow: '运营',
      actions: React.createElement('button', { type: 'button' }, '新建项目'),
    }),
  )
  assert.equal((html.match(/<h1/g) ?? []).length, 1)
  assert.match(html, /项目管理/)
  assert.match(html, /维护项目与 projectKey/)
  assert.match(html, /新建项目/)
  assert.match(html, /运营/)
})

test('PageHeader：面包屑渲染为 nav', () => {
  const html = renderToStaticMarkup(
    React.createElement(PageHeader, {
      title: '详情',
      breadcrumbs: [
        { label: '项目', href: '/admin/projects' },
        { label: '当前项目' },
      ],
    }),
  )
  assert.match(html, /aria-label="Breadcrumb"/)
  assert.match(html, /项目/)
})

test('PageToolbar：role=toolbar 且左右槽渲染', () => {
  const html = renderToStaticMarkup(
    React.createElement(PageToolbar, {
      filters: React.createElement('input', { placeholder: '搜索' }),
      actions: React.createElement('button', { type: 'button' }, '导出'),
    }),
  )
  assert.match(html, /role="toolbar"/)
  assert.match(html, /搜索/)
  assert.match(html, /导出/)
})

test('PageToolbar：无内容时不渲染', () => {
  const html = renderToStaticMarkup(React.createElement(PageToolbar, {}))
  assert.equal(html, '')
})

test('PageSection：card 变体带表面，plain 变体纯排版', () => {
  const card = renderToStaticMarkup(
    React.createElement(PageSection, { title: '列表', children: React.createElement('div', null, '内容') }),
  )
  assert.match(card, /bg-card/)
  const plain = renderToStaticMarkup(
    React.createElement(PageSection, { title: '列表', variant: 'plain', children: React.createElement('div', null, '内容') }),
  )
  assert.doesNotMatch(plain, /bg-card/)
})

test('DetailDrawer：role=dialog、标题 id 关联、关闭按钮', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      DetailDrawer,
      {
        open: true,
        onOpenChange: () => {},
        title: '项目详情',
        description: '策略与绑定',
        children: React.createElement('div', null, '内容'),
      },
    ),
  )
  assert.match(html, /role="dialog"/)
  assert.match(html, /aria-modal="true"/)
  assert.match(html, /项目详情/)
  assert.match(html, /关闭详情/)
})

test('DetailDrawer：关闭时不渲染', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      DetailDrawer,
      { open: false, onOpenChange: () => {}, title: '详情', children: null },
    ),
  )
  assert.equal(html, '')
})

test('ConfirmDialog：标题/目标/取消/确认', () => {
  const html = renderToStaticMarkup(
    React.createElement(ConfirmDialog, {
      open: true,
      onOpenChange: () => {},
      title: '删除项目',
      targetLabel: 'e2e-project',
      description: '该操作不可逆',
      destructive: true,
      confirmLabel: '删除',
      onConfirm: () => {},
      children: '',
    }),
  )
  assert.match(html, /删除项目/)
  assert.match(html, /e2e-project/)
  assert.match(html, /该操作不可逆/)
  assert.match(html, /删除/)
  assert.match(html, /取消/)
})

test('StickySaveBar：显示未保存数与按钮', () => {
  const html = renderToStaticMarkup(
    React.createElement(StickySaveBar, {
      dirtyCount: 3,
      onReset: () => {},
      onSave: () => {},
    }),
  )
  assert.match(html, /3 项未保存/)
  assert.match(html, /重置/)
  assert.match(html, /保存更改/)
})

test('StickySaveBar：无未保存且非保存中时隐藏', () => {
  const html = renderToStaticMarkup(
    React.createElement(StickySaveBar, { dirtyCount: 0, onReset: () => {}, onSave: () => {} }),
  )
  assert.equal(html, '')
})

test('EmptyState：标题/描述/动作', () => {
  const html = renderToStaticMarkup(
    React.createElement(EmptyState, {
      title: '暂无项目',
      description: '创建第一个项目开始发码',
      action: React.createElement('button', { type: 'button' }, '新建项目'),
    }),
  )
  assert.match(html, /暂无项目/)
  assert.match(html, /创建第一个项目开始发码/)
  assert.match(html, /新建项目/)
})

test('ErrorState：告警语义与重试', () => {
  const html = renderToStaticMarkup(
    React.createElement(ErrorState, { message: '网络超时', retry: () => {} }),
  )
  assert.match(html, /role="alert"/)
  assert.match(html, /网络超时/)
  assert.match(html, /重试/)
})
