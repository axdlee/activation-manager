// dashboard 样式 token —— shadcn 语义令牌版
// 全部走 background/card/primary/muted/border/input 等语义变量，
// 深浅主题（data-theme）自动适配；与 ui-admin/ 组件库视觉一致。

export const panelClassName =
  'rounded-lg border bg-card text-card-foreground shadow-sm'

export const mutedPanelClassName =
  'rounded-lg border bg-muted/40'

export const inputClassName =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

export const compactInputClassName =
  'flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

export const primaryButtonClassName =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50'

export const successButtonClassName =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-success px-4 py-2 text-sm font-medium text-success-foreground shadow transition-colors hover:bg-success/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50'

export const dangerButtonClassName =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground shadow transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50'

export const warningButtonClassName =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-warning px-4 py-2 text-sm font-medium text-warning-foreground shadow transition-colors hover:bg-warning/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50'

export const ghostButtonClassName =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50'

export const workspaceSummaryCardClassName =
  'rounded-md border bg-card px-4 py-4 shadow-sm'

export const codeBlockClassName =
  'overflow-x-auto rounded-md border border-input bg-zinc-950 px-4 py-4 font-mono text-xs leading-6 text-zinc-100 shadow-sm'

export const paginationButtonClassName =
  'inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

export const paginationActiveButtonClassName =
  'inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-primary bg-primary px-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90'
