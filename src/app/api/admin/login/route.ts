import { type NextRequest } from 'next/server'
import { handleAdminLoginRequest } from '@/lib/admin-login-route-handler'

export async function POST(request: NextRequest) {
  return handleAdminLoginRequest(request)
}
