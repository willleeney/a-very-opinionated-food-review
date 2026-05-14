import type { ReactNode } from 'react'

interface MobileShellProps {
  children: ReactNode
}

export function MobileShell({ children }: MobileShellProps) {
  return (
    <div className="mobile-shell">
      {children}
    </div>
  )
}
