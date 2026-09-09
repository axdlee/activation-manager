export const PROJECT_KEY_MIN_LENGTH = 2
export const PROJECT_KEY_MAX_LENGTH = 50
export const PROJECT_KEY_ALLOWED_PATTERN = /^[a-z0-9-]+$/
export const PROJECT_KEY_RULE_HINT =
  '仅支持 2-50 位小写字母、数字和短横线，且不能以短横线开头或结尾，也不能包含连续短横线。'
export const PROJECT_KEY_RULE_HINT_KEY = 'projectKey.ruleHint'

/** 可选的翻译函数：传入时优先使用词典 key，未传时回退中文文案 */
export type ProjectKeyTranslate = (key: string, fallback?: string) => string

export function normalizeProjectKeyInput(projectKey?: string | null) {
  return typeof projectKey === 'string' ? projectKey.trim() : ''
}

export function getProjectKeyValidationError(
  projectKey?: string | null,
  t?: ProjectKeyTranslate,
) {
  const normalizedProjectKey = normalizeProjectKeyInput(projectKey)

  if (!normalizedProjectKey) {
    return t?.('projectKey.required') ?? '项目标识不能为空'
  }

  if (
    normalizedProjectKey.length < PROJECT_KEY_MIN_LENGTH ||
    normalizedProjectKey.length > PROJECT_KEY_MAX_LENGTH
  ) {
    return (
      t?.('projectKey.lengthRange', `项目标识长度必须在 ${PROJECT_KEY_MIN_LENGTH}-${PROJECT_KEY_MAX_LENGTH} 个字符之间`) ??
      `项目标识长度必须在 ${PROJECT_KEY_MIN_LENGTH}-${PROJECT_KEY_MAX_LENGTH} 个字符之间`
    )
  }

  if (!PROJECT_KEY_ALLOWED_PATTERN.test(normalizedProjectKey)) {
    return t?.('projectKey.pattern') ?? '项目标识仅支持小写字母、数字和短横线'
  }

  if (normalizedProjectKey.startsWith('-') || normalizedProjectKey.endsWith('-')) {
    return t?.('projectKey.noEdgeDash') ?? '项目标识不能以短横线开头或结尾'
  }

  if (normalizedProjectKey.includes('--')) {
    return t?.('projectKey.noDoubleDash') ?? '项目标识不能包含连续短横线'
  }

  return null
}

export function normalizeProjectKeyForCreate(projectKey?: string | null) {
  const normalizedProjectKey = normalizeProjectKeyInput(projectKey)
  const validationError = getProjectKeyValidationError(normalizedProjectKey)

  if (validationError) {
    throw new Error(validationError)
  }

  return normalizedProjectKey
}
