export type Role = 'owner' | 'staff' | 'accountant'

export type Contact = {
  id: string
  name: string
  address: string | null
  phone: string | null
  ledgerBalance: string
  createdAt: string
  updatedAt: string
}

export type InventoryItem = {
  id: string
  category: string
  subCategory: string | null
  description: string
  size: string | null
  unit: 'sqft' | 'piece'
  defaultRatePerSqft: string | null
  qtyOnHand: string
  createdAt: string
  updatedAt: string
}
