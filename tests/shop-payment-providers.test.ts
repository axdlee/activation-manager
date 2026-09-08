import assert from 'node:assert/strict'
import test from 'node:test'

import {
  manualPaymentProvider,
  webhookPaymentProvider,
  handleWebhookCallback,
} from '../src/lib/shop-payment-providers'

const webhookSecretConfig = { secret: 's3cret' }

test('webhookPaymentProvider.createPayment 生成含金额与订单号的支付说明', async () => {
  const result = await webhookPaymentProvider.createPayment(
    {
      orderNo: 'SO-PAY-001',
      amountInCents: 1990,
      productName: '月卡',
      contactEmail: 'a@b.com',
    },
    {},
  )

  assert.equal(result.requirePaymentNote, true)
  assert.match(result.payParams.note ?? '', /19\.90/)
  assert.match(result.payParams.note ?? '', /SO-PAY-001/)
})

test('webhookPaymentProvider.verifyCallback 解析合法回调体', async () => {
  const context = await webhookPaymentProvider.verifyCallback(
    JSON.stringify({ orderNo: 'SO-001', paid: true, transactionId: 'TX-1' }),
    webhookSecretConfig,
  )

  assert.ok(context)
  assert.equal(context.orderNo, 'SO-001')
  assert.equal(context.paid, true)
  assert.equal(context.transactionId, 'TX-1')
  assert.equal(context.rawBody, JSON.stringify({ orderNo: 'SO-001', paid: true, transactionId: 'TX-1' }))
})

test('webhookPaymentProvider.verifyCallback 缺 orderNo 返回 null；paid 缺省视为成功', async () => {
  assert.equal(await webhookPaymentProvider.verifyCallback(JSON.stringify({ paid: true }), {}), null)

  const context = await webhookPaymentProvider.verifyCallback(
    JSON.stringify({ orderNo: 'SO-002' }),
    {},
  )
  assert.ok(context)
  assert.equal(context.paid, true)
})

test('webhookPaymentProvider.verifyCallback 非法 JSON 返回 null', async () => {
  assert.equal(await webhookPaymentProvider.verifyCallback('not-json{', {}), null)
})

test('webhookPaymentProvider.queryPayment 默认返回未支付（由回调驱动）', async () => {
  const result = await webhookPaymentProvider.queryPayment('SO-001', {})
  assert.deepEqual(result, { paid: false })
})

test('handleWebhookCallback 校验失败返回失败结果', async () => {
  const result = await handleWebhookCallback(webhookPaymentProvider, 'broken{', {})
  assert.deepEqual(result, { success: false, message: '回调校验失败' })
})

test('handleWebhookCallback 校验成功透传支付状态与交易号', async () => {
  const result = await handleWebhookCallback(
    webhookPaymentProvider,
    JSON.stringify({ orderNo: 'SO-003', paid: true, transactionId: 'TX-9' }),
    {},
  )
  assert.deepEqual(result, { success: true, paid: true, transactionId: 'TX-9' })
})

test('manualPaymentProvider.createPayment 提供收款说明且需要备注', async () => {
  const result = await manualPaymentProvider.createPayment(
    {
      orderNo: 'SO-M-001',
      amountInCents: 500,
      productName: '次卡',
    },
    { account: 'test@pay.com', instructions: '备注订单号' },
  )

  assert.equal(result.requirePaymentNote, true)
  assert.equal(result.payParams.account, 'test@pay.com')
  assert.equal(result.payParams.instructions, '备注订单号')

  // 未配置 instructions 时回退到默认收款说明（含金额与订单号）
  const fallback = await manualPaymentProvider.createPayment(
    { orderNo: 'SO-M-002', amountInCents: 500, productName: '次卡' },
    {},
  )
  assert.match(fallback.payParams.instructions ?? '', /5\.00/)
  assert.match(fallback.payParams.instructions ?? '', /SO-M-002/)
})

test('manualPaymentProvider.verifyCallback 无回调语义返回 null', async () => {
  assert.equal(await manualPaymentProvider.verifyCallback('any', {}), null)
})
