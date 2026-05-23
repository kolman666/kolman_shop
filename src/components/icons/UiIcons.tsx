import type { ReactNode } from 'react'

type IconProps = {
  size?: number
  className?: string
}

const base = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function Svg({ size = 18, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      {...base}
    >
      {children}
    </svg>
  )
}

export function IconCookie({ size = 22, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="14" cy="9" r="1" fill="currentColor" stroke="none" />
      <circle cx="11" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13" r="1" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconFolder({ size = 18, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </Svg>
  )
}

export function IconUpload({ size = 18, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M12 16V4m0 0l-4 4m4-4l4 4" />
      <path d="M4 20h16" />
    </Svg>
  )
}

export function IconImport({ size = 18, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M12 3v12m0 0l-4-4m4 4l4-4" />
      <path d="M5 21h14" />
    </Svg>
  )
}

export function IconGlobe({ size = 18, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18" />
    </Svg>
  )
}

export function IconPackage({ size = 18, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
      <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
    </Svg>
  )
}

export function IconDocument({ size = 18, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M8 4h6l4 4v12a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z" />
      <path d="M14 4v4h4" />
      <path d="M9 13h6M9 17h4" />
    </Svg>
  )
}

export function IconChat({ size = 18, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M4 5a2 2 0 012-2h12a2 2 0 012 2v9a2 2 0 01-2 2H9l-4 4V5z" />
    </Svg>
  )
}

export function IconTicket({ size = 18, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M4 9a2 2 0 012-2h1v10H6a2 2 0 01-2-2V9zm16 0a2 2 0 00-2-2h-1v10h1a2 2 0 002-2V9z" />
      <path d="M9 7h6v10H9V7z" />
    </Svg>
  )
}

export function IconCart({ size = 18, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <circle cx="9" cy="20" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="18" cy="20" r="1.5" fill="currentColor" stroke="none" />
      <path d="M3 4h2l2.2 11.2a2 2 0 002 1.8h7.6a2 2 0 002-1.8L20 7H7" />
    </Svg>
  )
}

export function IconPlus({ size = 18, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  )
}

export function IconCheck({ size = 18, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M5 12l4 4L19 6" />
    </Svg>
  )
}

export function IconCopy({ size = 18, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </Svg>
  )
}

export function IconX({ size = 18, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  )
}

export function IconChevronRight({ size = 18, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M9 6l6 6-6 6" />
    </Svg>
  )
}
