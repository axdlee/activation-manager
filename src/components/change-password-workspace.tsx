'use client'

import React from 'react'

import { AppInput } from '@/components/ui/app-input'
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

const changePasswordChecklistToneMap = {
  true: 'border-emerald-200 bg-emerald-50/90 text-emerald-700',
  false: 'border-surface-200 bg-surface-50 text-ink-500',
} as const

const passwordTips = [
  '优先使用“词组 + 数字 + 符号”的组合，既更强也更容易记忆。',
  '避免复用项目 key、公司名、手机号等容易被猜中的信息。',
  '如在多人环境共用后台，建议定期轮换管理员密码并缩短会话时长。',
]

const passwordChangeEffects = [
  '后台会先校验当前密码，只有验证通过后才会写入新的管理员凭据。',
  '新密码会按系统当前 bcrypt 轮数重新哈希，安全成本与系统配置保持一致。',
  '修改成功后会在 3 秒内自动登出，方便让所有旧会话失效并重新验证。',
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
    'rounded-lg border border-surface-200/70 bg-surface-100 shadow-card',
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
      <section className={`${panelClassName} p-6 sm:p-7`}>
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-surface-200 bg-surface-50 px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-ink-300">
            <span className="h-2 w-2 rounded-full bg-surface-500" />
            凭证安全
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink-50">
            管理员密码工作台
          </h2>
          <p className="mt-2 text-sm leading-7 text-ink-500 sm:text-base">
            修改管理员登录密码，左侧填写、右侧实时校验，改后需重新登录。
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 text-xs text-ink-500">
          <span className="rounded-full border border-surface-200 bg-surface-50 px-3 py-1.5">
            已完成 {completedChecklistCount} / {pageModel.checklist.length} 项安全检查
          </span>
          <span className="rounded-full border border-surface-200 bg-surface-50 px-3 py-1.5">
            修改成功后将立即要求重新登录
          </span>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.04fr)_360px]">
        <form onSubmit={onSubmit} className={`${panelClassName} p-6`}>
          <div className="mb-5">
            <div className="inline-flex items-center rounded-full border border-surface-200 bg-surface-50 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-ink-200">
              密码表单
            </div>
            <h3 className="mt-4 text-xl font-semibold text-ink-50">修改管理员密码</h3>
            <p className="mt-2 text-sm leading-6 text-ink-500">
              建议使用至少 10 位、包含数字与符号的新密码，以降低后台被撞库和弱口令命中的风险。
            </p>
          </div>

          <div className="space-y-4">
            {changePasswordFields.map((field) => (
              <div key={field.key} className="rounded-lg border border-surface-200 bg-surface-100 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <label htmlFor={field.key} className="text-base font-semibold text-ink-50">
                      {field.label}
                    </label>
                    <p className="mt-2 text-sm leading-6 text-ink-500">{field.description}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => togglePasswordFieldVisibility(field.key)}
                    className="inline-flex items-center justify-center rounded-md border border-surface-200 bg-surface-50 px-3 py-2 text-xs font-medium text-ink-300 transition hover:border-surface-300 hover:bg-surface-100"
                  >
                    {isPasswordFieldVisible(field.key) ? '隐藏内容' : '显示内容'}
                  </button>
                </div>

                <div className="mt-4">
                  <AppInput
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

          <div className="mt-5 rounded-lg border border-surface-200 bg-surface-50 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-base font-semibold text-ink-50">确认后立即生效</h3>
                <p className="mt-1 text-sm leading-6 text-ink-500">
                  修改成功后系统会提示重新登录，并在 3 秒内自动退出当前会话。
                </p>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-md bg-ink-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
              >
                {loading ? '修改中...' : '修改密码'}
              </button>
            </div>
          </div>
        </form>

        <div className="space-y-6">
          <div className={`${panelClassName} p-6`}>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-ink-50">实时校验</h3>
              <p className="text-sm leading-6 text-ink-500">
                输入时即时反馈关键检查项，减少提交后报错的来回成本。
              </p>
              <div className="inline-flex rounded-full border border-surface-200 bg-surface-50 px-3 py-1 text-xs font-medium text-ink-500">
                {completedChecklistCount} / {pageModel.checklist.length} 已通过
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {pageModel.checklist.map((item) => (
                <div
                  key={item.key}
                  className={`flex items-start gap-3 rounded-lg border px-4 py-4 ${changePasswordChecklistToneMap[String(item.satisfied) as 'true' | 'false']}`}
                >
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold ${
                      item.satisfied ? 'bg-emerald-600 text-white' : 'bg-surface-100 text-ink-500'
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

          <div className={`${panelClassName} p-6`}>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-ink-50">操作提示</h3>
              <p className="text-sm leading-6 text-ink-500">
                这里只保留真正会影响提交和登录态的说明，方便边改边看。
              </p>
            </div>

            <div className="mt-4 space-y-3">
              {passwordChangeEffects.map((effect, index) => (
                <div
                  key={effect}
                  className="rounded-md border border-surface-200 bg-surface-50 px-4 py-4 text-sm leading-7 text-ink-300"
                >
                  <span className="mr-2 font-semibold text-ink-50">0{index + 1}</span>
                  {effect}
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-surface-200 pt-5">
              <div className="space-y-3">
                {passwordTips.map((tip) => (
                  <div
                    key={tip}
                    className="rounded-md border border-surface-200 bg-surface-100 px-4 py-4 text-sm leading-7 text-ink-300"
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
