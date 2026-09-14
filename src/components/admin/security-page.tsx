'use client'

import * as React from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { useOptionalToast } from '@/components/toast-provider'
import { ChangePasswordWorkspace } from '@/components/change-password-workspace'
import { useChangePassword } from '@/lib/use-change-password'
import { useI18n } from '@/lib/i18n/i18n-provider'

/**
 * 账户安全任务页：修改密码 + 成功后可见 3 秒倒计时并自动退出登录。
 * 路由：/admin/settings/security（用户菜单与设置页均可进入）。
 */
export function SecurityPage() {
  const { t } = useI18n()
  const { toast } = useOptionalToast()
  const changePassword = useChangePassword()
  const [loading, setLoading] = React.useState(false)
  const [revealedPasswordFieldKeys, setRevealedPasswordFieldKeys] = React.useState<string[]>([])
  const [countdown, setCountdown] = React.useState<number | null>(null)

  const showMessage = React.useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      if (!toast) return
      if (type === 'error') {
        toast.error(message)
      } else {
        toast.success(message)
      }
    },
    [toast],
  )

  const togglePasswordFieldVisibility = React.useCallback((key: string) => {
    setRevealedPasswordFieldKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    )
  }, [])

  const isPasswordFieldVisible = React.useCallback(
    (key: string) => revealedPasswordFieldKeys.includes(key),
    [revealedPasswordFieldKeys],
  )

  const logout = React.useCallback(async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
    } catch {
      // 忽略
    }
    window.location.assign('/admin/login')
  }, [])

  const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const { currentPassword, newPassword, confirmPassword, reset } = changePassword

    if (!currentPassword || !newPassword || !confirmPassword) {
      showMessage(t('securityPage.fillAll', '请填写所有密码字段'), 'error')
      return
    }
    if (newPassword !== confirmPassword) {
      showMessage(t('securityPage.mismatch', '新密码与确认密码不匹配'), 'error')
      return
    }
    if (newPassword.length < 6) {
      showMessage(t('securityPage.tooShort', '新密码长度不能少于6位'), 'error')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await response.json()
      if (data.success) {
        showMessage(data.message ?? t('securityPage.changed', '密码修改成功'))
        reset()
        // 可见的 3 秒倒计时后退出登录
        setCountdown(3)
        let seconds = 3
        const timer = setInterval(() => {
          seconds -= 1
          if (seconds <= 0) {
            clearInterval(timer)
            void logout()
            return
          }
          setCountdown(seconds)
        }, 1000)
      } else {
        showMessage(data.message ?? t('securityPage.changeFailed', '密码修改失败'), 'error')
      }
    } catch {
      showMessage(t('securityPage.networkError', '网络错误，请重试'), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: t('settingsPage.title', '系统设置'), href: '/admin/settings' }]}
        title={t('pwdws.title', '管理员密码工作台')}
        description={t('pwdws.subtitle', '修改管理员登录密码，改后需重新登录。')}
      />

      {countdown !== null ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-5 py-4 text-sm text-foreground"
        >
          {t('securityPage.countdown', '密码修改成功，{seconds} 秒后自动退出登录…').replace(
            '{seconds}',
            String(countdown),
          )}
        </div>
      ) : null}

      <ChangePasswordWorkspace
        pageModel={changePassword.pageModel}
        completedChecklistCount={changePassword.completedChecklistCount}
        currentPassword={changePassword.currentPassword}
        newPassword={changePassword.newPassword}
        confirmPassword={changePassword.confirmPassword}
        loading={loading}
        inputClassName=""
        onSubmit={handleChangePassword}
        onCurrentPasswordChange={changePassword.setCurrentPassword}
        onNewPasswordChange={changePassword.setNewPassword}
        onConfirmPasswordChange={changePassword.setConfirmPassword}
        togglePasswordFieldVisibility={togglePasswordFieldVisibility}
        isPasswordFieldVisible={isPasswordFieldVisible}
      />
    </>
  )
}
