import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  DashboardTableContainer,
  clearPendingDragSuppression,
  isInteractiveDragTarget,
  resolveHorizontalWheelDelta,
} from '../src/components/dashboard-table-container'

test('DashboardTableContainer 会渲染默认表格容器样式与子节点', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      DashboardTableContainer,
      null,
      React.createElement('table', { className: 'table-slot' }, React.createElement('tbody', null)),
    ),
  )

  assert.match(html, /table-slot/)
  assert.match(
    html,
    /dashboard-scroll-area overflow-x-auto overflow-y-hidden touch-pan-x rounded-\[24px\] border border-slate-200\/80 bg-white\/95 shadow-\[0_18px_56px_-42px_rgba\(15,23,42,0\.22\)\] cursor-grab/u,
  )
})

test('DashboardTableContainer 支持覆盖外层 className', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      DashboardTableContainer,
      { className: 'custom-table-shell' },
      React.createElement('div', null, 'content'),
    ),
  )

  assert.match(html, /custom-table-shell/)
})

test('isInteractiveDragTarget 会识别按钮等交互元素，避免表格拖拽吞掉点击', () => {
  const buttonLikeTarget = {
    closest: () => ({ nodeName: 'BUTTON' }),
    isContentEditable: false,
  }

  assert.equal(isInteractiveDragTarget(buttonLikeTarget as unknown as EventTarget), true)
})

test('isInteractiveDragTarget 会识别可编辑区域，但忽略普通非交互节点', () => {
  const editableTarget = {
    closest: () => null,
    isContentEditable: true,
  }
  const plainTarget = {
    closest: () => null,
    isContentEditable: false,
  }

  assert.equal(isInteractiveDragTarget(editableTarget as unknown as EventTarget), true)
  assert.equal(isInteractiveDragTarget(plainTarget as unknown as EventTarget), false)
  assert.equal(isInteractiveDragTarget(null), false)
})

test('clearPendingDragSuppression 会在新的真实点击开始前清除遗留拖拽抑制状态', () => {
  assert.deepEqual(
    clearPendingDragSuppression({
      pointerId: -1,
      startX: 48,
      startScrollLeft: 160,
      dragged: true,
    }),
    {
      pointerId: -1,
      startX: 48,
      startScrollLeft: 160,
      dragged: false,
    },
  )

  const idleState = {
    pointerId: -1,
    startX: 0,
    startScrollLeft: 0,
    dragged: false,
  }

  assert.strictEqual(clearPendingDragSuppression(idleState), idleState)
})

test('resolveHorizontalWheelDelta 会优先消费横向滚轮，并在按住 Shift 时把纵向滚轮转为横向滚动', () => {
  assert.equal(resolveHorizontalWheelDelta({ deltaX: 36, deltaY: 0, shiftKey: false }), 36)
  assert.equal(resolveHorizontalWheelDelta({ deltaX: 0, deltaY: 64, shiftKey: true }), 64)
  assert.equal(resolveHorizontalWheelDelta({ deltaX: 0, deltaY: 48, shiftKey: false }), 0)
})
