// CSV 值转义与公式注入防护
// 用户可控的字符串值以 = + - @ 开头时，Excel / Google Sheets 可能将其解释为公式。
// 防御方式：在值前加前置制表符 \t，破坏公式格式但保留显示值。
// 纯数字（如统计差值）不作为公式注入来源，不做前缀处理。

const CSV_FORMULA_CHARS = /^[=+\-@]/

export function sanitizeCsvValue(value: string | number) {
  // 只有字符串类型的用户输入才需要公式注入防御；数字列原样输出
  if (typeof value === 'number') {
    return String(value)
  }

  const escapedValue = CSV_FORMULA_CHARS.test(value) ? `\t${value}` : value

  if (/[",\n]/.test(escapedValue)) {
    return `"${escapedValue.replace(/"/g, '""')}"`
  }

  return escapedValue
}

export function createCsvRow(values: Array<string | number>) {
  return values.map(sanitizeCsvValue).join(',')
}