'use client'

import * as React from 'react'
import { MoreHorizontal, Plus } from 'lucide-react'

import { PageHeader } from '@/components/admin/page-header'
import { ShopSubnav } from '@/components/admin/shop-subnav'
import { ShopProductDialog } from '@/components/admin/shop-product-dialog'
import { ConfirmDialog } from '@/components/admin/confirm-dialog'
import { EmptyState } from '@/components/admin/empty-state'
import { Skeleton } from '@/components/ui-admin/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui-admin/dropdown-menu'
import {
  createShopProduct,
  deleteShopProduct,
  fetchShopProducts,
  fetchShopProjects,
  formatPrice,
  restockShopProduct,
  updateShopProduct,
  type ShopProduct,
  type ShopProjectOption,
} from '@/lib/shop-admin-data'
import { useI18n } from '@/lib/i18n/i18n-provider'

export type ShopProductsPageProps = {
  /** 供单测注入；运行时组件自行拉取 */
  initialProducts?: ShopProduct[]
  initialProjects?: ShopProjectOption[]
  onNotify?: (message: string, type?: 'success' | 'error') => void
}

type RestockState = { product: ShopProduct; amount: string }

/**
 * 商品管理任务页：列表优先；创建/编辑共用 Dialog；补货与删除走确认弹框。
 */
export function ShopProductsPage({ initialProducts, initialProjects, onNotify }: ShopProductsPageProps) {
  const { t } = useI18n()
  const [products, setProducts] = React.useState<ShopProduct[]>(initialProducts ?? [])
  const [projects, setProjects] = React.useState<ShopProjectOption[]>(initialProjects ?? [])
  const [loading, setLoading] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ShopProduct | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<ShopProduct | null>(null)
  const [restock, setRestock] = React.useState<RestockState | null>(null)
  const [busy, setBusy] = React.useState(false)

  const notify = React.useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      onNotify?.(message, type)
    },
    [onNotify],
  )

  const load = React.useCallback(async () => {
    setLoading(true)
    const [nextProducts, nextProjects] = await Promise.all([fetchShopProducts(), fetchShopProjects()])
    setProducts(nextProducts)
    setProjects(nextProjects)
    setLoading(false)
  }, [])

  React.useEffect(() => {
    if (initialProducts === undefined) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 新建表单
  const [createForm, setCreateForm] = React.useState({
    name: '',
    description: '',
    projectId: '',
    licenseMode: 'TIME',
    cardType: '',
    validDays: '30',
    totalCount: '',
    price: '',
    stockMode: 'DYNAMIC',
  })
  // 编辑表单
  const [editForm, setEditForm] = React.useState({ name: '', description: '', price: '', isEnabled: true })

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (product: ShopProduct) => {
    setEditing(product)
    setEditForm({
      name: product.name,
      description: product.description ?? '',
      price: String(product.priceInCents / 100),
      isEnabled: product.isEnabled,
    })
    setDialogOpen(true)
  }

  const handleCreate = async () => {
    if (!createForm.name || !createForm.projectId || !createForm.price) {
      notify(t('shopadmin.productFieldsRequired', '请填写商品名称、项目与价格'), 'error')
      return
    }
    setBusy(true)
    const result = await createShopProduct({
      name: createForm.name,
      description: createForm.description || undefined,
      projectId: Number(createForm.projectId),
      licenseMode: createForm.licenseMode,
      cardType: createForm.cardType || undefined,
      validDays: createForm.licenseMode === 'TIME' ? Number(createForm.validDays) : null,
      totalCount: createForm.licenseMode === 'COUNT' ? Number(createForm.totalCount) : null,
      priceInCents: Math.round(Number(createForm.price) * 100),
      stockMode: createForm.stockMode === 'PREDEFINED' ? 'PREDEFINED' : 'DYNAMIC',
    })
    setBusy(false)
    if (!result.success) {
      notify(result.message ?? t('shopadmin.createFailed', '创建失败'), 'error')
      return
    }
    notify(t('shopadmin.productCreated', '商品创建成功'))
    setDialogOpen(false)
    setCreateForm({
      name: '',
      description: '',
      projectId: '',
      licenseMode: 'TIME',
      cardType: '',
      validDays: '30',
      totalCount: '',
      price: '',
      stockMode: 'DYNAMIC',
    })
    await load()
  }

  const handleSaveEdit = async () => {
    if (!editing) return
    const price = Number(editForm.price)
    if (!editForm.name.trim() || !Number.isFinite(price) || price < 0) {
      notify(t('shopadmin.invalidNameOrPrice', '请填写有效的名称与价格'), 'error')
      return
    }
    setBusy(true)
    const result = await updateShopProduct(editing.id, {
      name: editForm.name.trim(),
      description: editForm.description.trim() || null,
      priceInCents: Math.round(price * 100),
      isEnabled: editForm.isEnabled,
    })
    setBusy(false)
    if (!result.success) {
      notify(result.message ?? t('shopadmin.saveFailed', '保存失败'), 'error')
      return
    }
    notify(t('shopadmin.productUpdated', '商品已更新'))
    setDialogOpen(false)
    await load()
  }

  const handleToggle = async (product: ShopProduct) => {
    setBusy(true)
    await updateShopProduct(product.id, { isEnabled: !product.isEnabled })
    setBusy(false)
    await load()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setBusy(true)
    await deleteShopProduct(deleteTarget.id)
    setBusy(false)
    notify(t('shopadmin.productDeleted', '商品已删除'))
    setDeleteTarget(null)
    await load()
  }

  const handleRestock = async () => {
    if (!restock) return
    const amount = Number(restock.amount)
    if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
      notify(t('shopadmin.restockRangeInvalid', '请输入 1-100 之间的整数'), 'error')
      return
    }
    setBusy(true)
    const result = await restockShopProduct(restock.product.id, amount)
    setBusy(false)
    if (!result.success) {
      notify(result.message ?? t('shopadmin.restockFailed', '补货失败'), 'error')
      return
    }
    notify(t('shopadmin.restockDone', '已补充 {{amount}} 张激活码到码池').replace('{{amount}}', String(amount)))
    setRestock(null)
    await load()
  }

  return (
    <>
      <ShopSubnav active="products" />

      <div className="mt-4">
        <PageHeader
          title={t('shopadmin.productsTitle', '商品')}
          description={t('shopadmin.productsDescription', '商品绑定项目与授权套餐，支付后自动发卡。')}
          actions={
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" aria-hidden />
              {t('shopadmin.newProduct', '新建商品')}
            </button>
          }
        />
      </div>

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-4 py-3 font-medium">{t('shopadmin.columnProduct', '商品')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('shopadmin.columnProject', '项目')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('shopadmin.columnSpec', '规格')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('shopadmin.columnPrice', '价格')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('shopadmin.columnStock', '库存')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('shopadmin.columnStatus', '状态')}</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  <span className="sr-only">{t('shopadmin.columnActions', '操作')}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && products.length === 0
                ? Array.from({ length: 3 }).map((_, index) => (
                    <tr key={index}>
                      <td colSpan={7} className="px-4 py-3">
                        <Skeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  ))
                : products.map((product) => (
                    <tr key={product.id} className="transition hover:bg-muted/30">
                      <td className="max-w-[200px] px-4 py-3">
                        <p className="truncate font-medium text-foreground">{product.name}</p>
                        {product.description ? (
                          <p className="truncate text-xs text-muted-foreground">{product.description}</p>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                        {product.projectKey}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {product.licenseMode === 'TIME'
                          ? `${t('shopadmin.licenseModeTime', '时间型')}${product.validDays ? ` · ${product.validDays}${t('shopadmin.days', '天')}` : ''}`
                          : `${t('shopadmin.licenseModeCount', '次数型')} · ${product.totalCount ?? '—'}`}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatPrice(product.priceInCents)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                        {product.stockMode === 'PREDEFINED'
                          ? t('shopadmin.stockPredefined', '预定义码池')
                          : t('shopadmin.stockDynamic', '动态生成')}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            product.isEnabled
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {product.isEnabled
                            ? t('shopadmin.onShelf', '上架中')
                            : t('shopadmin.offShelf', '已下架')}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label={t('shopadmin.moreActions', '更多操作')}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
                            >
                              <MoreHorizontal className="h-4 w-4" aria-hidden />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onSelect={() => openEdit(product)}>
                              {t('shopadmin.editProduct', '编辑商品')}
                            </DropdownMenuItem>
                            {product.stockMode === 'PREDEFINED' ? (
                              <DropdownMenuItem
                                onSelect={() => setRestock({ product, amount: '10' })}
                              >
                                {t('shopadmin.restock', '预定义码补货')}
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem onSelect={() => void handleToggle(product)}>
                              {product.isEnabled
                                ? t('shopadmin.takeOff', '下架')
                                : t('shopadmin.putOn', '上架')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={() => setDeleteTarget(product)}
                            >
                              {t('shopadmin.deleteProduct', '删除')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {!loading && products.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={t('shopadmin.emptyProducts', '还没有商品')}
              description={t('shopadmin.emptyProductsDesc', '创建第一个商品后，买家即可在购买页下单。')}
              action={
                <button
                  type="button"
                  onClick={openCreate}
                  className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  {t('shopadmin.newProduct', '新建商品')}
                </button>
              }
            />
          </div>
        ) : null}
      </div>

      <ShopProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        loading={busy}
        mode={editing ? 'edit' : 'create'}
        projects={projects}
        editingProduct={editing}
        createForm={{
          name: createForm.name,
          onNameChange: (value) => setCreateForm({ ...createForm, name: value }),
          description: createForm.description,
          onDescriptionChange: (value) => setCreateForm({ ...createForm, description: value }),
          projectId: createForm.projectId,
          onProjectIdChange: (value) => setCreateForm({ ...createForm, projectId: value }),
          licenseMode: createForm.licenseMode,
          onLicenseModeChange: (value) => setCreateForm({ ...createForm, licenseMode: value }),
          cardType: createForm.cardType,
          onCardTypeChange: (value) => setCreateForm({ ...createForm, cardType: value }),
          validDays: createForm.validDays,
          onValidDaysChange: (value) => setCreateForm({ ...createForm, validDays: value }),
          totalCount: createForm.totalCount,
          onTotalCountChange: (value) => setCreateForm({ ...createForm, totalCount: value }),
          price: createForm.price,
          onPriceChange: (value) => setCreateForm({ ...createForm, price: value }),
          stockMode: createForm.stockMode,
          onStockModeChange: (value) => setCreateForm({ ...createForm, stockMode: value }),
          onSubmit: () => void handleCreate(),
        }}
        editForm={{
          name: editForm.name,
          onNameChange: (value) => setEditForm({ ...editForm, name: value }),
          description: editForm.description,
          onDescriptionChange: (value) => setEditForm({ ...editForm, description: value }),
          price: editForm.price,
          onPriceChange: (value) => setEditForm({ ...editForm, price: value }),
          isEnabled: editForm.isEnabled,
          onIsEnabledChange: (value) => setEditForm({ ...editForm, isEnabled: value }),
          onSubmit: () => void handleSaveEdit(),
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={t('shopadmin.deleteProductTitle', '删除商品')}
        targetLabel={deleteTarget?.name}
        description={t('shopadmin.deleteProductDescription', '删除后买家将无法再下单该商品。')}
        confirmLabel={t('shopadmin.deleteConfirmLabel', '确认删除')}
        destructive
        loading={busy}
        onConfirm={() => void handleDelete()}
      />

      <ConfirmDialog
        open={restock !== null}
        onOpenChange={(open) => {
          if (!open) setRestock(null)
        }}
        title={t('shopadmin.restockTitle', '预定义码补货')}
        targetLabel={restock?.product.name}
        confirmLabel={t('shopadmin.restockConfirmLabel', '确认补货')}
        loading={busy}
        onConfirm={() => void handleRestock()}
      >
        <div className="mt-3 space-y-1.5">
          <label htmlFor="shop-restock-amount" className="text-sm font-medium text-foreground">
            {t('shopadmin.restockAmountLabel', '补货数量（1-100）')}
          </label>
          <input
            id="shop-restock-amount"
            type="number"
            min="1"
            max="100"
            value={restock?.amount ?? ''}
            onChange={(event) => restock && setRestock({ ...restock, amount: event.target.value })}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </ConfirmDialog>
    </>
  )
}
