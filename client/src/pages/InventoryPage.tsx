import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch } from '../lib/api'
import type { InventoryItem } from '../lib/types'

type Props = {
  canManage: boolean
  canDelete: boolean
}

export function InventoryPage({ canManage, canDelete }: Props) {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [category, setCategory] = useState('')
  const [subCategory, setSubCategory] = useState('')
  const [description, setDescription] = useState('')
  const [size, setSize] = useState('')
  const [rate, setRate] = useState('')
  const [adding, setAdding] = useState(false)

  async function load() {
    setLoading(true)
    const res = await apiFetch('/inventory')
    const body = await res.json()
    setItems(body.items ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!category.trim() || !description.trim()) return
    setAdding(true)
    setError(null)
    const res = await apiFetch('/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: category.trim(),
        subCategory: subCategory || undefined,
        description: description.trim(),
        size: size || undefined,
        defaultRatePerSqft: rate ? Number(rate) : undefined,
      }),
    })
    setAdding(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? `Failed to add (HTTP ${res.status})`)
      return
    }
    setCategory('')
    setSubCategory('')
    setDescription('')
    setSize('')
    setRate('')
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this item?')) return
    const res = await apiFetch(`/inventory/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      alert(body.error ?? `Failed to delete (HTTP ${res.status})`)
      return
    }
    load()
  }

  return (
    <div className="resource-page">
      <h2>Inventory</h2>

      {canManage && (
        <form className="quick-add-form" onSubmit={handleAdd}>
          <input placeholder="Category *" value={category} onChange={(e) => setCategory(e.target.value)} required />
          <input placeholder="Sub-category" value={subCategory} onChange={(e) => setSubCategory(e.target.value)} />
          <input
            placeholder="Description *"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
          <input placeholder="Size" value={size} onChange={(e) => setSize(e.target.value)} />
          <input
            placeholder="Rate/Sq.ft"
            type="number"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
          <button type="submit" disabled={adding}>
            {adding ? 'Adding…' : 'Add'}
          </button>
        </form>
      )}
      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <p>No inventory items yet.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Sub-category</th>
              <th>Description</th>
              <th>Size</th>
              <th>Unit</th>
              <th>Rate/Sq.ft</th>
              <th>Qty on hand</th>
              {canDelete && <th></th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.category}</td>
                <td>{item.subCategory ?? ''}</td>
                <td>{item.description}</td>
                <td>{item.size ?? ''}</td>
                <td>{item.unit}</td>
                <td>{item.defaultRatePerSqft ?? ''}</td>
                <td>{item.qtyOnHand}</td>
                {canDelete && (
                  <td>
                    <button type="button" className="link-button" onClick={() => handleDelete(item.id)}>
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
