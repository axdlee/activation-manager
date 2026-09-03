import { useState } from 'react'
import { buildChangePasswordPageModel } from './change-password-ui'

export function useChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const pageModel = buildChangePasswordPageModel({
    currentPassword,
    newPassword,
    confirmPassword,
  })
  const completedChecklistCount = pageModel.checklist.filter(
    (item) => item.satisfied,
  ).length

  return {
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    pageModel,
    completedChecklistCount,
    reset: () => {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    },
  }
}