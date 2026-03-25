import { type AdminAuthMode, type AdminAuthResult } from './admin-auth-shared'

export type AdminPageGuardAction =
  | {
      type: 'next'
    }
  | {
      type: 'redirect'
      location: string
    }
  | {
      type: 'response'
      status: number
      message: string
    }

export function resolveAdminPageAuthMode(pathname: string): AdminAuthMode | null {
  if (!pathname.startsWith('/admin')) {
    return null
  }

  return pathname === '/admin/login' ? 'public' : 'protected'
}

export function buildAdminAuthValidationUrl(requestUrl: string, mode: AdminAuthMode) {
  const url = new URL('/api/admin/auth/validate', requestUrl)
  url.searchParams.set('mode', mode)
  return url
}

export function resolveAdminPageGuardAction(
  mode: AdminAuthMode,
  result: AdminAuthResult,
  requestUrl: string,
): AdminPageGuardAction {
  if (result.success) {
    return { type: 'next' }
  }

  if (mode === 'protected' && result.status === 401) {
    return {
      type: 'redirect',
      location: new URL('/admin/login', requestUrl).toString(),
    }
  }

  return {
    type: 'response',
    status: result.status,
    message: result.error,
  }
}
