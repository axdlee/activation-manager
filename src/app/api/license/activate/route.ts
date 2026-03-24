import { NextRequest } from 'next/server'

import { handleActivateLicenseRequest } from '@/lib/license-route-handlers'

export async function POST(request: NextRequest) {
  return handleActivateLicenseRequest(request)
}
