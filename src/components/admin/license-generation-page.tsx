'use client'

import * as React from 'react'
import { ChevronRight, Copy } from 'lucide-react'

import { PageHeader } from '@/components/admin/page-header'
import { PageSection } from '@/components/admin/page-section'
import { EmptyState } from '@/components/admin/empty-state'
import {
  getInheritedRebindPlaceholder,
  getInheritedRebindPolicyOptionLabel,
  getScopedRebindCooldownLabel,
  getScopedRebindMaxCountLabel,
  getScopedRebindPolicyLabel,
} from '@/lib/rebind-policy-ui'
import type { LicenseModeValue } from '@/lib/license-status'
import { useI18n } from '@/lib/i18n/i18n-provider'

export type LicenseGenerationProjectOption = {
  id: number
  name: string
  projectKey: string
  isEnabled: boolean
}

export type LicenseGenerationFormProps = {
  selectedProjectKey: string
  onProjectKeyChange: (value: string) => void
  licenseMode: LicenseModeValue
  onLicenseModeChange: (value: LicenseModeValue) => void
  amount: number
  onAmountChange: (value: number) => void
  selectedCardType: string
  onCardTypeChange: (value: string) => void
  expiryDaysValue: number
  onExpiryDaysChange: (value: number) => void
  totalCount: number
  onTotalCountChange: (value: number) => void
  rebindPolicyValue: string
  onRebindPolicyChange: (value: string) => void
  rebindCooldownMinutesValue: string
  onRebindCooldownMinutesChange: (value: string) => void
  rebindMaxCountValue: string
  onRebindMaxCountChange: (value: string) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}

export type LicenseGenerationPageProps = {
  loading?: boolean
  projects: LicenseGenerationProjectOption[]
  form: LicenseGenerationFormProps
  /** 与 dashboard-page-types 的 CardType 对齐 */
  cardTypes: Array<{ name: string; description: string }>
  generatedCodes: Array<{
    id: number
    code: string
    licenseMode: LicenseModeValue
    createdAt: string
    totalCount?: number | null
    expiryDays?: number | null
  }>
  onCopyCode?: (code: string) => void
}

const fieldClassName =
  'w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * 激活码生成任务页：三段式表单（核心字段 → 授权条件 → 高级换绑策略折叠），
 * 右下唯一 primary action。保留既有 DOM 契约（#generate-* 系列 id 与提交按钮文案）。
 */
export function LicenseGenerationPage({
  loading = false,
  projects,
  form,
  cardTypes,
  generatedCodes,
  onCopyCode,
}: LicenseGenerationPageProps) {
  const { t } = useI18n()
  const isTimeMode = form.licenseMode === 'TIME'

  return (
    <>
      <PageHeader
        title={t('licenseGen.title', '生成激活码')}
        description={t('licenseGen.description', '选择项目与授权类型，按需批量生成。')}
      />

      <form onSubmit={form.onSubmit} className="space-y-4">
        <PageSection title={t('licenseGen.coreSection', '基础信息')}>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label htmlFor="generate-selected-project-key" className="text-sm font-medium text-foreground">
                {t('licenseGen.projectLabel', '所属项目')}
              </label>
              <select
                id="generate-selected-project-key"
                value={form.selectedProjectKey}
                onChange={(event) => form.onProjectKeyChange(event.target.value)}
                className={fieldClassName}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.projectKey} disabled={!project.isEnabled}>
                    {project.name} ({project.projectKey}){project.isEnabled ? '' : ' - 已停用'}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="generate-license-mode" className="text-sm font-medium text-foreground">
                {t('licenseGen.modeLabel', '授权类型')}
              </label>
              <select
                id="generate-license-mode"
                value={form.licenseMode}
                onChange={(event) => form.onLicenseModeChange(event.target.value as LicenseModeValue)}
                className={fieldClassName}
              >
                <option value="TIME">{t('licenseGen.modeTime', '时间型')}</option>
                <option value="COUNT">{t('licenseGen.modeCount', '次数型')}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="generate-amount" className="text-sm font-medium text-foreground">
                {t('licenseGen.amountLabel', '生成数量')}
              </label>
              <input
                id="generate-amount"
                type="number"
                min="1"
                max="100"
                value={form.amount}
                onChange={(event) => form.onAmountChange(Number.parseInt(event.target.value, 10) || 1)}
                className={fieldClassName}
                required
              />
            </div>
          </div>
        </PageSection>

        <PageSection title={t('licenseGen.conditionSection', isTimeMode ? '时间条件' : '次数条件')}>
          {isTimeMode ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="generate-card-type" className="text-sm font-medium text-foreground">
                  {t('licenseGen.cardTypeLabel', '套餐类型')}
                </label>
                <select
                  id="generate-card-type"
                  value={form.selectedCardType}
                  onChange={(event) => form.onCardTypeChange(event.target.value)}
                  className={fieldClassName}
                >
                  <option value="">{t('licenseGen.cardTypePlaceholder', '请选择套餐类型')}</option>
                  {cardTypes.map((cardType) => (
                    <option key={cardType.name} value={cardType.name}>
                      {cardType.name} ({cardType.description})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="generate-expiry-days" className="text-sm font-medium text-foreground">
                  {t('licenseGen.expiryLabel', '有效期（天）')}
                </label>
                <input
                  id="generate-expiry-days"
                  type="number"
                  min="1"
                  value={form.expiryDaysValue}
                  onChange={(event) => form.onExpiryDaysChange(Number.parseInt(event.target.value, 10) || 1)}
                  disabled={form.selectedCardType !== '自定义' && form.selectedCardType !== ''}
                  className={fieldClassName}
                  required
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 sm:max-w-xs">
              <label htmlFor="generate-total-count" className="text-sm font-medium text-foreground">
                {t('licenseGen.totalCountLabel', '总次数')}
              </label>
              <input
                id="generate-total-count"
                type="number"
                min="1"
                value={form.totalCount}
                onChange={(event) => form.onTotalCountChange(Number.parseInt(event.target.value, 10) || 1)}
                className={fieldClassName}
                required
              />
            </div>
          )}
        </PageSection>

        <details className="rounded-lg border bg-card shadow-sm">
          <summary className="flex h-12 cursor-pointer items-center gap-1.5 px-4 text-sm font-medium text-foreground select-none">
            <ChevronRight className="h-4 w-4 transition-transform [[open]>&]:rotate-90" aria-hidden />
            {t('licenseGen.advancedSection', '高级换绑策略')}
            <span className="text-xs font-normal text-muted-foreground">
              {t('licenseGen.advancedHint', '默认继承项目级设置')}
            </span>
          </summary>
          <div className="grid gap-4 border-t px-4 py-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label htmlFor="generate-rebind-policy" className="text-xs font-medium text-foreground">
                {getScopedRebindPolicyLabel('code')}
              </label>
              <select
                id="generate-rebind-policy"
                value={form.rebindPolicyValue}
                onChange={(event) => form.onRebindPolicyChange(event.target.value)}
                className={fieldClassName}
              >
                <option value="inherit">{getInheritedRebindPolicyOptionLabel('code')}</option>
                <option value="enabled">{t('licenseGen.rebindAllowed', '允许自助换绑')}</option>
                <option value="disabled">{t('licenseGen.rebindForbidden', '禁止自助换绑')}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="generate-rebind-cooldown" className="text-xs font-medium text-foreground">
                {getScopedRebindCooldownLabel('code')}
              </label>
              <input
                id="generate-rebind-cooldown"
                type="number"
                min="0"
                value={form.rebindCooldownMinutesValue}
                onChange={(event) => form.onRebindCooldownMinutesChange(event.target.value)}
                className={fieldClassName}
                placeholder={getInheritedRebindPlaceholder('code', 'cooldown')}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="generate-rebind-max-count" className="text-xs font-medium text-foreground">
                {getScopedRebindMaxCountLabel('code')}
              </label>
              <input
                id="generate-rebind-max-count"
                type="number"
                min="0"
                value={form.rebindMaxCountValue}
                onChange={(event) => form.onRebindMaxCountChange(event.target.value)}
                className={fieldClassName}
                placeholder={getInheritedRebindPlaceholder('code', 'maxCount')}
              />
            </div>
          </div>
        </details>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? t('licenseGen.generating', '生成中...')
              : isTimeMode
                ? t('licenseGen.submitTime', '生成时间型激活码')
                : t('licenseGen.submitCount', '生成次数型激活码')}
          </button>
        </div>
      </form>

      {generatedCodes.length > 0 ? (
        <div className="mt-6 overflow-hidden rounded-lg border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-base font-semibold text-foreground">
              {t('licenseGen.resultTitle', '本次生成的激活码')}
            </h2>
            <span className="text-sm text-muted-foreground">
              {t('licenseGen.resultCount', '共 {count} 个').replace('{count}', String(generatedCodes.length))}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-4 py-2.5 font-medium">{t('licenseGen.columnCode', '激活码')}</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">{t('licenseGen.columnMode', '授权类型')}</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">{t('licenseGen.columnCreatedAt', '创建时间')}</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    <span className="sr-only">{t('licenseGen.columnActions', '操作')}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {generatedCodes.map((code) => (
                  <tr key={code.id}>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-foreground">{code.code}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                      {code.licenseMode === 'TIME'
                        ? t('licenseGen.modeTime', '时间型')
                        : t('licenseGen.modeCount', '次数型')}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted-foreground">
                      {new Date(code.createdAt).toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => onCopyCode?.(code.code)}
                        className="inline-flex h-9 items-center gap-1 rounded-md px-2.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden />
                        {t('licenseGen.copy', '复制')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState
            title={t('licenseGen.emptyTitle', '还没有生成记录')}
            description={t('licenseGen.emptyDesc', '填写上方表单并点击生成，新激活码会显示在这里。')}
          />
        </div>
      )}
    </>
  )
}
