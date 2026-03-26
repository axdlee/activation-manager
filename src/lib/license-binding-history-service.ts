import { Prisma, PrismaClient } from '@prisma/client'

export type BindingHistoryEventType =
  | 'INITIAL_BIND'
  | 'AUTO_REBIND'
  | 'FORCE_UNBIND'
  | 'FORCE_REBIND'
  | 'REUSABLE_BINDING_RELEASED'

export type BindingHistoryOperatorType = 'CLIENT' | 'ADMIN' | 'SYSTEM'

type BindingHistoryPersistenceClient = PrismaClient | Prisma.TransactionClient

type RecordActivationCodeBindingHistoryInput = {
  activationCodeId: number
  projectId: number
  eventType: BindingHistoryEventType
  operatorType: BindingHistoryOperatorType
  operatorUsername?: string | null
  fromMachineId?: string | null
  toMachineId?: string | null
  reason?: string | null
}

export async function recordActivationCodeBindingHistory(
  client: BindingHistoryPersistenceClient,
  input: RecordActivationCodeBindingHistoryInput,
) {
  if (!('activationCodeBindingHistory' in client)) {
    return null
  }

  return client.activationCodeBindingHistory.create({
    data: {
      activationCodeId: input.activationCodeId,
      projectId: input.projectId,
      eventType: input.eventType,
      operatorType: input.operatorType,
      operatorUsername: input.operatorUsername?.trim() || null,
      fromMachineId: input.fromMachineId?.trim() || null,
      toMachineId: input.toMachineId?.trim() || null,
      reason: input.reason?.trim() || null,
    },
  })
}
