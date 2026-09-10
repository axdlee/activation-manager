import React from 'react'

type DashboardTokenListProps = {
  tokens: string[]
  emptyText: string
  className?: string
  tokenClassName?: string
  emptyClassName?: string
}

const defaultClassName = 'flex flex-wrap gap-2'
const defaultTokenClassName = 'rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-sm text-primary'
const defaultEmptyClassName = 'rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground'

export function DashboardTokenList({
  tokens,
  emptyText,
  className = defaultClassName,
  tokenClassName = defaultTokenClassName,
  emptyClassName = defaultEmptyClassName,
}: DashboardTokenListProps) {
  return (
    <div className={className}>
      {tokens.length > 0 ? (
        tokens.map((token) => (
          <span key={token} className={tokenClassName}>
            {token}
          </span>
        ))
      ) : (
        <span className={emptyClassName}>{emptyText}</span>
      )}
    </div>
  )
}
