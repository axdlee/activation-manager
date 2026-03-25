import { NextRequest, NextResponse } from 'next/server'

import { authorizeAdminRequest } from '@/lib/admin-auth-service'
import { type AdminAuthMode } from '@/lib/admin-auth-shared'

function resolveAdminAuthMode(mode: string | null): AdminAuthMode {
  return mode === 'public' ? 'public' : 'protected'
}

export async function GET(request: NextRequest) {
  const mode = resolveAdminAuthMode(request.nextUrl.searchParams.get('mode'))
  const result = await authorizeAdminRequest(request, { mode })

  return NextResponse.json(result, {
    status: result.success ? 200 : result.status,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
