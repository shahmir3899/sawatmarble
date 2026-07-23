import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch } from '../lib/api'
import type { Contact, Receipt } from '../lib/types'
import { formatMoney } from '../lib/format'

type DraftItem = {
  key: string
  description: string
  length: string
  width: string
  qty: string
  sqft: string
  ratePerSqft: string
  amount: string
}

function emptyItem(): DraftItem {
  return {
    key: crypto.randomUUID(),
    description: '',
    length: '',
    width: '',
    qty: '1',
    sqft: '',
    ratePerSqft: '',
    amount: '',
  }
}

export function ReceiptsPage() {
  const [customers, setCustomers] = useState<Contact[]>([])
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)
  const [customerId, setCustomerId] = useState('')
  const [items, setItems] = useState<DraftItem[]>([emptyItem()])
  const [advance, setAdvance] = useState('')
  const [method, setMethod] = useState('cash')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastReceipt, setLastReceipt] = useState<Receipt | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const [custRes, recRes] = await Promise.all([apiFetch('/customers'), apiFetch('/receipts')])
    const custBody = await custRes.json()
    const recBody = await recRes.json()
    setCustomers(custBody.customers ?? [])
    setReceipts(recBody.receipts ?? [])
    setLoading(false)
  }

  const selectedCustomer = customers.find((c) => c.id === customerId)
  const previousBalance = selectedCustomer ? Number(selectedCustomer.ledgerBalance) : 0
  const itemsTotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  const total = previousBalance + itemsTotal
  const advanceNum = Number(advance) || 0
  const balance = total - advanceNum

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((prev) => {
      const next = [...prev]
      const merged = { ...next[index], ...patch }

      if ('length' in patch || 'width' in patch || 'qty' in patch) {
        const l = Number(merged.length) || 0
        const w = Number(merged.width) || 0
        // Qty is "pieces at this size" — default to 1 when left blank/0
        // rather than zeroing out the sqft calc for a single-piece sale.
        const q = Number(merged.qty) || 1
        merged.sqft = (l * w * q).toFixed(2)
      }
      if ('length' in patch || 'width' in patch || 'qty' in patch || 'sqft' in patch || 'ratePerSqft' in patch) {
        const sqftNum = Number(merged.sqft) || 0
        const rateNum = Number(merged.ratePerSqft) || 0
        merged.amount = (sqftNum * rateNum).toFixed(2)
      }

      next[index] = merged
      return next
    })
  }

  function addRow() {
    setItems((prev) => [...prev, emptyItem()])
  }

  function removeRow(index: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!customerId) {
      setError('Select a customer')
      return
    }
    const validItems = items.filter((i) => i.description.trim())
    if (validItems.length === 0) {
      setError('Add at least one line item with a description')
      return
    }

    setSubmitting(true)
    const res = await apiFetch('/receipts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId,
        items: validItems.map((i) => ({
          description: i.description.trim(),
          size: i.length && i.width ? `${i.length} x ${i.width} ft` : undefined,
          qty: Number(i.qty) || 0,
          sqft: Number(i.sqft) || 0,
          ratePerSqft: Number(i.ratePerSqft) || 0,
          amount: Number(i.amount) || 0,
        })),
        advance: advanceNum,
        method,
      }),
    })
    setSubmitting(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? `Failed (HTTP ${res.status})`)
      return
    }
    const body = await res.json()
    setLastReceipt(body.receipt)
    setCustomerId('')
    setItems([emptyItem()])
    setAdvance('')
    load()
  }

  function customerName(id: string) {
    return customers.find((c) => c.id === id)?.name ?? id
  }

  // Auth here is a Bearer token, not a cookie session, so a plain <a href>
  // can't carry it — fetch the PDF as a blob with the token attached, then
  // save it via a temporary <a download> link.
  async function downloadPdf(receiptId: string, invoiceNo: number) {
    const res = await apiFetch(`/receipts/${receiptId}/pdf`)
    if (!res.ok) {
      setError(`Failed to load PDF (HTTP ${res.status})`)
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${invoiceNo}.pdf`
    // Some browsers (Firefox in particular) ignore .click() on an <a> that
    // isn't attached to the DOM and fall back to just navigating/opening it.
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="resource-page">
      <h2>Receipts / Invoices</h2>

      <form className="receipt-form" onSubmit={handleSubmit}>
        <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
          <option value="">Select customer *</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="table-scroll">
          <table className="data-table receipt-items-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Length (ft)</th>
                <th>Width (ft)</th>
                <th>Qty</th>
                <th>Sq.ft</th>
                <th>Rate/Sq.ft</th>
                <th>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.key}>
                  <td>
                    <input
                      value={item.description}
                      onChange={(e) => updateItem(index, { description: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={item.length}
                      onChange={(e) => updateItem(index, { length: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={item.width}
                      onChange={(e) => updateItem(index, { width: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="1"
                      value={item.qty}
                      onChange={(e) => updateItem(index, { qty: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={item.sqft}
                      onChange={(e) => updateItem(index, { sqft: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={item.ratePerSqft}
                      onChange={(e) => updateItem(index, { ratePerSqft: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={item.amount}
                      onChange={(e) => updateItem(index, { amount: e.target.value })}
                    />
                  </td>
                  <td>
                    <button type="button" className="link-button" onClick={() => removeRow(index)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className="link-button" onClick={addRow}>
          + Add line
        </button>

        <div className="receipt-summary">
          <div>
            <input
              placeholder="Advance"
              type="number"
              step="0.01"
              value={advance}
              onChange={(e) => setAdvance(e.target.value)}
            />
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
              <option value="cheque">Cheque</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="receipt-totals">
            <span>Previous Balance: {formatMoney(previousBalance)}</span>
            <span>Items Total: {formatMoney(itemsTotal)}</span>
            <span>Total: {formatMoney(total)}</span>
            <span>Advance: {formatMoney(advanceNum)}</span>
            <span className="ledger-balance">Balance: {formatMoney(balance)}</span>
          </div>
        </div>

        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Create Receipt'}
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}
      {lastReceipt && (
        <p className="demo-result">
          Invoice #{lastReceipt.invoiceNo} created for {customerName(lastReceipt.customerId)} — new balance{' '}
          {formatMoney(lastReceipt.balance)}.{' '}
          <button type="button" className="link-button" onClick={() => downloadPdf(lastReceipt.id, lastReceipt.invoiceNo)}>
            PDF
          </button>
        </p>
      )}

      <h2>Past Receipts</h2>
      {loading ? (
        <p>Loading…</p>
      ) : receipts.length === 0 ? (
        <p>No receipts yet.</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice No</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Total</th>
                <th>Advance</th>
                <th>Balance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.id}>
                  <td>{r.invoiceNo}</td>
                  <td>{customerName(r.customerId)}</td>
                  <td>{new Date(r.date).toLocaleDateString()}</td>
                  <td>{formatMoney(r.total)}</td>
                  <td>{formatMoney(r.advance)}</td>
                  <td>{formatMoney(r.balance)}</td>
                  <td>
                    <button type="button" className="link-button" onClick={() => downloadPdf(r.id, r.invoiceNo)}>
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
