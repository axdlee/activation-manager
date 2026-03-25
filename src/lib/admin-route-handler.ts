import { NextResponse, type NextRequest } from 'next/server'

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
  errorMessage?: string
  errorStatus?: number
  exposeErrorMessage?: boolean
  resolveErrorResponse?: (error: unknown) => AdminRouteErrorResponse | null | undefined
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
    errorMessage = '服务器内部错误',
    exposeErrorMessage = false,
    resolveErrorResponse,
  } = options

  return async function protectedAdminRouteHandler(request: TRequest, ...args: TArgs) {
    try {
      const authResult = await verifyAuth(request)
      if (!authResult.success) {
        return createAuthResponse(authResult)
      }

      return await handler(request, authResult, ...args)
    } catch (error) {
      const resolvedErrorResponse = resolveErrorResponse?.(error)
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
        exposeErrorMessage && error instanceof Error ? error.message : errorMessage

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
