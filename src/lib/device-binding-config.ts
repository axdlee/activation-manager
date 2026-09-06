import { getConfigWithDefault } from './config-service'

/**
 * 解析「是否启用设备绑定」系统配置。
 * 默认 true：激活码绑定到首次激活的设备。
 * 关闭后：激活成功但不在激活码上记录 usedBy（适用于无需设备锁定的授权场景）。
 */
export async function resolveDeviceBindingEnabled(): Promise<boolean> {
  const value = await getConfigWithDefault('allowDeviceBinding')
  return value !== false
}

/**
 * 根据设备绑定开关决定激活流程是否应写入 usedBy。
 * 返回 null 表示「不绑定设备」（跳过 usedBy 写入）；否则返回要绑定的 machineId。
 */
export async function resolveBindingMachineId(
  machineId: string,
): Promise<string | null> {
  const enabled = await resolveDeviceBindingEnabled()
  return enabled ? machineId : null
}
