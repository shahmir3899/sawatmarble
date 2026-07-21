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

export type Payment = {
  id: string
  customerId: string | null
  supplierId: string | null
  amount: string
  method: string | null
  note: string | null
  paymentDate: string
  createdAt: string
}

export type ReceiptItem = {
  id: string
  description: string
  size: string | null
  qty: string
  sqft: string
  ratePerSqft: string
  amount: string
  sortOrder: number
}

export type Receipt = {
  id: string
  invoiceNo: number
  customerId: string
  date: string
  previousBalance: string
  itemsTotal: string
  total: string
  advance: string
  balance: string
  termsSnapshot: string | null
  createdAt: string
  items?: ReceiptItem[]
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
