export type AdminAuthMode = 'public' | 'protected'

export type AdminAuthFailureCode =
  | 'ip_not_allowed'
  | 'token_missing'
  | 'token_invalid'
  | 'config_missing'
  | 'auth_failed'

export type AdminAuthSuccessResult = {
  success: true
  payload?: any
}

export type AdminAuthFailureResult = {
  success: false
  code: AdminAuthFailureCode
  error: string
  status: 401 | 403 | 500
}

export type AdminAuthResult = AdminAuthSuccessResult | AdminAuthFailureResult
