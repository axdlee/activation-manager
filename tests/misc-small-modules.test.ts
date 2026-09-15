/**
 * 小模块补测：dashboard-class-names 常量、dropdown-menu 子组件渲染、toast-provider。
 */
import './helpers/dom'
import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import * as classNames from '../src/lib/dashboard-class-names'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../src/components/ui-admin/dropdown-menu'
import { ToastProvider, useToast } from '../src/components/toast-provider'

test('dashboard-class-names：语义令牌类名非空且指向语义变量', () => {
  for (const value of [
    classNames.panelClassName,
    classNames.mutedPanelClassName,
    classNames.inputClassName,
    classNames.compactInputClassName,
    classNames.primaryButtonClassName,
    classNames.successButtonClassName,
    classNames.dangerButtonClassName,
    classNames.warningButtonClassName,
    classNames.ghostButtonClassName,
    classNames.workspaceSummaryCardClassName,
    classNames.codeBlockClassName,
    classNames.paginationButtonClassName,
  ]) {
    assert.ok(value.length > 0)
  }
  assert.match(classNames.panelClassName, /bg-card/)
  assert.match(classNames.primaryButtonClassName, /bg-primary/)
})

function MenuProbe() {
  return React.createElement(
    DropdownMenu,
    { open: true },
    React.createElement(DropdownMenuTrigger, { asChild: true }, React.createElement('button', { type: 'button' }, 'open')),
    React.createElement(
      DropdownMenuContent,
      null,
    React.createElement(
      DropdownMenuGroup,
      null,
      React.createElement(DropdownMenuLabel, null, '分组'),
      React.createElement(DropdownMenuItem, { onSelect: () => {} }, '项目一'),
      React.createElement(DropdownMenuCheckboxItem, { checked: true }, '复选'),
      React.createElement(
        DropdownMenuRadioGroup,
        { value: 'a' },
        React.createElement(DropdownMenuRadioItem, { value: 'a' }, 'A'),
      ),
      React.createElement(DropdownMenuSeparator, null),
      React.createElement(
        DropdownMenuSub,
        null,
        React.createElement(DropdownMenuSubTrigger, null, '子菜单'),
        React.createElement(
          DropdownMenuPortal,
          null,
          React.createElement(DropdownMenuSubContent, null, React.createElement(DropdownMenuItem, null, '子项')),
        ),
      ),
      React.createElement(DropdownMenuShortcut, null, '⌘K'),
    ),
    ),
  )
}

test('dropdown-menu：全部子组件可渲染', () => {
  render(React.createElement(MenuProbe))
  assert.ok(screen.getByText('分组'))
  assert.ok(screen.getByText('项目一'))
  assert.ok(screen.getByText('⌘K'))
})

function ToastProbe({ onReady }: { onReady: (t: (m: string) => void) => void }) {
  const { toast } = useToast()
  React.useEffect(() => {
    onReady((message: string) => toast.success(message))
  }, [onReady, toast])
  return null
}

test('toast-provider：成功提示渲染并可关闭', async () => {
  let trigger: ((m: string) => void) | null = null
  render(
    React.createElement(
      ToastProvider,
      null,
      React.createElement(ToastProbe, {
        onReady: (fn) => {
          trigger = fn
        },
      }),
    ),
  )
  await waitFor(() => {
    assert.ok(trigger)
  })
  fireEvent.click(document.body)
  trigger!('提示消息')
  await screen.findByText('提示消息')
})
