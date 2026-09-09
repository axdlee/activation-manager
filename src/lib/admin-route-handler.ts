import { NextResponse, type NextRequest } from 'next/server'

import { resolveServerLocale, serverT } from './i18n/server'
import { guardAdminApiRateLimit } from './admin-api-rate-limit'
import {
  createAuthResponse as defaultCreateAuthResponse,
  verifyAuth as defaultVerifyAuth,
} from './auth-middleware'
import {
  type AdminAuthFailureResult,
  type AdminAuthResult,
  type AdminAuthSuccessResult,
} from './admin-auth-shared'

type AdminRouteHandlerRequest = Request | NextRequest

type ProtectedAdminRouteHandler<
  TRequest extends AdminRouteHandlerRequest,
  TArgs extends unknown[],
> = (
  request: TRequest,
  authResult: AdminAuthSuccessResult,
  ...args: TArgs
) => Promise<Response> | Response

type AdminRouteErrorResponse = {
  status: number
  message: string
}

type CreateProtectedAdminRouteHandlerOptions = {
  logLabel: string
  /**
   * 回退错误消息的词典 key（i18n）：catch 内按请求语言翻译后返回。
   * 未传时默认 'api.internalError'。
   */
  errorMessageKey?: string
  /**
   * @deprecated 直接传中文消息的旧用法，保持原样返回以便向后兼容。
   * 新代码请使用 errorMessageKey。
   */
  errorMessage?: string
  errorStatus?: number
  exposeErrorMessage?: boolean
  resolveErrorResponse?: (
    error: unknown,
    request: AdminRouteHandlerRequest,
  ) => AdminRouteErrorResponse | null | undefined
}

type ProtectedAdminRouteHandlerDependencies<TRequest extends AdminRouteHandlerRequest> = {
  verifyAuth?: (request: TRequest) => Promise<AdminAuthResult>
  createAuthResponse?: (result: AdminAuthFailureResult) => Response
}

export function createProtectedAdminRouteHandler<
  TRequest extends AdminRouteHandlerRequest,
  TArgs extends unknown[] = [],
>(
  handler: ProtectedAdminRouteHandler<TRequest, TArgs>,
  options: CreateProtectedAdminRouteHandlerOptions,
  dependencies: ProtectedAdminRouteHandlerDependencies<TRequest> = {},
) {
  const {
    verifyAuth = defaultVerifyAuth as (request: TRequest) => Promise<AdminAuthResult>,
    createAuthResponse = defaultCreateAuthResponse as (result: AdminAuthFailureResult) => Response,
  } = dependencies
  const {
    logLabel,
    errorStatus = 500,
    errorMessage,
    errorMessageKey,
    exposeErrorMessage = false,
    resolveErrorResponse,
  } = options

  return async function protectedAdminRouteHandler(request: TRequest, ...args: TArgs) {
    // 限流：IP + 路径维度，防暴力刷接口
    const rateLimit = guardAdminApiRateLimit(
      request as NextRequest,
      (request as NextRequest).nextUrl?.pathname ?? 'admin-api',
    )
    if (!rateLimit.allowed) {
      return rateLimit.response
    }

    try {
      const authResult = await verifyAuth(request)
      if (!authResult.success) {
        return createAuthResponse(authResult)
      }

      return await handler(request, authResult, ...args)
    } catch (error) {
      // i18n：按请求语言翻译回退错误消息
      const t = serverT(resolveServerLocale(request as NextRequest))
      const resolvedErrorResponse = resolveErrorResponse?.(error, request)
      if (resolvedErrorResponse) {
        return NextResponse.json(
          {
            success: false,
            message: resolvedErrorResponse.message,
          },
          {
            status: resolvedErrorResponse.status,
          },
        )
      }

      console.error(`${logLabel}:`, error)

      const message =
        exposeErrorMessage && error instanceof Error
          ? error.message
          : (errorMessage ?? t(errorMessageKey ?? 'api.internalError'))

      return NextResponse.json(
        {
          success: false,
          message,
        },
        {
          status: errorStatus,
        },
      )
    }
  }
}
