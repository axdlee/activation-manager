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
) {
  if (state.isLoading) {
    if (state.refreshSource === 'auto') {
      return {
        tone: 'info' as const,
        text: '正在自动刷新消费日志...',
      }
    }

    if (state.refreshSource === 'initial') {
      return {
        tone: 'info' as const,
        text: '正在加载消费日志...',
      }
    }

    if (state.refreshSource === 'quick') {
      return {
        tone: 'info' as const,
        text: '正在应用时间范围并刷新消费日志...',
      }
    }

    return {
      tone: 'info' as const,
      text: '正在刷新消费日志...',
    }
  }

  if (state.lastError) {
    if (state.refreshSource === 'auto') {
      return {
        tone: 'error' as const,
        text: `自动刷新失败：${state.lastError}`,
      }
    }

    if (state.refreshSource === 'initial') {
      return {
        tone: 'error' as const,
        text: `加载消费日志失败：${state.lastError}`,
      }
    }

    if (state.refreshSource === 'quick') {
      return {
        tone: 'error' as const,
        text: `时间范围刷新失败：${state.lastError}`,
      }
    }

    return {
      tone: 'error' as const,
      text: `刷新消费日志失败：${state.lastError}`,
    }
  }

  if (state.lastRefreshedAt) {
    if (state.refreshSource === 'auto') {
      return {
        tone: 'success' as const,
        text: `自动刷新成功：${formatDateTime(state.lastRefreshedAt)}`,
      }
    }

    if (state.refreshSource === 'initial') {
      return {
        tone: 'success' as const,
        text: `消费日志已加载：${formatDateTime(state.lastRefreshedAt)}`,
      }
    }

    if (state.refreshSource === 'quick') {
      return {
        tone: 'success' as const,
        text: `时间范围已更新：${formatDateTime(state.lastRefreshedAt)}`,
      }
    }

    return {
      tone: 'success' as const,
      text: `最近刷新：${formatDateTime(state.lastRefreshedAt)}`,
    }
  }

  return {
    tone: 'idle' as const,
    text: '尚未刷新消费日志',
  }
}

export function getConsumptionRefreshStatusText(
  state: ConsumptionRefreshState,
  formatDateTime?: (value: string) => string,
) {
  return getConsumptionRefreshStatus(state, formatDateTime).text
}
