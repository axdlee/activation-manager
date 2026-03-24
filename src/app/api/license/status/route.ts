import { NextRequest } from 'next/server'

import { handleLicenseStatusRequest } from '@/lib/license-route-handlers'

export async function POST(request: NextRequest) {
  return handleLicenseStatusRequest(request)
}
