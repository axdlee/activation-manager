'use client'

/**
 * 支付渠道任务页（渠道 Tab 版）：
 * - 顶部渠道 Tab（Webhook / 易支付 / 微信 / 支付宝），每个 Tab 带启用状态圆点
 * - 每个字段：可见名称 + 用途说明 + 带示例的输入框；敏感字段可显隐
 * - 保存/启用逻辑与旧版一致（saveShopPaymentConfig）
 */

import * as React from 'react'
import { RefreshCw } from 'lucide-react'

import { PageHeader } from '@/components/admin/page-header'
import { ShopSubnav } from '@/components/admin/shop-subnav'
import { Skeleton } from '@/components/ui-admin/skeleton'
import {
  fetchShopPaymentConfigs,
  parseProviderConfig,
  saveShopPaymentConfig,
  type ShopPaymentConfig,
} from '@/lib/shop-admin-data'
import { useI18n } from '@/lib/i18n/i18n-provider'

export type ShopPaymentPageProps = {
  initialConfigs?: ShopPaymentConfig[]
  onNotify?: (message: string, type?: 'success' | 'error') => void
}

type YipayForm = { gateway: string; pid: string; key: string }
type WechatForm = { appId: string; mchId: string; apiKey: string }
type AlipayForm = { appId: string; alipayPublicKey: string }

type ChannelKey = 'webhook' | 'yipay' | 'wechat' | 'alipay'

type ChannelField<F> = {
  key: keyof F & string
  label: string
  description: string
  placeholder?: string
  type?: 'text' | 'password'
}

const CHANNEL_FIELDS: Record<Exclude<ChannelKey, 'webhook'>, ChannelField<YipayForm & WechatForm & AlipayForm>[]> = {
  yipay: [
    {
      key: 'gateway',
      label: '网关地址（Gateway）',
      description: '易支付平台的下单 API 地址，支付时将跳转到该地址完成付款。',
      placeholder: 'https://pay.example.com/submit.php',
    },
    {
      key: 'pid',
      label: '商户 ID（PID）',
      description: '易支付商户后台分配给您的商户编号，通常为纯数字。',
      placeholder: '1001',
    },
    {
      key: 'key',
      label: '商户密钥（KEY）',
      description: '与商户 ID 配套的通信签名密钥，用于请求与回调的防伪校验，请妥善保管。',
      placeholder: '易支付商户密钥',
      type: 'password',
    },
  ],
  wechat: [
    {
      key: 'appId',
      label: '应用 AppID',
      description: '微信支付绑定的公众号 / 小程序应用 ID，以 wx 开头。',
      placeholder: 'wx1234567890abcdef',
    },
    {
      key: 'mchId',
      label: '商户号（MchID）',
      description: '微信支付商户平台的商户号，为纯数字。',
      placeholder: '1900000000',
    },
    {
      key: 'apiKey',
      label: 'API 密钥（ApiKey）',
      description: '微信支付商户平台设置的 API 密钥（32 位），用于回调与下单签名。',
      placeholder: '32 位 API 密钥',
      type: 'password',
    },
  ],
  alipay: [
    {
      key: 'appId',
      label: '应用 AppID',
      description: '支付宝开放平台创建的应用 APPID，以 2021 开头的纯数字。',
      placeholder: '2021000000000000',
    },
    {
      key: 'alipayPublicKey',
      label: '支付宝公钥',
      description: '支付宝开放平台「应用公钥 / 支付宝公钥」设置页中的支付宝公钥，用于回调验签。',
      placeholder: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...',
      type: 'password',
    },
  ],
}

const sectionFieldClassName =
  'w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

const CHANNEL_LABELS: Record<ChannelKey, string> = {
  webhook: 'Webhook 回调',
  yipay: '易支付',
  wechat: '微信支付',
  alipay: '支付宝',
}

export function ShopPaymentPage({ initialConfigs, onNotify }: ShopPaymentPageProps) {
  const { t } = useI18n()
  const [configs, setConfigs] = React.useState<ShopPaymentConfig[]>(initialConfigs ?? [])
  const [loading, setLoading] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [activeChannel, setActiveChannel] = React.useState<ChannelKey>('webhook')

  const [webhookSecret, setWebhookSecret] = React.useState('')
  const [showWebhookSecret, setShowWebhookSecret] = React.useState(false)
  const [yipay, setYipay] = React.useState<YipayForm>({ gateway: '', pid: '', key: '' })
  const [wechat, setWechat] = React.useState<WechatForm>({ appId: '', mchId: '', apiKey: '' })
  const [alipay, setAlipay] = React.useState<AlipayForm>({ appId: '', alipayPublicKey: '' })

  const notify = React.useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      onNotify?.(message, type)
    },
    [onNotify],
  )

  const applyPrefill = React.useCallback((nextConfigs: ShopPaymentConfig[]) => {
    const webhook = nextConfigs.find((item) => item.provider === 'webhook')
    if (webhook) {
      setWebhookSecret(parseProviderConfig(webhook.configJson).secret ?? '')
    }
    const yipayConfig = nextConfigs.find((item) => item.provider === 'yipay')
    if (yipayConfig) {
      const parsed = parseProviderConfig(yipayConfig.configJson)
      setYipay({ gateway: parsed.gateway ?? '', pid: parsed.pid ?? '', key: parsed.key ?? '' })
    }
    const wechatConfig = nextConfigs.find((item) => item.provider === 'wechat')
    if (wechatConfig) {
      const parsed = parseProviderConfig(wechatConfig.configJson)
      setWechat({ appId: parsed.appId ?? '', mchId: parsed.mchId ?? '', apiKey: parsed.apiKey ?? '' })
    }
    const alipayConfig = nextConfigs.find((item) => item.provider === 'alipay')
    if (alipayConfig) {
      const parsed = parseProviderConfig(alipayConfig.configJson)
      setAlipay({ appId: parsed.appId ?? '', alipayPublicKey: parsed.alipayPublicKey ?? '' })
    }
  }, [])

  const load = React.useCallback(async () => {
    setLoading(true)
    const nextConfigs = await fetchShopPaymentConfigs()
    setConfigs(nextConfigs)
    applyPrefill(nextConfigs)
    setLoading(false)
  }, [applyPrefill])

  React.useEffect(() => {
    if (initialConfigs === undefined) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = async (
    payload: { provider: string; configJson?: string; isEnabled?: boolean },
    successMessage: string,
  ) => {
    setBusy(true)
    const result = await saveShopPaymentConfig(payload)
    setBusy(false)
    if (!result.success) {
      notify(result.message ?? t('shopadmin.saveFailed', '保存失败'), 'error')
      return
    }
    notify(successMessage)
    await load()
  }

  const configOf = (provider: string) => configs.find((item) => item.provider === provider)

  const channelHeader = (provider: ChannelKey) => {
    const config = configOf(provider)
    const isEnabled = config?.isEnabled ?? false
    const missingKeys = config?.missingKeys ?? []
    const configComplete = config?.configComplete ?? false
    const channelDescription: Record<ChannelKey, string> = {
      webhook: t(
        'shopadmin.webhookChannelDesc',
        '激活码生成、订单发货等业务事件通过 Webhook POST JSON 通知到您的业务服务器。',
      ),
      yipay: t('shopadmin.yipayChannelDesc', '通过易支付聚合接口收款，支持个人站点快速接入。'),
      wechat: t('shopadmin.wechatChannelDesc', '微信支付 Native/JSAPI 收款，需企业或个体工商户商户号。'),
      alipay: t('shopadmin.alipayChannelDesc', '支付宝当面付 / 电脑网站支付，需开放平台应用。'),
    }

    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground">{CHANNEL_LABELS[provider]}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{channelDescription[provider]}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                isEnabled ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'
              }`}
            >
              {isEnabled ? t('shopadmin.channelEnabled', '已启用') : t('shopadmin.channelDisabled', '未启用')}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                configComplete ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
              }`}
            >
              {configComplete
                ? t('shopadmin.configComplete', '配置完整')
                : t('shopadmin.configIncomplete', '配置待补全').replace('{{keys}}', missingKeys.join(', '))}
            </span>
            {missingKeys.length > 0 ? (
              <span className="font-mono text-muted-foreground">{missingKeys.join(', ')}</span>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            void save(
              { provider, isEnabled: !isEnabled },
              isEnabled ? t('shopadmin.channelOff', '渠道已停用') : t('shopadmin.channelOn', '渠道已启用'),
            )
          }
          disabled={busy}
          className="inline-flex h-10 shrink-0 items-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent disabled:opacity-50"
        >
          {isEnabled ? t('shopadmin.disableChannel', '停用渠道') : t('shopadmin.enableChannel', '启用渠道')}
        </button>
      </div>
    )
  }

  const saveButton = (onClick: () => void) => (
    <div className="flex justify-end border-t pt-4">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90 disabled:opacity-50"
      >
        {t('shopadmin.save', '保存配置')}
      </button>
    </div>
  )

  const channels: Array<{ key: ChannelKey; provider: string; enabled: boolean }> = (['webhook', 'yipay', 'wechat', 'alipay'] as ChannelKey[]).map(
    (key) => ({ key, provider: key, enabled: configOf(key)?.isEnabled ?? false }),
  )

  return (
    <>
      <ShopSubnav active="payment" />

      <div className="mt-4">
        <PageHeader
          title={t('shopadmin.paymentTitle', '支付渠道')}
          description={t('shopadmin.paymentDescription', '按渠道配置支付方式与回调密钥，敏感字段保存后不再回显明文。')}
          actions={
            <button
              type="button"
              onClick={() => void load()}
              aria-label={t('shopadmin.refreshChannels', '刷新渠道配置')}
              title={t('shopadmin.refreshChannels', '刷新渠道配置')}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-input bg-background text-foreground shadow-sm transition hover:bg-accent"
            >
              <RefreshCw className={`h-4 w-4${loading ? ' animate-spin' : ''}`} aria-hidden />
            </button>
          }
        />
      </div>

      {loading && configs.length === 0 ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* 渠道 Tab */}
          <div role="tablist" aria-label={t('shopadmin.channelTabs', '支付渠道')} className="flex flex-wrap gap-2">
            {channels.map((channel) => {
              const isActive = channel.key === activeChannel
              return (
                <button
                  key={channel.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveChannel(channel.key)}
                  className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  {CHANNEL_LABELS[channel.key]}
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${channel.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
                    title={channel.enabled ? t('shopadmin.channelEnabled', '已启用') : t('shopadmin.channelDisabled', '未启用')}
                  />
                </button>
              )
            })}
          </div>

          {/* 当前渠道配置面板 */}
          <section className="rounded-lg border bg-card p-5 shadow-sm space-y-5">
            {channelHeader(activeChannel)}

            {activeChannel === 'webhook' ? (
              <div className="space-y-1.5">
                <label htmlFor="shop-webhook-secret" className="block text-sm font-medium text-foreground">
                  {t('shopadmin.webhookSecretLabel', '回调签名密钥（Secret）')}
                </label>
                <p className="text-xs text-muted-foreground">
                  {t(
                    'shopadmin.webhookSecretDesc',
                    '用于校验支付回调请求签名，防止伪造回调。保存后不再回显明文。',
                  )}
                </p>
                <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                  <input
                    id="shop-webhook-secret"
                    type={showWebhookSecret ? 'text' : 'password'}
                    value={webhookSecret}
                    onChange={(event) => setWebhookSecret(event.target.value)}
                    placeholder={t('shopadmin.webhookSecretPlaceholder', '例如：whsec_a1b2c3d4e5f6（自定义随机字符串）')}
                    className={sectionFieldClassName}
                  />
                  <button
                    type="button"
                    onClick={() => setShowWebhookSecret((value) => !value)}
                    className="inline-flex h-10 shrink-0 items-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent"
                  >
                    {showWebhookSecret ? t('shopadmin.hide', '隐藏') : t('shopadmin.show', '显示')}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void save(
                        { provider: 'webhook', configJson: JSON.stringify({ secret: webhookSecret.trim() }) },
                        t('shopadmin.webhookSecretSaved', '回调密钥已保存'),
                      )
                    }
                    disabled={busy}
                    className="inline-flex h-10 shrink-0 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90 disabled:opacity-50"
                  >
                    {t('shopadmin.save', '保存')}
                  </button>
                </div>
              </div>
            ) : null}

            {activeChannel !== 'webhook' ? (
              <div className="grid gap-x-5 gap-y-4 md:grid-cols-2">
                {CHANNEL_FIELDS[activeChannel === 'yipay' ? 'yipay' : activeChannel].map((field) => {
                  const value =
                    activeChannel === 'yipay'
                      ? yipay[field.key as keyof YipayForm]
                      : activeChannel === 'wechat'
                        ? wechat[field.key as keyof WechatForm]
                        : alipay[field.key as keyof AlipayForm]
                  const setValue = (next: string) => {
                    if (activeChannel === 'yipay') setYipay({ ...yipay, [field.key]: next })
                    else if (activeChannel === 'wechat') setWechat({ ...wechat, [field.key]: next })
                    else setAlipay({ ...alipay, [field.key]: next })
                  }
                  const inputId = `shop-${activeChannel}-${field.key}`
                  return (
                    <div key={field.key} className="space-y-1.5">
                      <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
                        {field.label}
                      </label>
                      <p className="text-xs text-muted-foreground">{field.description}</p>
                      <input
                        id={inputId}
                        type={field.type === 'password' ? 'password' : 'text'}
                        value={String(value ?? '')}
                        onChange={(event) => setValue(event.target.value)}
                        placeholder={field.placeholder}
                        className={`${sectionFieldClassName} ${field.type === 'password' ? 'font-mono' : ''}`}
                      />
                    </div>
                  )
                })}
              </div>
            ) : null}

            {activeChannel !== 'webhook'
              ? saveButton(() => {
                  if (activeChannel === 'yipay') {
                    void save(
                      {
                        provider: 'yipay',
                        configJson: JSON.stringify({
                          gateway: yipay.gateway.trim(),
                          pid: yipay.pid.trim(),
                          key: yipay.key.trim(),
                        }),
                      },
                      t('shopadmin.yipayConfigSaved', '易支付配置已保存'),
                    )
                  } else if (activeChannel === 'wechat') {
                    void save(
                      {
                        provider: 'wechat',
                        configJson: JSON.stringify({
                          appId: wechat.appId.trim(),
                          mchId: wechat.mchId.trim(),
                          apiKey: wechat.apiKey.trim(),
                        }),
                      },
                      t('shopadmin.wechatConfigSaved', '微信支付配置已保存'),
                    )
                  } else {
                    void save(
                      {
                        provider: 'alipay',
                        configJson: JSON.stringify({
                          appId: alipay.appId.trim(),
                          alipayPublicKey: alipay.alipayPublicKey.trim(),
                        }),
                      },
                      t('shopadmin.alipayConfigSaved', '支付宝配置已保存'),
                    )
                  }
                })
              : null}
          </section>
        </div>
      )}
    </>
  )
}
