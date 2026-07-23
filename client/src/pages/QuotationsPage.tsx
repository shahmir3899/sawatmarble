import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch } from '../lib/api'
import type { Contact, Quotation, QuotationStatus } from '../lib/types'
import { ConfirmDialog } from '../components/ConfirmDialog'

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

const STATUSES: QuotationStatus[] = ['draft', 'sent', 'accepted', 'expired']

type Props = {
  canManage: boolean
}

export function QuotationsPage({ canManage }: Props) {
  const [customers, setCustomers] = useState<Contact[]>([])
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)
  const [customerId, setCustomerId] = useState('')
  const [items, setItems] = useState<DraftItem[]>([emptyItem()])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastQuotation, setLastQuotation] = useState<Quotation | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Quotation | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const [custRes, quoRes] = await Promise.all([apiFetch('/customers'), apiFetch('/quotations')])
    const custBody = await custRes.json()
    const quoBody = await quoRes.json()
    setCustomers(custBody.customers ?? [])
    setQuotations(quoBody.quotations ?? [])
    setLoading(false)
  }

  const itemsTotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

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
    const res = await apiFetch('/quotations', {
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
      }),
    })
    setSubmitting(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? `Failed (HTTP ${res.status})`)
      return
    }
    const body = await res.json()
    setLastQuotation(body.quotation)
    setCustomerId('')
    setItems([emptyItem()])
    load()
  }

  async function updateStatus(id: string, status: QuotationStatus) {
    const res = await apiFetch(`/quotations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? `Failed to update status (HTTP ${res.status})`)
      return
    }
    load()
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    const id = pendingDelete.id
    setPendingDelete(null)
    const res = await apiFetch(`/quotations/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? `Failed to delete (HTTP ${res.status})`)
      return
    }
    load()
  }

  // Auth here is a Bearer token, not a cookie session, so a plain <a href>
  // can't carry it — fetch the PDF as a blob with the token attached, then
  // save it via a temporary <a download> link.
  async function downloadPdf(id: string, quotationNo: string) {
    const res = await apiFetch(`/quotations/${id}/pdf`)
    if (!res.ok) {
      setError(`Failed to load PDF (HTTP ${res.status})`)
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${quotationNo}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  function customerName(id: string) {
    return customers.find((c) => c.id === id)?.name ?? id
  }

  return (
    <div className="resource-page">
      <h2>Quotations</h2>
      <p className="page-hint">
        Optional — for negotiated jobs. Most walk-in stock sales skip straight to Receipts.
      </p>

      {canManage && (
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
          <div />
          <div className="receipt-totals">
            <span className="ledger-balance">Total: {itemsTotal.toFixed(2)}</span>
          </div>
        </div>

          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Create Quotation'}
          </button>
        </form>
      )}
      {error && <p className="form-error">{error}</p>}
      {lastQuotation && (
        <p className="demo-result">
          Quotation {lastQuotation.quotationNo} created for {customerName(lastQuotation.customerId)}.{' '}
          <button type="button" className="link-button" onClick={() => downloadPdf(lastQuotation.id, lastQuotation.quotationNo)}>
            PDF
          </button>
        </p>
      )}

      <h2>Past Quotations</h2>
      {loading ? (
        <p>Loading…</p>
      ) : quotations.length === 0 ? (
        <p>No quotations yet.</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Quotation No</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Status</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {quotations.map((q) => (
                <tr key={q.id}>
                  <td>{q.quotationNo}</td>
                  <td>{customerName(q.customerId)}</td>
                  <td>{new Date(q.date).toLocaleDateString()}</td>
                  <td>
                    {canManage ? (
                      <select
                        value={q.status}
                        onChange={(e) => updateStatus(q.id, e.target.value as QuotationStatus)}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    ) : (
                      q.status
                    )}
                  </td>
                  <td>{q.itemsTotal}</td>
                  <td className="row-actions">
                    <button type="button" className="link-button" onClick={() => downloadPdf(q.id, q.quotationNo)}>
                      PDF
                    </button>
                    {canManage && (
                      <button type="button" className="link-button" onClick={() => setPendingDelete(q)}>
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        message={`Remove quotation ${pendingDelete?.quotationNo}? This can't be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
