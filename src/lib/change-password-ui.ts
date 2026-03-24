export type ChangePasswordInput = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

type ChangePasswordTone = 'neutral' | 'success' | 'warning' | 'danger'

type ChangePasswordSummaryCard = {
  label: string
  value: string
  description: string
  tone: ChangePasswordTone
}

type ChangePasswordChecklistItem = {
  key: 'length' | 'difference' | 'match'
  label: string
  description: string
  satisfied: boolean
}

function resolvePasswordStrength(newPassword: string): {
  label: string
  tone: ChangePasswordTone
  description: string
} {
  if (!newPassword) {
    return {
      label: '待设置',
      tone: 'neutral',
      description: '请输入新密码后开始评估强度',
    }
  }

  if (newPassword.length < 6) {
    return {
      label: '过短',
      tone: 'danger',
      description: '至少需要 6 位字符才满足基础要求',
    }
  }

  const hasLetter = /[a-zA-Z]/.test(newPassword)
  const hasNumber = /\d/.test(newPassword)
  const hasSymbol = /[^a-zA-Z0-9]/.test(newPassword)
  const hasRecommendedComplexity = hasLetter && hasNumber && hasSymbol && newPassword.length >= 10

  if (hasRecommendedComplexity) {
    return {
      label: '推荐',
      tone: 'success',
      description: '长度与复杂度较为均衡，适合管理员后台使用',
    }
  }

  return {
    label: '基础',
    tone: 'warning',
    description: '已满足最低要求，建议补充数字或符号增强安全性',
  }
}

function resolveConfirmStatus(newPassword: string, confirmPassword: string) {
  if (!newPassword || !confirmPassword) {
    return {
      label: '待确认',
      tone: 'neutral' as const,
      description: '再次输入新密码以完成二次确认',
    }
  }

  if (newPassword === confirmPassword) {
    return {
      label: '已匹配',
      tone: 'success' as const,
      description: '新密码与确认密码保持一致',
    }
  }

  return {
    label: '不一致',
    tone: 'danger' as const,
    description: '请检查确认密码是否与新密码完全一致',
  }
}

export function buildChangePasswordPageModel(input: ChangePasswordInput) {
  const completedFields = [
    input.currentPassword,
    input.newPassword,
    input.confirmPassword,
  ].filter(Boolean).length
  const passwordStrength = resolvePasswordStrength(input.newPassword)
  const confirmStatus = resolveConfirmStatus(input.newPassword, input.confirmPassword)

  const checklist: ChangePasswordChecklistItem[] = [
    {
      key: 'length',
      label: '至少 6 位',
      description: '满足接口要求的最低长度限制',
      satisfied: input.newPassword.length >= 6,
    },
    {
      key: 'difference',
      label: '不同于当前密码',
      description: '避免继续复用旧密码',
      satisfied:
        Boolean(input.currentPassword) &&
        Boolean(input.newPassword) &&
        input.currentPassword !== input.newPassword,
    },
    {
      key: 'match',
      label: '确认密码一致',
      description: '二次输入与新密码保持一致',
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
      label: '已填写',
      value: `${completedFields}/3`,
      description: '当前密码、新密码与确认密码的完成度',
      tone: completionTone,
    },
    {
      label: '新密码强度',
      value: passwordStrength.label,
      description: passwordStrength.description,
      tone: passwordStrength.tone,
    },
    {
      label: '确认状态',
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
