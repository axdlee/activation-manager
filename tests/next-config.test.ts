import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const configModulePath = require.resolve('../next.config.js')

function loadNextConfig() {
  delete require.cache[configModulePath]
  return require(configModulePath)
}

test('next.config.js 默认使用 .next 作为构建目录', () => {
  const originalDistDir = process.env.NEXT_DIST_DIR
  delete process.env.NEXT_DIST_DIR

  const config = loadNextConfig()

  if (originalDistDir === undefined) {
    delete process.env.NEXT_DIST_DIR
  } else {
    process.env.NEXT_DIST_DIR = originalDistDir
  }

  assert.equal(config.distDir, '.next')
})

test('next.config.js 支持通过 NEXT_DIST_DIR 隔离构建产物目录', () => {
  const originalDistDir = process.env.NEXT_DIST_DIR
  process.env.NEXT_DIST_DIR = '.next-quality'

  const config = loadNextConfig()

  if (originalDistDir === undefined) {
    delete process.env.NEXT_DIST_DIR
  } else {
    process.env.NEXT_DIST_DIR = originalDistDir
  }

  assert.equal(config.distDir, '.next-quality')
})
