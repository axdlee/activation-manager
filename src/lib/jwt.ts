import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import { type AdminJwtPayload } from './admin-auth-shared'
import { getConfigWithDefault } from './config-service'

async function getSecret() {
  const jwtSecret = await getConfigWithDefault('jwtSecret')
  return new TextEncoder().encode(String(jwtSecret))
}

export async function signToken(payload: AdminJwtPayload) {
  const secret = await getSecret()
  const expiresIn = await getConfigWithDefault('jwtExpiresIn')
  
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret)
}

export async function verifyToken(token: string): Promise<AdminJwtPayload | null> {
  const secret = await getSecret()

  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as JWTPayload as AdminJwtPayload
  } catch (error) {
    return null
  }
}
