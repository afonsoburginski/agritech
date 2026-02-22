'use client'

import * as React from 'react'
import { Tooltip as RechartsTooltip } from 'recharts'
import { cn } from '@/lib/utils'

export type ChartConfig = Record<
  string,
  {
    label?: string
    color?: string
    icon?: React.ComponentType<{ className?: string }>
  }
>

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) {
    throw new Error('useChart must be used within a <ChartContainer />')
  }
  return context
}

export function ChartContainer({
  config,
  className,
  children,
}: {
  config: ChartConfig
  className?: string
  children: React.ReactNode
}) {
  const style = React.useMemo(() => {
    const vars: Record<string, string> = {}
    Object.entries(config).forEach(([key, value]) => {
      if (value?.color) {
        vars[`--color-${key}`] = value.color
      }
    })
    return vars as React.CSSProperties
  }, [config])

  return (
    <ChartContext.Provider value={{ config }}>
      <div className={cn('w-full', className)} style={style}>
        {children}
      </div>
    </ChartContext.Provider>
  )
}

export function ChartTooltip({
  content,
  ...props
}: React.ComponentProps<typeof RechartsTooltip> & {
  content: React.ReactElement
}) {
  return <RechartsTooltip {...props} content={content} />
}

type ChartTooltipContentProps = {
  className?: string
  hideLabel?: boolean
  hideIndicator?: boolean
  indicator?: 'line' | 'dot' | 'dashed'
  labelKey?: string
  nameKey?: string
  labelFormatter?: (label: unknown) => React.ReactNode
}

function ChartTooltipContentComponent(
  props: ChartTooltipContentProps & {
    active?: boolean
    payload?: Array<{ name?: string; value?: number; dataKey?: string; color?: string; fill?: string }>
    label?: string
  }
) {
  const {
    active,
    payload,
    label,
    className,
    hideLabel,
    hideIndicator,
    indicator = 'dot',
    labelKey,
    nameKey,
    labelFormatter,
  } = props

  const { config } = useChart()

  if (!active || !payload?.length) return null

  const labelKeyRes = labelKey ?? 'date'
  const nameKeyRes = nameKey ?? 'name'
  const displayLabel = labelFormatter ? labelFormatter(label) : (label ?? '')

  return (
    <div
      className={cn(
        'border-border bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl transition-all ease-in-out',
        className
      )}
    >
      {!hideLabel && displayLabel && <div className="font-medium">{displayLabel}</div>}
      <div className="grid gap-1.5">
        {payload.map((item, index) => {
          const key = String(item.dataKey ?? item.name ?? index)
          const cfg = config[key]
          const name = (nameKeyRes && (item as Record<string, unknown>)[nameKeyRes]) ?? cfg?.label ?? item.name ?? key
          const color = item.color ?? item.fill ?? cfg?.color
          return (
            <div
              key={index}
              className={cn(
                'flex w-full items-stretch gap-2',
                indicator === 'dot' && 'items-center'
              )}
            >
              {!hideIndicator && color && (
                <div
                  className={cn(
                    'shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]',
                    indicator === 'dot' && 'h-2.5 w-2.5',
                    indicator === 'line' && 'w-1',
                    indicator === 'dashed' && 'w-0 border-[1.5px] border-dashed bg-transparent my-0.5'
                  )}
                  style={
                    {
                      '--color-bg': color,
                      '--color-border': color,
                    } as React.CSSProperties
                  }
                />
              )}
              <div className="flex flex-1 justify-between gap-4 leading-none">
                <span className="text-muted-foreground">{String(name)}</span>
                <span className="text-foreground font-mono font-medium tabular-nums">
                  {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const ChartTooltipContent = ChartTooltipContentComponent
