// Minimal line icons built only from <rect>/<circle>/<line>/<polygon> —
// simple geometric primitives, deliberately avoiding hand-tuned bezier
// paths that are easy to get subtly wrong without a visual preview loop.
import type { SVGProps } from 'react'

function Base(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  )
}

export function DashboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
    </Base>
  )
}

export function CustomersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 20c0-3.6 2.9-6.2 6.5-6.2s6.5 2.6 6.5 6.2" />
    </Base>
  )
}

export function SuppliersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="4" y="10" width="16" height="10" rx="1" />
      <polygon points="4,10 12,4 20,10" />
    </Base>
  )
}

export function InventoryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="4" y="8" width="7" height="7" rx="0.5" />
      <rect x="13" y="8" width="7" height="7" rx="0.5" />
      <line x1="7.5" y1="8" x2="7.5" y2="3.5" />
      <line x1="16.5" y1="8" x2="16.5" y2="3.5" />
      <line x1="4" y1="3.5" x2="20" y2="3.5" />
    </Base>
  )
}

export function ReceiptIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="6" y="3" width="12" height="18" rx="1" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </Base>
  )
}

export function QuotationIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="6" y="3" width="12" height="18" rx="1" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <circle cx="15" cy="17" r="1.4" />
    </Base>
  )
}

export function ChallanIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="2.5" y="9" width="10" height="7" rx="0.8" />
      <path d="M12.5 11.5H17l3 3V16h-7.5z" />
      <circle cx="6" cy="18" r="1.6" />
      <circle cx="16" cy="18" r="1.6" />
    </Base>
  )
}

export function MenuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <line x1="4" y1="6.5" x2="20" y2="6.5" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17.5" x2="20" y2="17.5" />
    </Base>
  )
}

export function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </Base>
  )
}
