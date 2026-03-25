import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getProjectKeyValidationError,
  normalizeProjectKeyForCreate,
} from '../src/lib/project-key'

test('normalizeProjectKeyForCreate 会接受合法 projectKey 并自动去除首尾空白', () => {
  assert.equal(normalizeProjectKeyForCreate('  browser-plugin-01  '), 'browser-plugin-01')
})

test('getProjectKeyValidationError 会返回明确的 projectKey 校验错误', () => {
  assert.equal(getProjectKeyValidationError(''), '项目标识不能为空')
  assert.equal(getProjectKeyValidationError('a'), '项目标识长度必须在 2-50 个字符之间')
  assert.equal(
    getProjectKeyValidationError('A-plugin'),
    '项目标识仅支持小写字母、数字和短横线',
  )
  assert.equal(
    getProjectKeyValidationError('-browser-plugin'),
    '项目标识不能以短横线开头或结尾',
  )
  assert.equal(
    getProjectKeyValidationError('browser--plugin'),
    '项目标识不能包含连续短横线',
  )
  assert.equal(getProjectKeyValidationError('browser-plugin'), null)
})
