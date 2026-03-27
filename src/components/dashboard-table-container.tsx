'use client'

import React, {
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
} from 'react'

type DashboardTableContainerProps = {
  children: ReactNode
  className?: string
}

const defaultClassName =
  'dashboard-scroll-area overflow-x-auto overflow-y-hidden touch-pan-x rounded-[24px] border border-slate-200/80 bg-white/95 shadow-[0_18px_56px_-42px_rgba(15,23,42,0.22)] cursor-grab'
const interactiveTargetSelector =
  'button, a, input, select, textarea, label, summary, [role="button"], [role="link"], [data-disable-table-drag="true"]'

type ClosestCapableTarget = {
  closest: (selector: string) => unknown
  isContentEditable?: boolean
}

export type DashboardTableDragState = {
  pointerId: number
  startX: number
  startScrollLeft: number
  dragged: boolean
}

export function clearPendingDragSuppression(
  dragState: DashboardTableDragState,
): DashboardTableDragState {
  if (!dragState.dragged) {
    return dragState
  }

  return {
    ...dragState,
    dragged: false,
  }
}

export function resolveHorizontalWheelDelta({
  deltaX,
  deltaY,
  shiftKey,
}: {
  deltaX: number
  deltaY: number
  shiftKey: boolean
}) {
  if (Math.abs(deltaX) > 0) {
    return deltaX
  }

  if (shiftKey) {
    return deltaY
  }

  return 0
}

export function isInteractiveDragTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object' || !('closest' in target)) {
    return false
  }

  const element = target as ClosestCapableTarget

  if (element.isContentEditable) {
    return true
  }

  return Boolean(element.closest(interactiveTargetSelector))
}

export function DashboardTableContainer({
  children,
  className,
}: DashboardTableContainerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<DashboardTableDragState>({
    pointerId: -1,
    startX: 0,
    startScrollLeft: 0,
    dragged: false,
  })
  const [isDragging, setIsDragging] = useState(false)

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current

    if (!container || container.scrollWidth <= container.clientWidth) {
      return
    }

    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }

    if (isInteractiveDragTarget(event.target)) {
      dragStateRef.current = clearPendingDragSuppression(dragStateRef.current)
      return
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: container.scrollLeft,
      dragged: false,
    }
    setIsDragging(true)
    container.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current

    if (!container || dragStateRef.current.pointerId !== event.pointerId) {
      return
    }

    const deltaX = event.clientX - dragStateRef.current.startX

    if (Math.abs(deltaX) > 3) {
      dragStateRef.current.dragged = true
    }

    container.scrollLeft = dragStateRef.current.startScrollLeft - deltaX

    if (dragStateRef.current.dragged) {
      event.preventDefault()
    }
  }

  const stopDragging = (event: PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current

    if (!container || dragStateRef.current.pointerId !== event.pointerId) {
      return
    }

    if (container.hasPointerCapture?.(event.pointerId)) {
      container.releasePointerCapture(event.pointerId)
    }

    dragStateRef.current.pointerId = -1
    setIsDragging(false)
  }

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    const container = containerRef.current

    if (!container || container.scrollWidth <= container.clientWidth) {
      return
    }

    const horizontalDelta = resolveHorizontalWheelDelta({
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      shiftKey: event.shiftKey,
    })

    if (horizontalDelta === 0) {
      return
    }

    const maxScrollLeft = container.scrollWidth - container.clientWidth
    const nextScrollLeft = Math.min(
      maxScrollLeft,
      Math.max(0, container.scrollLeft + horizontalDelta),
    )

    if (nextScrollLeft === container.scrollLeft) {
      return
    }

    container.scrollLeft = nextScrollLeft
  }

  const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.dragged) {
      return
    }

    dragStateRef.current = clearPendingDragSuppression(dragStateRef.current)
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <div
      ref={containerRef}
      className={[
        defaultClassName,
        isDragging ? 'cursor-grabbing select-none' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onWheel={handleWheel}
      onClickCapture={handleClickCapture}
    >
      {children}
    </div>
  )
}
