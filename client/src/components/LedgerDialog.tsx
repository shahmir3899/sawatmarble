import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch } from '../lib/api'
import type { Contact, Payment } from '../lib/types'
import { formatMoney } from '../lib/format'

type Props = {
  open: boolean
  party: Contact | null
  resource: 'customers' | 'suppliers'
  onClose: () => void
  onBalanceChanged: () => void
}

export function LedgerDialog({ open, party, resource, onClose, onBalanceChanged }: Props) {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const partyKey = resource === 'customers' ? 'customerId' : 'supplierId'

  useEffect(() => {
    if (!open || !party) return
    setError(null)
    loadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, party])

  async function loadHistory() {
    if (!party) return
    setLoading(true)
    const res = await apiFetch(`/payments?${partyKey}=${party.id}`)
    const body = await res.json()
    setPayments(body.payments ?? [])
    setLoading(false)
  }

  if (!open || !party) return null

  async function handleRecordPayment(e: FormEvent) {
    e.preventDefault()
    const amt = Number(amount)
    if (!amt) return
    setSubmitting(true)
    setError(null)
    const res = await apiFetch('/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [partyKey]: party!.id, amount: amt, method, note: note || undefined }),
    })
    setSubmitting(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? `Failed (HTTP ${res.status})`)
      return
    }
    setAmount('')
    setNote('')
    await loadHistory()
    onBalanceChanged()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box ledger-box" onClick={(e) => e.stopPropagation()}>
        <h3>Ledger — {party.name}</h3>
        <p className="ledger-balance">Current balance: {formatMoney(party.ledgerBalance)}</p>

        {loading ? (
          <p>Loading…</p>
        ) : payments.length === 0 ? (
          <p>No payments recorded yet.</p>
        ) : (
          <ul className="ledger-history">
            {payments.map((p) => (
              <li key={p.id}>
                {new Date(p.paymentDate).toLocaleDateString()} — {formatMoney(p.amount)}
                {p.method ? ` (${p.method})` : ''}
                {p.note ? ` — ${p.note}` : ''}
              </li>
            ))}
          </ul>
        )}

        <form className="ledger-payment-form" onSubmit={handleRecordPayment}>
          <input
            placeholder="Amount"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
            <option value="cheque">Cheque</option>
            <option value="other">Other</option>
          </select>
          <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Record payment'}
          </button>
        </form>
        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="modal-cancel" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
