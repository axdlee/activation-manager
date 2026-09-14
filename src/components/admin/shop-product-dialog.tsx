'use client'

import * as React from 'react'
import { X } from 'lucide-react'

import type { ShopProduct } from '@/lib/shop-admin-data'
import type { LicenseModeValue } from '@/lib/license-status'
import { useI18n } from '@/lib/i18n/i18n-provider'

export type ShopProductDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  loading?: boolean
  /** create = 新建商品（完整字段）；edit = 编辑基础信息（名称/描述/价格/启用） */
  mode?: 'create' | 'edit'
  projects: Array<{ id: number; projectKey: string; name: string }>
  editingProduct?: ShopProduct | null
  createForm: {
    name: string
    onNameChange: (value: string) => void
    description: string
    onDescriptionChange: (value: string) => void
    projectId: string
    onProjectIdChange: (value: string) => void
    licenseMode: LicenseModeValue | string
    onLicenseModeChange: (value: string) => void
    cardType: string
    onCardTypeChange: (value: string) => void
    validDays: string
    onValidDaysChange: (value: string) => void
    totalCount: string
    onTotalCountChange: (value: string) => void
    price: string
    onPriceChange: (value: string) => void
    stockMode: string
    onStockModeChange: (value: string) => void
    onSubmit: () => void
  }
  editForm?: {
    name: string
    onNameChange: (value: string) => void
    description: string
    onDescriptionChange: (value: string) => void
    price: string
    onPriceChange: (value: string) => void
    isEnabled: boolean
    onIsEnabledChange: (value: boolean) => void
    onSubmit: () => void
  }
}

const fieldClassName =
  'w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * 商品创建 / 编辑共用 Dialog。
 * create 模式保留旧表单占位符（商品名称（如 月卡）/价格（元）等），首个 select 恒为所属项目。
 */
export function ShopProductDialog({
  open,
  onOpenChange,
  loading = false,
  mode = 'create',
  projects,
  editingProduct = null,
  createForm,
  editForm,
}: ShopProductDialogProps) {
  const { t } = useI18n()
  const titleId = React.useId()
  const panelRef = React.useRef<HTMLDivElement | null>(null)
  const isEdit = mode === 'edit'

  React.useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const frame = window.requestAnimationFrame(() => panelRef.current?.focus())
    return () => {
      window.cancelAnimationFrame(frame)
      previous?.focus?.()
    }
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [open, onOpenChange])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button
        type="button"
        aria-label={t('shopadmin.closeDialog', '关闭对话框')}
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 bg-black/60"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border bg-card shadow-lg outline-none animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 id={titleId} className="text-base font-semibold text-foreground">
            {isEdit
              ? `${t('shopadmin.editProduct', '编辑商品')}${editingProduct ? ` · ${editingProduct.name}` : ''}`
              : t('shopadmin.newProduct', '新建商品')}
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={t('shopadmin.closeDialog', '关闭对话框')}
            className="rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isEdit && editForm ? (
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="space-y-1.5">
              <label htmlFor="shop-product-name" className="text-sm font-medium text-foreground">
                {t('shopadmin.nameLabel', '商品名称')}
              </label>
              <input
                id="shop-product-name"
                type="text"
                value={editForm.name}
                onChange={(event) => editForm.onNameChange(event.target.value)}
                className={fieldClassName}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="shop-product-description" className="text-sm font-medium text-foreground">
                {t('shopadmin.descriptionLabel', '商品描述')}
              </label>
              <input
                id="shop-product-description"
                type="text"
                value={editForm.description}
                onChange={(event) => editForm.onDescriptionChange(event.target.value)}
                className={fieldClassName}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="shop-product-price" className="text-sm font-medium text-foreground">
                {t('shopadmin.priceLabel', '价格（元）')}
              </label>
              <input
                id="shop-product-price"
                type="number"
                min="0"
                step="0.01"
                value={editForm.price}
                onChange={(event) => editForm.onPriceChange(event.target.value)}
                className={fieldClassName}
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={editForm.isEnabled}
                onChange={(event) => editForm.onIsEnabledChange(event.target.checked)}
                className="h-4 w-4"
              />
              {t('shopadmin.enabledLabel', '上架中')}
            </label>
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="shop-product-name" className="text-sm font-medium text-foreground">
                  {t('shopadmin.nameLabel', '商品名称')}
                </label>
                <input
                  id="shop-product-name"
                  type="text"
                  value={createForm.name}
                  onChange={(event) => createForm.onNameChange(event.target.value)}
                  placeholder={t('shopadmin.productNamePlaceholder', '商品名称（如 月卡）')}
                  className={fieldClassName}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="shop-product-description" className="text-sm font-medium text-foreground">
                  {t('shopadmin.descriptionLabel', '商品描述')}
                </label>
                <input
                  id="shop-product-description"
                  type="text"
                  value={createForm.description}
                  onChange={(event) => createForm.onDescriptionChange(event.target.value)}
                  placeholder={t('shopadmin.productDescPlaceholder', '商品描述（可选）')}
                  className={fieldClassName}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="shop-product-project" className="text-sm font-medium text-foreground">
                  {t('shopadmin.projectLabel', '所属项目')}
                </label>
                <select
                  id="shop-product-project"
                  value={createForm.projectId}
                  onChange={(event) => createForm.onProjectIdChange(event.target.value)}
                  className={fieldClassName}
                >
                  <option value="">{t('shopadmin.selectProject', '选择项目')}</option>
                  {projects.map((project) => (
                    <option key={project.id} value={String(project.id)}>
                      {project.name} ({project.projectKey})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="shop-product-license-mode" className="text-sm font-medium text-foreground">
                  {t('shopadmin.licenseModeLabel', '授权类型')}
                </label>
                <select
                  id="shop-product-license-mode"
                  value={createForm.licenseMode}
                  onChange={(event) => createForm.onLicenseModeChange(event.target.value)}
                  className={fieldClassName}
                >
                  <option value="TIME">{t('shopadmin.licenseModeTime', '时间型')}</option>
                  <option value="COUNT">{t('shopadmin.licenseModeCount', '次数型')}</option>
                </select>
              </div>
              {createForm.licenseMode === 'TIME' ? (
                <>
                  <div className="space-y-1.5">
                    <label htmlFor="shop-product-card-type" className="text-sm font-medium text-foreground">
                      {t('shopadmin.cardTypeLabel', '套餐类型')}
                    </label>
                    <input
                      id="shop-product-card-type"
                      type="text"
                      value={createForm.cardType}
                      onChange={(event) => createForm.onCardTypeChange(event.target.value)}
                      placeholder={t('shopadmin.cardTypePlaceholder', '套餐类型（如 月卡）')}
                      className={fieldClassName}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="shop-product-valid-days" className="text-sm font-medium text-foreground">
                      {t('shopadmin.validDaysLabel', '有效期（天）')}
                    </label>
                    <input
                      id="shop-product-valid-days"
                      type="number"
                      min="1"
                      value={createForm.validDays}
                      onChange={(event) => createForm.onValidDaysChange(event.target.value)}
                      className={fieldClassName}
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-1.5">
                  <label htmlFor="shop-product-total-count" className="text-sm font-medium text-foreground">
                    {t('shopadmin.totalCountLabel', '总次数')}
                  </label>
                  <input
                    id="shop-product-total-count"
                    type="number"
                    min="1"
                    value={createForm.totalCount}
                    onChange={(event) => createForm.onTotalCountChange(event.target.value)}
                    className={fieldClassName}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <label htmlFor="shop-product-price" className="text-sm font-medium text-foreground">
                  {t('shopadmin.priceLabel', '价格（元）')}
                </label>
                <input
                  id="shop-product-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={createForm.price}
                  onChange={(event) => createForm.onPriceChange(event.target.value)}
                  placeholder={t('shopadmin.pricePlaceholder', '价格（元）')}
                  className={fieldClassName}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="shop-product-stock-mode" className="text-sm font-medium text-foreground">
                  {t('shopadmin.stockModeLabel', '库存模式')}
                </label>
                <select
                  id="shop-product-stock-mode"
                  value={createForm.stockMode}
                  onChange={(event) => createForm.onStockModeChange(event.target.value)}
                  className={fieldClassName}
                >
                  <option value="DYNAMIC">{t('shopadmin.stockDynamic', '动态生成')}</option>
                  <option value="PREDEFINED">{t('shopadmin.stockPredefined', '预定义码池')}</option>
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t px-6 py-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent"
          >
            {t('shopadmin.cancel', '取消')}
          </button>
          <button
            type="button"
            onClick={isEdit ? editForm?.onSubmit : createForm.onSubmit}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? t('shopadmin.saving', '保存中…')
              : isEdit
                ? t('shopadmin.saveProduct', '保存商品')
                : t('shopadmin.createProductSubmit', '创建商品')}
          </button>
        </div>
      </div>
    </div>
  )
}
