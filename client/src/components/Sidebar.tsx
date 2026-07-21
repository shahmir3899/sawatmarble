import type { ReactElement } from 'react'
import logo from '../assets/logo.jpeg'
import type { Role } from '../lib/types'
import {
  ChallanIcon,
  CustomersIcon,
  DashboardIcon,
  InventoryIcon,
  QuotationIcon,
  ReceiptIcon,
  SuppliersIcon,
} from './icons'

export type Tab = 'dashboard' | 'customers' | 'suppliers' | 'inventory' | 'receipts' | 'quotations' | 'challans'

type NavItem = { tab: Tab; label: string; Icon: (props: { className?: string }) => ReactElement }

const SECTIONS: { label: string; items: NavItem[] }[] = [
  { label: 'Overview', items: [{ tab: 'dashboard', label: 'Dashboard', Icon: DashboardIcon }] },
  {
    label: 'Contacts',
    items: [
      { tab: 'customers', label: 'Customers', Icon: CustomersIcon },
      { tab: 'suppliers', label: 'Suppliers', Icon: SuppliersIcon },
    ],
  },
  { label: 'Stock', items: [{ tab: 'inventory', label: 'Inventory', Icon: InventoryIcon }] },
  {
    label: 'Documents',
    items: [
      { tab: 'receipts', label: 'Receipts', Icon: ReceiptIcon },
      { tab: 'quotations', label: 'Quotations', Icon: QuotationIcon },
      { tab: 'challans', label: 'Challans', Icon: ChallanIcon },
    ],
  },
]

type Props = {
  tab: Tab
  onSelectTab: (tab: Tab) => void
  email: string
  role: Role | null
  onSignOut: () => void
  open: boolean
  onClose: () => void
}

export function Sidebar({ tab, onSelectTab, email, role, onSignOut, open, onClose }: Props) {
  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <img src={logo} alt="Sawat Marble Stone & Granite" />
          <div className="sidebar-brand-text">
            Sawat Marble
            <br />
            Stone &amp; Granite
          </div>
        </div>

        <nav className="sidebar-nav">
          {SECTIONS.map((section) => (
            <div key={section.label}>
              <div className="sidebar-section-label">{section.label}</div>
              {section.items.map(({ tab: itemTab, label, Icon }) => (
                <button
                  key={itemTab}
                  className={`sidebar-link ${tab === itemTab ? 'active' : ''}`}
                  onClick={() => {
                    onSelectTab(itemTab)
                    onClose()
                  }}
                >
                  <Icon />
                  {label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="user-email">{email}</span>
          <span className="user-role">{role ?? 'loading role…'}</span>
          <button className="sidebar-signout" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
