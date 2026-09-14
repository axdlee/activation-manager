'use client'

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

const sectionFieldClassName =
  'w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * 支付渠道任务页：按渠道 Card 展示 enabled / configComplete / missingKeys；
 * 敏感字段显示与保存规则不变（webhook secret、易支付、微信、支付宝各自折叠 section）。
 */
export function ShopPaymentPage({ initialConfigs, onNotify }: ShopPaymentPageProps) {
  const { t } = useI18n()
  const [configs, setConfigs] = React.useState<ShopPaymentConfig[]>(initialConfigs ?? [])
  const [loading, setLoading] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

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

  const renderChannelHeader = (provider: string, name: string) => {
    const config = configOf(provider)
    const isEnabled = config?.isEnabled ?? false
    const missingKeys = config?.missingKeys ?? []
    const configComplete = config?.configComplete ?? false

    return (
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{name}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
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
                : t('shopadmin.configIncomplete', '配置待补全')}
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
              isEnabled
                ? t('shopadmin.channelOff', '渠道已停用')
                : t('shopadmin.channelOn', '渠道已启用'),
            )
          }
          disabled={busy}
          className="inline-flex h-10 shrink-0 items-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent disabled:opacity-50"
        >
          {isEnabled ? t('shopadmin.disableChannel', '停用') : t('shopadmin.enableChannel', '启用')}
        </button>
      </div>
    )
  }

  return (
    <>
      <ShopSubnav active="payment" />

      <div className="mt-4">
        <PageHeader
          title={t('shopadmin.paymentTitle', '支付渠道')}
          description={t('shopadmin.paymentDescription', '配置支付方式与回调密钥，敏感字段保存后不再回显明文。')}
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
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <div className="space-y-4">
          <section className="rounded-lg border bg-card p-5 shadow-sm">
            {renderChannelHeader('webhook', 'Webhook 回调')}
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-primary select-none">
                {t('shopadmin.webhookSection', '回调密钥')}
              </summary>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  id="shop-webhook-secret"
                  type={showWebhookSecret ? 'text' : 'password'}
                  value={webhookSecret}
                  onChange={(event) => setWebhookSecret(event.target.value)}
                  placeholder={t('shopadmin.webhookSecretPlaceholder', '用于校验支付回调签名')}
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
            </details>
          </section>

          <section className="rounded-lg border bg-card p-5 shadow-sm">
            {renderChannelHeader('yipay', '易支付')}
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-primary select-none">
                {t('shopadmin.yipaySection', '网关 / 商户 / 密钥')}
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <input
                  aria-label={t('shopadmin.yipayGateway', '网关地址')}
                  value={yipay.gateway}
                  onChange={(event) => setYipay({ ...yipay, gateway: event.target.value })}
                  placeholder="https://pay.example.com"
                  className={sectionFieldClassName}
                />
                <input
                  aria-label={t('shopadmin.yipayPid', '商户 ID')}
                  value={yipay.pid}
                  onChange={(event) => setYipay({ ...yipay, pid: event.target.value })}
                  className={sectionFieldClassName}
                />
                <input
                  aria-label={t('shopadmin.yipayKey', '商户密钥')}
                  type="password"
                  value={yipay.key}
                  onChange={(event) => setYipay({ ...yipay, key: event.target.value })}
                  className={sectionFieldClassName}
                />
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() =>
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
                  }
                  disabled={busy}
                  className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90 disabled:opacity-50"
                >
                  {t('shopadmin.save', '保存')}
                </button>
              </div>
            </details>
          </section>

          <section className="rounded-lg border bg-card p-5 shadow-sm">
            {renderChannelHeader('wechat', '微信支付')}
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-primary select-none">
                {t('shopadmin.wechatSection', 'AppID / 商户号 / API 密钥')}
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <input
                  aria-label={t('shopadmin.wechatAppId', 'AppID')}
                  value={wechat.appId}
                  onChange={(event) => setWechat({ ...wechat, appId: event.target.value })}
                  className={sectionFieldClassName}
                />
                <input
                  aria-label={t('shopadmin.wechatMchId', '商户号')}
                  value={wechat.mchId}
                  onChange={(event) => setWechat({ ...wechat, mchId: event.target.value })}
                  className={sectionFieldClassName}
                />
                <input
                  aria-label={t('shopadmin.wechatApiKey', 'API 密钥')}
                  type="password"
                  value={wechat.apiKey}
                  onChange={(event) => setWechat({ ...wechat, apiKey: event.target.value })}
                  className={sectionFieldClassName}
                />
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() =>
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
                  }
                  disabled={busy}
                  className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90 disabled:opacity-50"
                >
                  {t('shopadmin.save', '保存')}
                </button>
              </div>
            </details>
          </section>

          <section className="rounded-lg border bg-card p-5 shadow-sm">
            {renderChannelHeader('alipay', '支付宝')}
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-primary select-none">
                {t('shopadmin.alipaySection', 'AppID / 公钥')}
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input
                  aria-label={t('shopadmin.alipayAppId', 'AppID')}
                  value={alipay.appId}
                  onChange={(event) => setAlipay({ ...alipay, appId: event.target.value })}
                  className={sectionFieldClassName}
                />
                <input
                  aria-label={t('shopadmin.alipayPublicKey', '支付宝公钥')}
                  type="password"
                  value={alipay.alipayPublicKey}
                  onChange={(event) => setAlipay({ ...alipay, alipayPublicKey: event.target.value })}
                  className={sectionFieldClassName}
                />
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() =>
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
                  disabled={busy}
                  className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90 disabled:opacity-50"
                >
                  {t('shopadmin.save', '保存')}
                </button>
              </div>
            </details>
          </section>
        </div>
      )}
    </>
  )
}
