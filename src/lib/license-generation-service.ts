import crypto from 'crypto'

import {
  normalizeNullableBooleanOverride,
  normalizeNullableCooldownMinutesOverride,
  normalizeNullableMaxCountOverride,
} from './license-rebind-policy'
import { resolveProject, type DbClient } from './license-project-service'
import { isPrismaUniqueConstraintError } from './prisma-error-utils'
import { type LicenseModeValue } from './license-status'

export type GenerateActivationCodesInput = {
  projectKey?: string
  amount: number
  licenseMode: LicenseModeValue
  validDays?: number | null
  totalCount?: number | null
  cardType?: string | null
  allowAutoRebind?: boolean | null
  autoRebindCooldownMinutes?: number | null
  autoRebindMaxCount?: number | null
}

const GENERATE_CODES_BATCH_RETRY_LIMIT = 5

function generateActivationCode() {
  return crypto.randomBytes(8).toString('hex').toUpperCase()
}

function generateUniqueActivationCodeBatch(amount: number) {
  const codes = new Set<string>()

  while (codes.size < amount) {
    codes.add(generateActivationCode())
  }

  return Array.from(codes)
}

function sortActivationCodesByGeneratedOrder<
  TCode extends {
    code: string
  },
>(
  codes: TCode[],
  orderedCodes: string[],
) {
  const codeMap = new Map(codes.map((code) => [code.code, code]))

  return orderedCodes.map((code) => {
    const matchedCode = codeMap.get(code)

    if (!matchedCode) {
      throw new Error(`批量生成结果缺少激活码: ${code}`)
    }

    return matchedCode
  })
}

export async function generateActivationCodes(client: DbClient, input: GenerateActivationCodesInput) {
  const project = await resolveProject(client, input.projectKey)
  const amount = Number(input.amount)
  const licenseMode = input.licenseMode
  const validDays = input.validDays ?? null
  const totalCount = input.totalCount ?? null
  const allowAutoRebind = normalizeNullableBooleanOverride(input.allowAutoRebind)
  const autoRebindCooldownMinutes = normalizeNullableCooldownMinutesOverride(
    input.autoRebindCooldownMinutes,
  )
  const autoRebindMaxCount = normalizeNullableMaxCountOverride(input.autoRebindMaxCount)

  if (!amount || amount < 1 || amount > 100) {
    throw new Error('生成数量必须在1-100之间')
  }

  if (licenseMode === 'TIME') {
    if (validDays !== null && validDays <= 0) {
      throw new Error('时间型激活码的有效天数必须大于0')
    }
  } else if (licenseMode === 'COUNT') {
    if (!totalCount || totalCount <= 0) {
      throw new Error('次数型激活码的总次数必须大于0')
    }
  } else {
    throw new Error('不支持的授权类型')
  }

  for (let attempt = 0; attempt < GENERATE_CODES_BATCH_RETRY_LIMIT; attempt += 1) {
    const orderedCodes = generateUniqueActivationCodeBatch(amount)

    try {
      const createdCodes = await client.activationCode.createManyAndReturn({
        data: orderedCodes.map((code) => ({
          code,
          projectId: project.id,
          licenseMode,
          validDays: licenseMode === 'TIME' ? validDays : null,
          cardType:
            input.cardType || (licenseMode === 'COUNT' && totalCount ? `${totalCount}次卡` : null),
          totalCount: licenseMode === 'COUNT' ? totalCount : null,
          remainingCount: licenseMode === 'COUNT' ? totalCount : null,
          expiresAt: null,
          allowAutoRebind,
          autoRebindCooldownMinutes,
          autoRebindMaxCount,
        })),
        include: {
          project: {
            select: {
              id: true,
              name: true,
              projectKey: true,
            },
          },
        },
      })

      return sortActivationCodesByGeneratedOrder(createdCodes, orderedCodes)
    } catch (error) {
      if (isPrismaUniqueConstraintError(error, 'code')) {
        continue
      }

      throw error
    }
  }

  throw new Error('生成激活码失败，请重试')
}
