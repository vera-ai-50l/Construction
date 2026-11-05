'use client'

import * as P from '@phosphor-icons/react'
import type { IconProps } from '@phosphor-icons/react'

// Content refers to icons by name; this keeps content files plain data.
const icons = P as unknown as Record<string, React.ComponentType<IconProps>>

export function Icon({ name, size = 18, weight = 'light', className = '' }: { name: string; size?: number; weight?: IconProps['weight']; className?: string }) {
  const C = icons[name] || P.Circle
  return <C size={size} weight={weight} className={className} aria-hidden />
}
