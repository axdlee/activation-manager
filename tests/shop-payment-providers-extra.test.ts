import assert from 'node:assert/strict'
import test from 'node:test'

import {
  yipayPaymentProvider,
  wechatPayProvider,
  alipayProvider,
} from '../src/lib/shop-payment-providers-extra'

const testOrder = {
  orderNo: 'SO-TEST-YIPAY-001',
  amountInCents: 1990,
  productName: '月卡测试',
}

test('易支付 createPayment 生成含签名的支付 URL', async () => {
  const payment = await yipayPaymentProvider.createPayment(testOrder, {
    gateway: 'https://pay.yipay.com',
    pid: '1001',
    key: 'test-key',
    notifyUrl: 'https://example.com/api/shop/payment/yipay',
  })

  assert.ok(payment.payParams.payUrl)
  assert.ok(payment.payParams.payUrl.includes('pid=1001'))
  assert.ok(payment.payParams.payUrl.includes('out_trade_no=SO-TEST-YIPAY-001'))
  assert.ok(payment.payParams.payUrl.includes('sign='))
  assert.equal(payment.payParams.amount, '19.90')
})

test('易支付 createPayment 配置不完整时返回错误信息', async () => {
  const payment = await yipayPaymentProvider.createPayment(testOrder, {
    gateway: '',
    pid: '',
    key: '',
  })

  assert.ok(payment.payParams.error)
})

test('易支付 verifyCallback 合法签名返回支付上下文', async () => {
  const key = 'test-key'
  const params: Record<string, string> = {
    out_trade_no: 'SO-TEST-YIPAY-001',
    trade_no: 'YIPAY20260001',
    trade_status: 'TRADE_SUCCESS',
    name: '月卡测试',
    money: '19.90',
  }

  // 计算签名
  const sorted = Object.keys(params)
    .sort()
    .filter((k) => params[k] !== '')
    .map((k) => `${k}=${params[k]}`)
    .join('&')
  const { createHash } = await import('node:crypto')
  params.sign = createHash('md5').update(sorted + key).digest('hex')

  const context = await yipayPaymentProvider.verifyCallback(JSON.stringify(params), {
    key,
  })

  assert.ok(context)
  assert.equal(context?.orderNo, 'SO-TEST-YIPAY-001')
  assert.equal(context?.paid, true)
  assert.equal(context?.transactionId, 'YIPAY20260001')
})

test('易支付 verifyCallback 非法签名返回 null', async () => {
  const params = {
    out_trade_no: 'SO-TEST-YIPAY-001',
    trade_no: 'YIPAY20260001',
    trade_status: 'TRADE_SUCCESS',
    sign: 'invalid-signature',
  }

  const context = await yipayPaymentProvider.verifyCallback(JSON.stringify(params), {
    key: 'test-key',
  })

  assert.equal(context, null)
})

test('微信支付 verifyCallback 解析成功回调', async () => {
  const body = JSON.stringify({
    event_type: 'TRANSACTION.SUCCESS',
    resource: {
      ciphertext: JSON.stringify({
        out_trade_no: 'SO-WECHAT-001',
        transaction_id: 'WX20260001',
        trade_state: 'SUCCESS',
      }),
    },
  })

  const context = await wechatPayProvider.verifyCallback(body, {})
  assert.ok(context)
  assert.equal(context?.orderNo, 'SO-WECHAT-001')
  assert.equal(context?.paid, true)
  assert.equal(context?.transactionId, 'WX20260001')
})

test('微信支付 verifyCallback 非成功事件返回 null', async () => {
  const body = JSON.stringify({
    event_type: 'TRANSACTION.FAILED',
  })

  const context = await wechatPayProvider.verifyCallback(body, {})
  assert.equal(context, null)
})

test('支付宝 verifyCallback 解析成功回调', async () => {
  const body = JSON.stringify({
    out_trade_no: 'SO-ALIPAY-001',
    trade_no: 'ALI20260001',
    trade_status: 'TRADE_SUCCESS',
    app_id: '2021001001',
  })

  const context = await alipayProvider.verifyCallback(body, {})
  assert.ok(context)
  assert.equal(context?.orderNo, 'SO-ALIPAY-001')
  assert.equal(context?.paid, true)
  assert.equal(context?.transactionId, 'ALI20260001')
})

test('支付宝 verifyCallback 缺少 app_id 返回 null', async () => {
  const body = JSON.stringify({
    out_trade_no: 'SO-ALIPAY-001',
    trade_status: 'TRADE_SUCCESS',
  })

  const context = await alipayProvider.verifyCallback(body, {})
  assert.equal(context, null)
})

test('易支付 verifyCallback 支持 form-urlencoded 格式回调', async () => {
  const key = 'test-key'
  const params: Record<string, string> = {
    out_trade_no: 'SO-FORM-001',
    trade_no: 'YIPAY-FORM-001',
    trade_status: '1',
    name: '月卡测试',
    money: '19.90',
  }

  const sorted = Object.keys(params)
    .sort()
    .filter((k) => params[k] !== '')
    .map((k) => `${k}=${params[k]}`)
    .join('&')
  const { createHash } = await import('node:crypto')
  params.sign = createHash('md5').update(sorted + key).digest('hex')

  const formBody = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')

  const context = await yipayPaymentProvider.verifyCallback(formBody, { key })
  assert.ok(context)
  assert.equal(context?.orderNo, 'SO-FORM-001')
  assert.equal(context?.paid, true)
  assert.equal(context?.transactionId, 'YIPAY-FORM-001')
})

test('微信支付 verifyCallback 支持 XML 格式回调', async () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xml>
  <return_code><![CDATA[SUCCESS]]></return_code>
  <result_code><![CDATA[SUCCESS]]></result_code>
  <out_trade_no><![CDATA[SO-WX-001]]></out_trade_no>
  <transaction_id><![CDATA[WX20260002]]></transaction_id>
  <total_fee>1</total_fee>
</xml>`

  const context = await wechatPayProvider.verifyCallback(xml, {})
  assert.ok(context)
  assert.equal(context?.orderNo, 'SO-WX-001')
  assert.equal(context?.paid, true)
  assert.equal(context?.transactionId, 'WX20260002')
})

test('微信支付 verifyCallback XML 格式失败时返回 null', async () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xml>
  <return_code><![CDATA[FAIL]]></return_code>
  <result_code><![CDATA[FAIL]]></result_code>
</xml>`

  const context = await wechatPayProvider.verifyCallback(xml, {})
  assert.equal(context, null)
})

test('支付宝 verifyCallback 支持 form-urlencoded 格式回调', async () => {
  const formBody = 'out_trade_no=SO-ALI-FORM-001&trade_no=ALI-FORM-001&trade_status=TRADE_SUCCESS&app_id=2021002002'

  const context = await alipayProvider.verifyCallback(formBody, {})
  assert.ok(context)
  assert.equal(context?.orderNo, 'SO-ALI-FORM-001')
  assert.equal(context?.paid, true)
  assert.equal(context?.transactionId, 'ALI-FORM-001')
})