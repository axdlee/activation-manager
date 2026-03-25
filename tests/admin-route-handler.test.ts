import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest, NextResponse } from 'next/server'

import { createProtectedAdminRouteHandler } from '../src/lib/admin-route-handler'
import { type AdminAuthFailureResult } from '../src/lib/admin-auth-shared'

function createRequest() {
  return new NextRequest('http://127.0.0.1:3000/api/admin/example')
}

test('createProtectedAdminRouteHandler 在鉴权失败时直接返回鉴权响应', async () => {
  let handlerCalled = false
  const response = await createProtectedAdminRouteHandler(
    async () => {
      handlerCalled = true
      return NextResponse.json({ success: true })
    },
    {
      logLabel: '示例接口失败',
    },
    {
      verifyAuth: async () => ({
        success: false,
        code: 'token_missing',
        error: '未提供认证令牌',
        status: 401,
      }),
      createAuthResponse: (input) => NextResponse.json({ success: false, message: input.error }, { status: input.status }),
    },
  )(createRequest())

  assert.equal(handlerCalled, false)
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), {
    success: false,
    message: '未提供认证令牌',
  })
})

test('createProtectedAdminRouteHandler 在鉴权通过时委托业务 handler', async () => {
  const response = await createProtectedAdminRouteHandler(
    async () => NextResponse.json({ success: true, data: ['ok'] }),
    {
      logLabel: '示例接口失败',
    },
    {
      verifyAuth: async () => ({ success: true }),
      createAuthResponse: (input) => NextResponse.json({ success: false, message: input.error }, { status: input.status }),
    },
  )(createRequest())

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    success: true,
    data: ['ok'],
  })
})

test('createProtectedAdminRouteHandler 在 exposeErrorMessage=true 时返回业务错误原文与指定状态码', async (t) => {
  const originalConsoleError = console.error
  const errors: unknown[][] = []
  console.error = (...args: unknown[]) => {
    errors.push(args)
  }

  t.after(() => {
    console.error = originalConsoleError
  })

  const response = await createProtectedAdminRouteHandler(
    async () => {
      throw new Error('项目不存在')
    },
    {
      logLabel: '获取项目失败',
      errorStatus: 400,
      exposeErrorMessage: true,
      errorMessage: '获取项目失败',
    },
    {
      verifyAuth: async () => ({ success: true }),
      createAuthResponse: (input) => NextResponse.json({ success: false, message: input.error }, { status: input.status }),
    },
  )(createRequest())

  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), {
    success: false,
    message: '项目不存在',
  })
  assert.equal(errors.length, 1)
  assert.equal(errors[0]?.[0], '获取项目失败:')
})

test('createProtectedAdminRouteHandler 在 exposeErrorMessage=false 时返回通用错误信息', async () => {
  const authFailureResponse = {
    success: false,
    message: 'forbidden',
  }
  const response = await createProtectedAdminRouteHandler(
    async () => {
      throw 'boom'
    },
    {
      logLabel: '获取统计失败',
      errorStatus: 500,
      errorMessage: '服务器内部错误',
    },
    {
      verifyAuth: async () => ({ success: true }),
      createAuthResponse: (_input: AdminAuthFailureResult) => NextResponse.json(authFailureResponse, { status: 403 }),
    },
  )(createRequest())

  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), {
    success: false,
    message: '服务器内部错误',
  })
})

test('createProtectedAdminRouteHandler 透传鉴权结果与路由上下文参数', async () => {
  const response = await createProtectedAdminRouteHandler(
    async (_request, authResult, context: { params: { id: string } }) =>
      NextResponse.json({
        success: true,
        username: authResult.payload?.username,
        projectId: context.params.id,
      }),
    {
      logLabel: '获取项目失败',
    },
    {
      verifyAuth: async () => ({
        success: true,
        payload: {
          username: 'admin',
          isAdmin: true,
        },
      }),
      createAuthResponse: (input) => NextResponse.json({ success: false, message: input.error }, { status: input.status }),
    },
  )(createRequest(), { params: { id: '7' } })

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    success: true,
    username: 'admin',
    projectId: '7',
  })
})

test('createProtectedAdminRouteHandler 支持自定义错误映射且默认不打印错误日志', async (t) => {
  const originalConsoleError = console.error
  const errors: unknown[][] = []
  console.error = (...args: unknown[]) => {
    errors.push(args)
  }

  t.after(() => {
    console.error = originalConsoleError
  })

  const response = await createProtectedAdminRouteHandler(
    async () => {
      throw new Error('配置项非法')
    },
    {
      logLabel: '更新系统配置失败',
      resolveErrorResponse: (error) =>
        error instanceof Error
          ? {
              status: 400,
              message: error.message,
            }
          : null,
    },
    {
      verifyAuth: async () => ({ success: true }),
      createAuthResponse: (input) => NextResponse.json({ success: false, message: input.error }, { status: input.status }),
    },
  )(createRequest())

  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), {
    success: false,
    message: '配置项非法',
  })
  assert.equal(errors.length, 0)
})
