import { SignJWT, jwtVerify } from 'jose'
import { getConfigWithDefault } from './config-service'

async function getSecret() {
  const jwtSecret = await getConfigWithDefault('jwtSecret')
  return new TextEncoder().encode(String(jwtSecret))
}

export async function signToken(payload: any) {
  const secret = await getSecret()
  const expiresIn = await getConfigWithDefault('jwtExpiresIn')
  
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret)
}

export async function verifyToken(token: string) {
  const secret = await getSecret()

  try {
    const { payload } = await jwtVerify(token, secret)
    return payload
  } catch (error) {
    return null
  }
}
