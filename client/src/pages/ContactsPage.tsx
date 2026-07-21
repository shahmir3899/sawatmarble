import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch } from '../lib/api'
import type { Contact } from '../lib/types'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { LedgerDialog } from '../components/LedgerDialog'

type Props = {
  resource: 'customers' | 'suppliers'
  title: string
  canManage: boolean
  canEditBalance: boolean
}

type EditableField = 'name' | 'phone' | 'address' | 'ledgerBalance'

export function ContactsPage({ resource, title, canManage, canEditBalance }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [adding, setAdding] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Contact | null>(null)
  const [ledgerParty, setLedgerParty] = useState<Contact | null>(null)

  async function load() {
    setLoading(true)
    const res = await apiFetch(`/${resource}`)
    const body = await res.json()
    setContacts(body[resource] ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    setError(null)
    const res = await apiFetch(`/${resource}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName.trim(),
        phone: newPhone || undefined,
        address: newAddress || undefined,
      }),
    })
    setAdding(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? `Failed to add (HTTP ${res.status})`)
      return
    }
    setNewName('')
    setNewPhone('')
    setNewAddress('')
    load()
  }

  async function handleFieldSave(id: string, field: EditableField, value: string) {
    setError(null)
    const res = await apiFetch(`/${resource}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: field === 'ledgerBalance' ? Number(value) : value }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? `Failed to save (HTTP ${res.status})`)
    }
    load()
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    const id = pendingDelete.id
    setPendingDelete(null)
    const res = await apiFetch(`/${resource}/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? `Failed to remove (HTTP ${res.status})`)
      return
    }
    load()
  }

  return (
    <div className="resource-page">
      <h2>{title}</h2>

      {canManage && (
        <form className="quick-add-form" onSubmit={handleAdd}>
          <input placeholder="Name *" value={newName} onChange={(e) => setNewName(e.target.value)} required />
          <input placeholder="Phone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
          <input placeholder="Address" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} />
          <button type="submit" disabled={adding}>
            {adding ? 'Adding…' : 'Add'}
          </button>
        </form>
      )}
      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p>Loading…</p>
      ) : contacts.length === 0 ? (
        <p>No {title.toLowerCase()} yet.</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Address</th>
                <th>Balance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <ContactRow
                  key={c.id}
                  contact={c}
                  canManage={canManage}
                  canEditBalance={canEditBalance}
                  onSave={handleFieldSave}
                  onDelete={() => setPendingDelete(c)}
                  onOpenLedger={() => setLedgerParty(c)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        message={`Remove "${pendingDelete?.name}"? This can't be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <LedgerDialog
        open={ledgerParty !== null}
        party={ledgerParty}
        resource={resource}
        onClose={() => setLedgerParty(null)}
        onBalanceChanged={load}
      />
    </div>
  )
}

function ContactRow({
  contact,
  canManage,
  canEditBalance,
  onSave,
  onDelete,
  onOpenLedger,
}: {
  contact: Contact
  canManage: boolean
  canEditBalance: boolean
  onSave: (id: string, field: EditableField, value: string) => void
  onDelete: (id: string) => void
  onOpenLedger: () => void
}) {
  const [name, setName] = useState(contact.name)
  const [phone, setPhone] = useState(contact.phone ?? '')
  const [address, setAddress] = useState(contact.address ?? '')
  const [balance, setBalance] = useState(contact.ledgerBalance)

  return (
    <tr>
      <td>
        <input
          value={name}
          disabled={!canManage}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== contact.name && onSave(contact.id, 'name', name)}
        />
      </td>
      <td>
        <input
          value={phone}
          disabled={!canManage}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={() => phone !== (contact.phone ?? '') && onSave(contact.id, 'phone', phone)}
        />
      </td>
      <td>
        <input
          value={address}
          disabled={!canManage}
          onChange={(e) => setAddress(e.target.value)}
          onBlur={() => address !== (contact.address ?? '') && onSave(contact.id, 'address', address)}
        />
      </td>
      <td>
        {canEditBalance ? (
          <input
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            onBlur={() => balance !== contact.ledgerBalance && onSave(contact.id, 'ledgerBalance', balance)}
          />
        ) : (
          contact.ledgerBalance
        )}
      </td>
      <td className="row-actions">
        <button type="button" className="link-button" onClick={onOpenLedger}>
          Ledger
        </button>
        {canManage && (
          <button type="button" className="link-button" onClick={() => onDelete(contact.id)}>
            Remove
          </button>
        )}
      </td>
    </tr>
  )
}
