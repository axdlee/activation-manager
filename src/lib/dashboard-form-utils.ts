// dashboard 页面表单工具函数
// 从 page.tsx 抽取的纯函数，供发码表单、项目表单与单码治理复用。

import {
  AUTO_REBIND_COOLDOWN_MINUTES_MAX,
  AUTO_REBIND_COOLDOWN_MINUTES_MIN,
  AUTO_REBIND_MAX_COUNT_MAX,
  AUTO_REBIND_MAX_COUNT_MIN,
} from './license-rebind-policy-shared'

export function parseNullableCooldownMinutesInput(value: string) {
  const normalizedValue = value.trim()

  if (!normalizedValue) {
    return null
  }

  const parsedValue = Number.parseInt(normalizedValue, 10)

  if (
    Number.isNaN(parsedValue) ||
    parsedValue < AUTO_REBIND_COOLDOWN_MINUTES_MIN ||
    parsedValue > AUTO_REBIND_COOLDOWN_MINUTES_MAX
  ) {
    throw new Error(
      `换绑冷却时间必须在 ${AUTO_REBIND_COOLDOWN_MINUTES_MIN} 到 ${AUTO_REBIND_COOLDOWN_MINUTES_MAX} 分钟之间`,
    )
  }

  return parsedValue
}

export function parseNullableMaxCountInput(value: string) {
  const normalizedValue = value.trim()

  if (!normalizedValue) {
    return null
  }

  const parsedValue = Number.parseInt(normalizedValue, 10)

  if (
    Number.isNaN(parsedValue) ||
    parsedValue < AUTO_REBIND_MAX_COUNT_MIN ||
    parsedValue > AUTO_REBIND_MAX_COUNT_MAX
  ) {
    throw new Error(
      `自助换绑次数上限必须在 ${AUTO_REBIND_MAX_COUNT_MIN} 到 ${AUTO_REBIND_MAX_COUNT_MAX} 之间`,
    )
  }

  return parsedValue
}

export function normalizeOptionalAdminReason(value: string) {
  const normalizedValue = value.trim()
  return normalizedValue ? normalizedValue : undefined
}

export function handleCardTypeChange(
  cardType: string,
  setSelectedCardType: (value: string) => void,
  setExpiryDays: (days: number) => void,
  cardTypes: Array<{ name: string; days: number }>,
) {
  setSelectedCardType(cardType)
  const selectedCard = cardTypes.find((item) => item.name === cardType)
  if (selectedCard && selectedCard.days > 0) {
    setExpiryDays(selectedCard.days)
  }
}