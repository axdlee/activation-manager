/**
 * 行为测试共享环境：jsdom + React 18 act 环境 + fetch mock。
 * node:test 每个测试文件独立进程，污染不会外溢。
 */
import React from 'react'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
})

const globalAny = globalThis as Record<string, unknown>
for (const key of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLInputElement',
  'HTMLTextAreaElement',
  'HTMLSelectElement',
  'Element',
  'Node',
  'Event',
  'CustomEvent',
  'KeyboardEvent',
  'MouseEvent',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'getComputedStyle',
  'localStorage',
  'sessionStorage',
  'ClipboardEvent',
  'HTMLFormElement',
  'HTMLLabelElement',
  'HTMLButtonElement',
]) {
  const value = (dom.window as Record<string, unknown>)[key]
  if (value === undefined) continue
  const descriptor = Object.getOwnPropertyDescriptor(globalAny, key)
  if (descriptor && descriptor.get && !descriptor.set) {
    // Node 全局只读 getter（如 navigator）：改写其 get 指向 jsdom 实例
    Object.defineProperty(globalAny, key, {
      get: () => value,
      configurable: true,
    })
  } else {
    globalAny[key] = value
  }
}
globalAny.IS_REACT_ACT_ENVIRONMENT = true
globalAny.self = dom.window
// 代码库为 classic JSX 运行时（Next preserve），Node 下需要全局 React
globalAny.React = React

// Radix 组件在 jsdom 下需要的两个 API
if (!('MutationObserver' in globalAny)) {
  globalAny.MutationObserver = class {
    observe() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
}
if (!('ResizeObserver' in globalAny)) {
  globalAny.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
if (!dom.window.Element.prototype.scrollIntoView) {
  dom.window.Element.prototype.scrollIntoView = () => {}
}

// 危险操作确认（组件内 window.confirm）默认接受
dom.window.confirm = () => true
dom.window.prompt = () => null

// navigator.clipboard 常被组件调用
Object.defineProperty(globalAny.navigator, 'clipboard', {
  value: {
    writeText: async () => undefined,
    readText: async () => '',
  },
  configurable: true,
})

export type FetchRoute = {
  /** URL 前缀匹配 */
  match: string
  respond: (input: string, init?: RequestInit) => {
    status?: number
    body: unknown
  }
}

/** 安装可编程 fetch mock：按路由前缀响应，未命中回退 {success:true} */
export function installFetchMock(routes: FetchRoute[]) {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fetchMock = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    calls.push({ url, init })
    const route = routes.find((item) => url.includes(item.match))
    const result = route
      ? route.respond(url, init)
      : { status: 200, body: { success: true, message: 'ok' } }
    return {
      ok: (result.status ?? 200) < 400,
      status: result.status ?? 200,
      json: async () => result.body,
    }
  })
  globalAny.fetch = fetchMock
  return { fetchMock, calls }
}
