import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createServerT,
  isSupportedLocale,
  localeFromAcceptLanguage,
  localeFromCookieHeader,
  resolveServerLocale,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
} from '../src/lib/i18n/server-i18n'
import serverMessagesZh from '../src/lib/i18n/server-messages-zh'
import serverMessagesEn from '../src/lib/i18n/server-messages-en'

const messages = { 'zh-CN': serverMessagesZh, 'en-US': serverMessagesEn }

function createRequest(headers: Record<string, string>) {
  return { headers: { get: (name: string) => headers[name.toLowerCase()] ?? null } }
}

test('localeFromAcceptLanguage 按质量值解析浏览器语言', () => {
  assert.equal(localeFromAcceptLanguage('en-US,en;q=0.9,zh-CN;q=0.8'), 'en-US')
  assert.equal(localeFromAcceptLanguage('zh-CN,zh;q=0.9,en;q=0.8'), 'zh-CN')
  assert.equal(localeFromAcceptLanguage('en'), 'en-US')
  assert.equal(localeFromAcceptLanguage('zh'), 'zh-CN')
  assert.equal(localeFromAcceptLanguage('fr-FR,fr;q=0.9'), null)
  assert.equal(localeFromAcceptLanguage(null), null)
  assert.equal(localeFromAcceptLanguage(''), null)
})

test('localeFromCookieHeader 只接受受支持的 locale', () => {
  assert.equal(localeFromCookieHeader(`${LOCALE_COOKIE}=en-US; other=1`), 'en-US')
  assert.equal(localeFromCookieHeader(`a=1; ${LOCALE_COOKIE}=zh-CN`), 'zh-CN')
  assert.equal(localeFromCookieHeader(`${LOCALE_COOKIE}=fr-FR`), null)
  assert.equal(localeFromCookieHeader(null), null)
})

test('resolveServerLocale 优先级：cookie > Accept-Language > 默认', () => {
  assert.equal(
    resolveServerLocale(createRequest({ cookie: `${LOCALE_COOKIE}=zh-CN`, 'accept-language': 'en-US' })),
    'zh-CN',
  )
  assert.equal(resolveServerLocale(createRequest({ 'accept-language': 'en-GB,en;q=0.9' })), 'en-US')
  assert.equal(resolveServerLocale(createRequest({})), DEFAULT_LOCALE)
  assert.equal(isSupportedLocale('zh-CN'), true)
  assert.equal(isSupportedLocale('fr'), false)
})

test('createServerT 支持参数插值与回退', () => {
  const tEn = createServerT('en-US', messages)
  const tZh = createServerT('zh-CN', messages)

  assert.equal(tEn('shop.productInsufficientStock', { stock: 3 }), 'Insufficient stock: only 3 left')
  assert.equal(tZh('shop.quantityInvalid'), '购买数量必须是 1 到 100 之间的整数')
  // 未知 key 回退为 key 本身
  assert.equal(tEn('unknown.key'), 'unknown.key')
  // zh 词典缺失时回退 en（此处 zh 全量，反向验证 en 缺失场景）
  const partial = { 'zh-CN': { 'x.y': '中文' }, 'en-US': {} }
  assert.equal(createServerT('en-US', partial)('x.y'), '中文')
})

test('两个语言目录 key 集合完全一致（防漏译）', () => {
  assert.deepEqual(Object.keys(serverMessagesZh).sort(), Object.keys(serverMessagesEn).sort())
})
