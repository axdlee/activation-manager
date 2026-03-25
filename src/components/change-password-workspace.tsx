'use client'

import React from 'react'

import { DashboardActionPanel } from '@/components/dashboard-action-panel'
import { DashboardNumberedList } from '@/components/dashboard-numbered-list'
import { DashboardStatTile } from '@/components/dashboard-stat-tile'
import { DashboardSummaryCard } from '@/components/dashboard-summary-card'
import { type ChangePasswordPageModel } from '@/lib/change-password-ui'

type ChangePasswordWorkspaceProps = {
  pageModel: ChangePasswordPageModel
  completedChecklistCount: number
  currentPassword: string
  newPassword: string
  confirmPassword: string
  loading: boolean
  inputClassName: string
  panelClassName?: string
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onCurrentPasswordChange: (value: string) => void
  onNewPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  togglePasswordFieldVisibility: (key: string) => void
  isPasswordFieldVisible: (key: string) => boolean
}

const changePasswordSummaryCardThemeMap = {
  neutral: {
    panel:
      'border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))]',
    accent: 'bg-slate-400',
    value: 'text-slate-900',
  },
  success: {
    panel:
      'border-emerald-200/80 bg-[linear-gradient(180deg,rgba(236,253,245,0.96),rgba(255,255,255,0.94))]',
    accent: 'bg-emerald-500',
    value: 'text-emerald-900',
  },
  warning: {
    panel:
      'border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,251,235,0.96),rgba(255,255,255,0.94))]',
    accent: 'bg-amber-500',
    value: 'text-amber-900',
  },
  danger: {
    panel:
      'border-rose-200/80 bg-[linear-gradient(180deg,rgba(255,241,242,0.96),rgba(255,255,255,0.94))]',
    accent: 'bg-rose-500',
    value: 'text-rose-900',
  },
} as const

const changePasswordChecklistToneMap = {
  true: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  false: 'border-slate-200 bg-slate-50 text-slate-500',
} as const

const passwordTips = [
  '优先使用“词组 + 数字 + 符号”的组合，既更强也更容易记忆。',
  '避免复用项目 key、公司名、手机号等容易被猜中的信息。',
  '如在多人环境共用后台，建议定期轮换管理员密码并缩短会话时长。',
]

type ChangePasswordField = {
  key: 'currentPassword' | 'newPassword' | 'confirmPassword'
  label: string
  description: string
  placeholder: string
  autoComplete: string
  minLength?: number
}

const changePasswordFields: ChangePasswordField[] = [
  {
    key: 'currentPassword',
    label: '当前密码',
    description: '用于验证当前操作者身份。',
    placeholder: '请输入当前密码',
    autoComplete: 'current-password',
  },
  {
    key: 'newPassword',
    label: '新密码',
    description: '建议至少 10 位，并加入数字与符号。',
    placeholder: '请输入新密码（至少6位）',
    autoComplete: 'new-password',
    minLength: 6,
  },
  {
    key: 'confirmPassword',
    label: '确认新密码',
    description: '再次输入新密码，避免误保存。',
    placeholder: '请再次输入新密码',
    autoComplete: 'new-password',
    minLength: 6,
  },
]

export function ChangePasswordWorkspace({
  pageModel,
  completedChecklistCount,
  currentPassword,
  newPassword,
  confirmPassword,
  loading,
  inputClassName,
  panelClassName =
    'rounded-[28px] border border-slate-200/70 bg-white/90 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.28)] backdrop-blur',
  onSubmit,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  togglePasswordFieldVisibility,
  isPasswordFieldVisible,
}: ChangePasswordWorkspaceProps) {
  const fieldValueMap = {
    currentPassword,
    newPassword,
    confirmPassword,
  }
  const fieldOnChangeMap = {
    currentPassword: onCurrentPasswordChange,
    newPassword: onNewPasswordChange,
    confirmPassword: onConfirmPasswordChange,
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className={`${panelClassName} relative overflow-hidden p-6 sm:p-7`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.12),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_28%)]" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-white/80 px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-emerald-700 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              凭证安全
            </div>

            <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                  管理员密码工作台
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-500 sm:text-base">
                  在修改前先完成实时检查，确保新密码可用、可记忆，并符合后台最基本的安全要求。
                </p>
              </div>

              <div className="rounded-[22px] border border-white/80 bg-white/80 px-4 py-4 text-sm leading-6 text-slate-600 shadow-[0_18px_56px_-42px_rgba(15,23,42,0.28)]">
                已完成 <span className="font-semibold text-slate-900">{completedChecklistCount}</span> /{' '}
                {pageModel.checklist.length} 项安全检查。
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {pageModel.summaryCards.map((card) => {
                const summaryCardTheme = changePasswordSummaryCardThemeMap[card.tone]

                return (
                  <DashboardSummaryCard
                    key={card.label}
                    label={card.label}
                    value={card.value}
                    description={card.description}
                    panelClassName={summaryCardTheme.panel}
                    accentClassName={summaryCardTheme.accent}
                    valueClassName={`mt-3 text-3xl font-semibold tracking-tight ${summaryCardTheme.value}`}
                  />
                )
              })}
            </div>
          </div>
        </div>

        <div className={`${panelClassName} relative overflow-hidden border-emerald-100 bg-[linear-gradient(180deg,rgba(240,253,244,0.96),rgba(255,255,255,0.94))] p-6`}>
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-sky-400 to-indigo-400" />
          <div className="relative">
            <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-emerald-700">
              修改后行为
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">完成后会立即触发这些变化</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              密码修改属于即时生效操作，建议在一个稳定的网络环境下完成。
            </p>

            <DashboardNumberedList
              className="mt-5 space-y-3"
              items={[
                '后台会先校验当前密码，只有验证通过后才会写入新的管理员凭据。',
                '新密码会按系统当前 bcrypt 轮数重新哈希，安全成本与系统配置保持一致。',
                '修改成功后会在 3 秒内自动登出，方便让所有旧会话失效并重新验证。',
              ]}
            />

            <div className="mt-5 grid grid-cols-2 gap-3">
              <DashboardStatTile
                label="自动登出"
                value="3 秒"
                description="修改成功后的安全退出窗口"
              />
              <DashboardStatTile
                label="最低长度"
                value="6 位"
                description="接口层当前要求的最小值"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <form onSubmit={onSubmit} className={`${panelClassName} relative overflow-hidden p-6`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.1),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_26%)]" />
          <div className="relative">
            <div className="mb-5">
              <div className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-slate-700">
                更新凭据
              </div>
              <h3 className="mt-4 text-xl font-semibold text-slate-900">修改管理员密码</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                建议使用至少 10 位、包含数字与符号的新密码，以降低后台被撞库和弱口令命中的风险。
              </p>
            </div>

            <div className="space-y-4">
              {changePasswordFields.map((field) => (
                <div
                  key={field.key}
                  className="rounded-[24px] border border-slate-200/80 bg-white/88 p-5 shadow-[0_18px_56px_-42px_rgba(15,23,42,0.35)] backdrop-blur"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <label htmlFor={field.key} className="text-base font-semibold text-slate-900">
                        {field.label}
                      </label>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{field.description}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => togglePasswordFieldVisibility(field.key)}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      {isPasswordFieldVisible(field.key) ? '隐藏内容' : '显示内容'}
                    </button>
                  </div>

                  <div className="mt-4">
                    <input
                      type={isPasswordFieldVisible(field.key) ? 'text' : 'password'}
                      id={field.key}
                      value={fieldValueMap[field.key]}
                      onChange={(event) => fieldOnChangeMap[field.key](event.target.value)}
                      className={inputClassName}
                      placeholder={field.placeholder}
                      required
                      minLength={field.minLength}
                      autoComplete={field.autoComplete}
                    />
                  </div>
                </div>
              ))}
            </div>

            <DashboardActionPanel
              badge="确认后立即生效"
              title="准备提交本次密码变更？"
              description="修改成功后系统会提示重新登录，并在 3 秒内自动退出当前会话。"
              className="mt-5 rounded-[26px] border border-slate-900/10 bg-slate-950/95 p-5 text-white shadow-[0_24px_64px_-42px_rgba(15,23,42,0.7)]"
              action={
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-slate-950/30 transition hover:-translate-y-0.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
                >
                  {loading ? '修改中...' : '修改密码'}
                </button>
              }
            />
          </div>
        </form>

        <div className="space-y-6">
          <div className={`${panelClassName} p-6`}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-sky-700">
                  实时校验
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">当前密码安全检查</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  输入时会即时反馈关键检查项，减少提交后报错的来回成本。
                </p>
              </div>

              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
                {completedChecklistCount} / {pageModel.checklist.length} 已通过
              </div>
            </div>

            <div className="space-y-3">
              {pageModel.checklist.map((item) => (
                <div
                  key={item.key}
                  className={`flex items-start gap-3 rounded-[22px] border px-4 py-4 ${changePasswordChecklistToneMap[String(item.satisfied) as 'true' | 'false']}`}
                >
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold ${
                      item.satisfied ? 'bg-emerald-600 text-white' : 'bg-white text-slate-400'
                    }`}
                  >
                    {item.satisfied ? '✓' : '·'}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{item.label}</div>
                    <div className="mt-1 text-sm leading-6 opacity-90">{item.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`${panelClassName} relative overflow-hidden border-violet-100 bg-[linear-gradient(180deg,rgba(245,243,255,0.96),rgba(255,255,255,0.94))] p-6`}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.12),transparent_30%)]" />
            <div className="relative">
              <div className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-violet-700">
                安全建议
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">给管理员密码留一点冗余</h3>
              <div className="mt-4 grid gap-3">
                {passwordTips.map((tip) => (
                  <div
                    key={tip}
                    className="rounded-[22px] border border-white/80 bg-white/80 px-4 py-4 text-sm leading-7 text-slate-600 shadow-sm"
                  >
                    {tip}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
