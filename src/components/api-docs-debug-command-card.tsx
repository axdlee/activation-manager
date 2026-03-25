import React from 'react'

import { DashboardCodePanel } from '@/components/dashboard-code-panel'
import {
  publicFeatureCardClassName,
  publicSecondaryButtonClassName,
} from '@/lib/public-ui'

type ApiDocsDebugCommandCardProps = {
  title: string
  description: string
  command: string
  onCopy?: () => void
  copyButtonLabel?: string
  panelClassName?: string
  buttonClassName?: string
  codeClassName?: string
}

export function ApiDocsDebugCommandCard({
  title,
  description,
  command,
  onCopy,
  copyButtonLabel = '复制',
  panelClassName = publicFeatureCardClassName,
  buttonClassName = publicSecondaryButtonClassName,
  codeClassName,
}: ApiDocsDebugCommandCardProps) {
  return (
    <DashboardCodePanel
      panelClassName={panelClassName}
      headerClassName="mb-4 flex flex-col gap-4"
      header={
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        </div>
      }
      action={
        onCopy ? (
          <button type="button" onClick={onCopy} className={buttonClassName}>
            {copyButtonLabel}
          </button>
        ) : null
      }
      code={command}
      codeClassName={codeClassName}
    />
  )
}
