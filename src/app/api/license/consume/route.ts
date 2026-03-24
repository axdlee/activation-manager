import { NextRequest } from 'next/server'

import { handleConsumeLicenseRequest } from '@/lib/license-route-handlers'

export async function POST(request: NextRequest) {
  return handleConsumeLicenseRequest(request)
}
