export function isPrismaUniqueConstraintError(error: unknown, fieldNames: string | readonly string[]) {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false
  }

  if (error.code !== 'P2002') {
    return false
  }

  if (!('meta' in error) || typeof error.meta !== 'object' || error.meta === null) {
    return false
  }

  const expectedFieldNames = Array.isArray(fieldNames) ? fieldNames : [fieldNames]
  const target = 'target' in error.meta ? error.meta.target : null

  if (Array.isArray(target)) {
    return expectedFieldNames.every((fieldName) => target.includes(fieldName))
  }

  return expectedFieldNames.length === 1 && target === expectedFieldNames[0]
}
