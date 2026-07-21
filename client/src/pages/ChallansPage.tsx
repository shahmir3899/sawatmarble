import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch } from '../lib/api'
import type { ChallanStatus, Contact, DeliveryChallan, Quotation } from '../lib/types'
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
    qty: '',
    sqft: '',
    ratePerSqft: '',
    amount: '',
  }
}

const STATUSES: ChallanStatus[] = ['draft', 'dispatched', 'delivered']

type Props = {
  canManage: boolean
}

export function ChallansPage({ canManage }: Props) {
  const [customers, setCustomers] = useState<Contact[]>([])
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [challans, setChallans] = useState<DeliveryChallan[]>([])
  const [loading, setLoading] = useState(true)
  const [customerId, setCustomerId] = useState('')
  const [quotationId, setQuotationId] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [driverName, setDriverName] = useState('')
  const [items, setItems] = useState<DraftItem[]>([emptyItem()])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastChallan, setLastChallan] = useState<DeliveryChallan | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DeliveryChallan | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const [custRes, quoRes, chRes] = await Promise.all([
      apiFetch('/customers'),
      apiFetch('/quotations'),
      apiFetch('/delivery-challans'),
    ])
    const custBody = await custRes.json()
    const quoBody = await quoRes.json()
    const chBody = await chRes.json()
    setCustomers(custBody.customers ?? [])
    setQuotations(quoBody.quotations ?? [])
    setChallans(chBody.challans ?? [])
    setLoading(false)
  }

  const itemsTotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  const customerQuotations = quotations.filter((q) => q.customerId === customerId)

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((prev) => {
      const next = [...prev]
      const merged = { ...next[index], ...patch }

      if ('length' in patch || 'width' in patch || 'qty' in patch) {
        const l = Number(merged.length) || 0
        const w = Number(merged.width) || 0
        const q = Number(merged.qty) || 0
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
    const res = await apiFetch('/delivery-challans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId,
        quotationId: quotationId || undefined,
        vehicleNumber: vehicleNumber || undefined,
        driverName: driverName || undefined,
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
    setLastChallan(body.challan)
    setCustomerId('')
    setQuotationId('')
    setVehicleNumber('')
    setDriverName('')
    setItems([emptyItem()])
    load()
  }

  async function updateStatus(id: string, status: ChallanStatus) {
    const res = await apiFetch(`/delivery-challans/${id}`, {
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
    const res = await apiFetch(`/delivery-challans/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? `Failed to delete (HTTP ${res.status})`)
      return
    }
    load()
  }

  async function openPdf(id: string) {
    const res = await apiFetch(`/delivery-challans/${id}/pdf`)
    if (!res.ok) {
      setError(`Failed to load PDF (HTTP ${res.status})`)
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }

  function customerName(id: string) {
    return customers.find((c) => c.id === id)?.name ?? id
  }

  return (
    <div className="resource-page">
      <h2>Delivery Challans</h2>
      <p className="page-hint">Goods leaving the yard. Optionally link the quotation this delivery came from.</p>

      {canManage && (
        <form className="receipt-form" onSubmit={handleSubmit}>
          <select value={customerId} onChange={(e) => { setCustomerId(e.target.value); setQuotationId('') }} required>
            <option value="">Select customer *</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <div className="quick-add-form">
            <select value={quotationId} onChange={(e) => setQuotationId(e.target.value)}>
              <option value="">No linked quotation</option>
              {customerQuotations.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.quotationNo}
                </option>
              ))}
            </select>
            <input
              placeholder="Vehicle No."
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
            />
            <input placeholder="Driver Name" value={driverName} onChange={(e) => setDriverName(e.target.value)} />
          </div>

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
            {submitting ? 'Saving…' : 'Create Challan'}
          </button>
        </form>
      )}
      {error && <p className="form-error">{error}</p>}
      {lastChallan && (
        <p className="demo-result">
          Challan {lastChallan.challanNo} created for {customerName(lastChallan.customerId)}.{' '}
          <button type="button" className="link-button" onClick={() => openPdf(lastChallan.id)}>
            View PDF
          </button>
        </p>
      )}

      <h2>Past Challans</h2>
      {loading ? (
        <p>Loading…</p>
      ) : challans.length === 0 ? (
        <p>No delivery challans yet.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Challan No</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Vehicle</th>
              <th>Driver</th>
              <th>Status</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {challans.map((c) => (
              <tr key={c.id}>
                <td>{c.challanNo}</td>
                <td>{customerName(c.customerId)}</td>
                <td>{new Date(c.date).toLocaleDateString()}</td>
                <td>{c.vehicleNumber ?? ''}</td>
                <td>{c.driverName ?? ''}</td>
                <td>
                  {canManage ? (
                    <select value={c.status} onChange={(e) => updateStatus(c.id, e.target.value as ChallanStatus)}>
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    c.status
                  )}
                </td>
                <td>{c.itemsTotal}</td>
                <td className="row-actions">
                  <button type="button" className="link-button" onClick={() => openPdf(c.id)}>
                    PDF
                  </button>
                  {canManage && (
                    <button type="button" className="link-button" onClick={() => setPendingDelete(c)}>
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        message={`Remove challan ${pendingDelete?.challanNo}? This can't be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
