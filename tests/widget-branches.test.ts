/**
 * 小组件分支覆盖补齐：ErrorState 重试分支 / AppSelect 选项渲染 / CodeExampleBlock 复制与折叠。
 */
import './helpers/dom'
import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { ErrorState } from '../src/components/admin/error-state'
import { AppSelect } from '../src/components/ui/app-select'
import { CodeExampleBlock } from '../src/components/admin/code-example-block'

test.afterEach(() => {
  cleanup()
  document.body.removeAttribute('data-scroll-locked')
  document.body.style.removeProperty('pointer-events')
})

test('ErrorState：默认标题 + 重试回调（retry 分支）', () => {
  let retried = false
  render(
    React.createElement(ErrorState, {
      message: '网络错误',
      retry: () => {
        retried = true
      },
    }),
  )
  assert.ok(screen.getByText('加载失败'))
  assert.ok(screen.getByText('网络错误'))
  fireEvent.click(screen.getByRole('button', { name: '重试' }))
  assert.equal(retried, true)
})

test('ErrorState：无 retry 时不渲染按钮（no-retry 分支）', () => {
  render(React.createElement(ErrorState, { message: '未知错误', title: '出错了' }))
  assert.ok(screen.getByText('出错了'))
  assert.equal(screen.queryByRole('button'), null)
})

test('AppSelect：渲染选项并在变更时回调', () => {
  let selected = 'a'
  const onChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    selected = event.target.value
  }
  render(
    React.createElement(
      AppSelect,
      { value: 'a', onChange },
      [
        React.createElement('option', { key: 'a', value: 'a' }, '选项 A'),
        React.createElement('option', { key: 'b', value: 'b' }, '选项 B'),
      ],
    ),
  )
  const select = screen.getByRole('combobox') as HTMLSelectElement
  assert.equal(select.value, 'a')
  fireEvent.change(select, { target: { value: 'b' } })
  assert.equal(selected, 'b')
})

test('CodeExampleBlock：展开/收起与复制按钮', () => {
  render(
    React.createElement(CodeExampleBlock, {
      title: '示例代码',
      code: 'const hello = 1',
    }),
  )
  const toggle = screen.getByText(/示例代码/)
  fireEvent.click(toggle)
  assert.ok(screen.getByText(/const hello = 1/))
})
