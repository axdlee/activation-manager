import { type NextRequest } from 'next/server'
import { handleVerifyLicenseRequest } from '@/lib/license-route-handlers'

export async function POST(request: NextRequest) {
  return handleVerifyLicenseRequest(request)
}
