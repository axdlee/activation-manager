export type ConsumptionQuickRangeKey = 'today' | 'last7Days' | 'last30Days'

function padDatePart(value: number) {
  return String(value).padStart(2, '0')
}

function getLocalDayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
}

function getLocalDayEnd(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 0, 0)
}

export function formatDateTimeLocal(date: Date) {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join('-') + `T${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`
}

export function getConsumptionQuickRange(
  rangeKey: ConsumptionQuickRangeKey,
  now: Date = new Date(),
) {
  const endDate = getLocalDayEnd(now)

  if (rangeKey === 'today') {
    return {
      createdFrom: formatDateTimeLocal(getLocalDayStart(now)),
      createdTo: formatDateTimeLocal(endDate),
    }
  }

  const days = rangeKey === 'last7Days' ? 6 : 29
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, 0, 0, 0, 0)

  return {
    createdFrom: formatDateTimeLocal(startDate),
    createdTo: formatDateTimeLocal(endDate),
  }
}
