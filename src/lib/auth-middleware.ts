import { NextRequest, NextResponse } from 'next/server'
import { authorizeAdminRequest } from './admin-auth-service'
import { type AdminAuthFailureResult, type AdminAuthResult } from './admin-auth-shared'

export async function verifyAuth(request: NextRequest): Promise<AdminAuthResult> {
  return authorizeAdminRequest(request, { mode: 'protected' })
}

export function createAuthResponse(
  input: string | AdminAuthFailureResult,
  status: number = 401,
): NextResponse {
  const message = typeof input === 'string' ? input : input.error
  const responseStatus = typeof input === 'string' ? status : input.status

  return NextResponse.json(
    { success: false, message },
    { status: responseStatus }
  )
}
