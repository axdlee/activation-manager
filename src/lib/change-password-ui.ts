export type PasswordUiTranslate = (key: string, fallback?: string) => string

export type ChangePasswordInput = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export type ChangePasswordTone = 'neutral' | 'success' | 'warning' | 'danger'

export type ChangePasswordSummaryCard = {
  label: string
  value: string
  description: string
  tone: ChangePasswordTone
}

export type ChangePasswordChecklistItem = {
  key: 'length' | 'difference' | 'match'
  label: string
  description: string
  satisfied: boolean
}

function resolvePasswordStrength(newPassword: string, t?: PasswordUiTranslate) {
  if (!newPassword) {
    return {
      label: t?.('pwdui.strength.pending.label') ?? '待设置',
      tone: 'neutral' as const,
      description: t?.('pwdui.strength.pending.desc') ?? '请输入新密码后开始评估强度',
    }
  }

  if (newPassword.length < 6) {
    return {
      label: t?.('pwdui.strength.tooShort.label') ?? '过短',
      tone: 'danger' as const,
      description: t?.('pwdui.strength.tooShort.desc') ?? '至少需要 6 位字符才满足基础要求',
    }
  }

  const hasLetter = /[a-zA-Z]/.test(newPassword)
  const hasNumber = /\d/.test(newPassword)
  const hasSymbol = /[^a-zA-Z0-9]/.test(newPassword)
  const hasRecommendedComplexity = hasLetter && hasNumber && hasSymbol && newPassword.length >= 10

  if (hasRecommendedComplexity) {
    return {
      label: t?.('pwdui.strength.recommended.label') ?? '推荐',
      tone: 'success' as const,
      description:
        t?.('pwdui.strength.recommended.desc') ?? '长度与复杂度较为均衡，适合管理员后台使用',
    }
  }

  return {
    label: t?.('pwdui.strength.basic.label') ?? '基础',
    tone: 'warning' as const,
    description:
      t?.('pwdui.strength.basic.desc') ?? '已满足最低要求，建议补充数字或符号增强安全性',
  }
}

function resolveConfirmStatus(
  newPassword: string,
  confirmPassword: string,
  t?: PasswordUiTranslate,
) {
  if (!newPassword || !confirmPassword) {
    return {
      label: t?.('pwdui.confirm.pending.label') ?? '待确认',
      tone: 'neutral' as const,
      description: t?.('pwdui.confirm.pending.desc') ?? '再次输入新密码以完成二次确认',
    }
  }

  if (newPassword === confirmPassword) {
    return {
      label: t?.('pwdui.confirm.matched.label') ?? '已匹配',
      tone: 'success' as const,
      description: t?.('pwdui.confirm.matched.desc') ?? '新密码与确认密码保持一致',
    }
  }

  return {
    label: t?.('pwdui.confirm.mismatch.label') ?? '不一致',
    tone: 'danger' as const,
    description: t?.('pwdui.confirm.mismatch.desc') ?? '请检查确认密码是否与新密码完全一致',
  }
}

export type ChangePasswordPageModel = {
  summaryCards: ChangePasswordSummaryCard[]
  checklist: ChangePasswordChecklistItem[]
}

export function buildChangePasswordPageModel(
  input: ChangePasswordInput,
  t?: PasswordUiTranslate,
): ChangePasswordPageModel {
  const completedFields = [
    input.currentPassword,
    input.newPassword,
    input.confirmPassword,
  ].filter(Boolean).length
  const passwordStrength = resolvePasswordStrength(input.newPassword, t)
  const confirmStatus = resolveConfirmStatus(input.newPassword, input.confirmPassword, t)

  const checklist: ChangePasswordChecklistItem[] = [
    {
      key: 'length',
      label: t?.('pwdui.checklist.length.label') ?? '至少 6 位',
      description: t?.('pwdui.checklist.length.desc') ?? '满足接口要求的最低长度限制',
      satisfied: input.newPassword.length >= 6,
    },
    {
      key: 'difference',
      label: t?.('pwdui.checklist.difference.label') ?? '不同于当前密码',
      description: t?.('pwdui.checklist.difference.desc') ?? '避免继续复用旧密码',
      satisfied:
        Boolean(input.currentPassword) &&
        Boolean(input.newPassword) &&
        input.currentPassword !== input.newPassword,
    },
    {
      key: 'match',
      label: t?.('pwdui.checklist.match.label') ?? '确认密码一致',
      description: t?.('pwdui.checklist.match.desc') ?? '二次输入与新密码保持一致',
      satisfied:
        Boolean(input.newPassword) &&
        Boolean(input.confirmPassword) &&
        input.newPassword === input.confirmPassword,
    },
  ]

  const completionTone: ChangePasswordTone =
    completedFields === 0 ? 'neutral' : completedFields === 3 ? 'success' : 'warning'

  const summaryCards: ChangePasswordSummaryCard[] = [
    {
      label: t?.('pwdui.summary.filled.label') ?? '已填写',
      value: `${completedFields}/3`,
      description: t?.('pwdui.summary.filled.desc') ?? '当前密码、新密码与确认密码的完成度',
      tone: completionTone,
    },
    {
      label: t?.('pwdui.summary.strength.label') ?? '新密码强度',
      value: passwordStrength.label,
      description: passwordStrength.description,
      tone: passwordStrength.tone,
    },
    {
      label: t?.('pwdui.summary.confirm.label') ?? '确认状态',
      value: confirmStatus.label,
      description: confirmStatus.description,
      tone: confirmStatus.tone,
    },
  ]

  return {
    summaryCards,
    checklist,
  }
}
