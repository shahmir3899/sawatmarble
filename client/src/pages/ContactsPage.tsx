import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch } from '../lib/api'
import type { Contact } from '../lib/types'

type Props = {
  resource: 'customers' | 'suppliers'
  title: string
  canManage: boolean
}

export function ContactsPage({ resource, title, canManage }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [adding, setAdding] = useState(false)

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

  async function handleFieldSave(id: string, field: 'name' | 'phone' | 'address', value: string) {
    await apiFetch(`/${resource}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this record?')) return
    const res = await apiFetch(`/${resource}/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      alert(body.error ?? `Failed to delete (HTTP ${res.status})`)
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
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Address</th>
              <th>Balance</th>
              {canManage && <th></th>}
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <ContactRow
                key={c.id}
                contact={c}
                canManage={canManage}
                onSave={handleFieldSave}
                onDelete={handleDelete}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function ContactRow({
  contact,
  canManage,
  onSave,
  onDelete,
}: {
  contact: Contact
  canManage: boolean
  onSave: (id: string, field: 'name' | 'phone' | 'address', value: string) => void
  onDelete: (id: string) => void
}) {
  const [name, setName] = useState(contact.name)
  const [phone, setPhone] = useState(contact.phone ?? '')
  const [address, setAddress] = useState(contact.address ?? '')

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
      <td>{contact.ledgerBalance}</td>
      {canManage && (
        <td>
          <button type="button" className="link-button" onClick={() => onDelete(contact.id)}>
            Remove
          </button>
        </td>
      )}
    </tr>
  )
}
