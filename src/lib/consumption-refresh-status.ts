export type ConsumptionRefreshTranslate = (key: string, fallback?: string) => string

export type ConsumptionRefreshSource = 'initial' | 'manual' | 'auto' | 'quick'
export type ConsumptionRefreshTone = 'info' | 'success' | 'error' | 'idle'

type ConsumptionRefreshState = {
  isLoading: boolean
  refreshSource: ConsumptionRefreshSource
  lastRefreshedAt: string | null
  lastError?: string | null
}

export function getConsumptionRefreshStatus(
  state: ConsumptionRefreshState,
  formatDateTime: (value: string) => string = (value) => new Date(value).toLocaleString(),
  t?: ConsumptionRefreshTranslate,
) {
  if (state.isLoading) {
    if (state.refreshSource === 'auto') {
      return {
        tone: 'info' as const,
        text: t?.('consumption.status.autoLoading') ?? '正在自动刷新消费日志...',
      }
    }

    if (state.refreshSource === 'initial') {
      return {
        tone: 'info' as const,
        text: t?.('consumption.status.initialLoading') ?? '正在加载消费日志...',
      }
    }

    if (state.refreshSource === 'quick') {
      return {
        tone: 'info' as const,
        text: t?.('consumption.status.quickLoading') ?? '正在应用时间范围并刷新消费日志...',
      }
    }

    return {
      tone: 'info' as const,
      text: t?.('consumption.status.loading') ?? '正在刷新消费日志...',
    }
  }

  if (state.lastError) {
    if (state.refreshSource === 'auto') {
      return {
        tone: 'error' as const,
        text:
          t?.('consumption.status.autoError', '自动刷新失败：{error}')?.replace(
            '{error}',
            state.lastError,
          ) ?? `自动刷新失败：${state.lastError}`,
      }
    }

    if (state.refreshSource === 'initial') {
      return {
        tone: 'error' as const,
        text:
          t?.('consumption.status.initialError', '加载消费日志失败：{error}')?.replace(
            '{error}',
            state.lastError,
          ) ?? `加载消费日志失败：${state.lastError}`,
      }
    }

    if (state.refreshSource === 'quick') {
      return {
        tone: 'error' as const,
        text:
          t?.('consumption.status.quickError', '时间范围刷新失败：{error}')?.replace(
            '{error}',
            state.lastError,
          ) ?? `时间范围刷新失败：${state.lastError}`,
      }
    }

    return {
      tone: 'error' as const,
      text:
        t?.('consumption.status.manualError', '刷新消费日志失败：{error}')?.replace(
          '{error}',
          state.lastError,
        ) ?? `刷新消费日志失败：${state.lastError}`,
    }
  }

  if (state.lastRefreshedAt) {
    if (state.refreshSource === 'auto') {
      return {
        tone: 'success' as const,
        text:
          t?.('consumption.status.autoSuccess', '自动刷新成功：{time}')?.replace(
            '{time}',
            formatDateTime(state.lastRefreshedAt),
          ) ?? `自动刷新成功：${formatDateTime(state.lastRefreshedAt)}`,
      }
    }

    if (state.refreshSource === 'initial') {
      return {
        tone: 'success' as const,
        text:
          t?.('consumption.status.initialSuccess', '消费日志已加载：{time}')?.replace(
            '{time}',
            formatDateTime(state.lastRefreshedAt),
          ) ?? `消费日志已加载：${formatDateTime(state.lastRefreshedAt)}`,
      }
    }

    if (state.refreshSource === 'quick') {
      return {
        tone: 'success' as const,
        text:
          t?.('consumption.status.quickSuccess', '时间范围已更新：{time}')?.replace(
            '{time}',
            formatDateTime(state.lastRefreshedAt),
          ) ?? `时间范围已更新：${formatDateTime(state.lastRefreshedAt)}`,
      }
    }

    return {
      tone: 'success' as const,
      text:
        t?.('consumption.status.manualSuccess', '最近刷新：{time}')?.replace(
          '{time}',
          formatDateTime(state.lastRefreshedAt),
        ) ?? `最近刷新：${formatDateTime(state.lastRefreshedAt)}`,
    }
  }

  return {
    tone: 'idle' as const,
    text: t?.('consumption.status.idle') ?? '尚未刷新消费日志',
  }
}

export function getConsumptionRefreshStatusText(
  state: ConsumptionRefreshState,
  formatDateTime?: (value: string) => string,
  t?: ConsumptionRefreshTranslate,
) {
  return getConsumptionRefreshStatus(state, formatDateTime, t).text
}
