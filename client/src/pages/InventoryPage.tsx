import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch } from '../lib/api'
import type { InventoryItem } from '../lib/types'
import { ConfirmDialog } from '../components/ConfirmDialog'

type Props = {
  canManage: boolean
  canDelete: boolean
}

type TrackMode = 'sqft' | 'piece'

export function InventoryPage({ canManage, canDelete }: Props) {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<InventoryItem | null>(null)

  const [category, setCategory] = useState('')
  const [subCategory, setSubCategory] = useState('')
  const [description, setDescription] = useState('')
  const [trackMode, setTrackMode] = useState<TrackMode>('sqft')
  const [length, setLength] = useState('')
  const [width, setWidth] = useState('')
  const [qty, setQty] = useState('')
  const [rate, setRate] = useState('')
  const [reorderLevel, setReorderLevel] = useState('')
  const [adding, setAdding] = useState(false)

  const lengthNum = Number(length) || 0
  const widthNum = Number(width) || 0
  const qtyNum = Number(qty) || 0
  const sqftPerPiece = lengthNum * widthNum
  const totalSqft = sqftPerPiece * qtyNum

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

    const qtyOnHand = trackMode === 'sqft' ? totalSqft : qtyNum
    const size = trackMode === 'sqft' && lengthNum && widthNum ? `${lengthNum} x ${widthNum} ft` : undefined

    const res = await apiFetch('/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: category.trim(),
        subCategory: subCategory || undefined,
        description: description.trim(),
        size,
        unit: trackMode,
        defaultRatePerSqft: rate ? Number(rate) : undefined,
        qtyOnHand,
        reorderLevel: reorderLevel ? Number(reorderLevel) : undefined,
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
    setLength('')
    setWidth('')
    setQty('')
    setRate('')
    setReorderLevel('')
    load()
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    const id = pendingDelete.id
    setPendingDelete(null)
    const res = await apiFetch(`/inventory/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? `Failed to delete (HTTP ${res.status})`)
      return
    }
    load()
  }

  return (
    <div className="resource-page">
      <h2>Inventory</h2>

      {canManage && (
        <form className="quick-add-form-block" onSubmit={handleAdd}>
          <div className="quick-add-form">
            <input placeholder="Category *" value={category} onChange={(e) => setCategory(e.target.value)} required />
            <input placeholder="Sub-category" value={subCategory} onChange={(e) => setSubCategory(e.target.value)} />
            <input
              placeholder="Description *"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
            <input placeholder="Rate/Sq.ft" type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
            <input
              placeholder="Reorder level (optional)"
              type="number"
              step="0.01"
              value={reorderLevel}
              onChange={(e) => setReorderLevel(e.target.value)}
            />
          </div>

          <div className="unit-toggle">
            <label>
              <input
                type="radio"
                checked={trackMode === 'sqft'}
                onChange={() => setTrackMode('sqft')}
              />
              Track by square feet (slabs/tiles)
            </label>
            <label>
              <input
                type="radio"
                checked={trackMode === 'piece'}
                onChange={() => setTrackMode('piece')}
              />
              Track by piece count (e.g. patti/border strips)
            </label>
          </div>

          {trackMode === 'sqft' ? (
            <div className="calc-row">
              <input placeholder="Length (ft)" type="number" step="0.01" value={length} onChange={(e) => setLength(e.target.value)} />
              <span>×</span>
              <input placeholder="Width (ft)" type="number" step="0.01" value={width} onChange={(e) => setWidth(e.target.value)} />
              <span className="calc-readout">{sqftPerPiece.toFixed(2)} sqft/piece</span>
              <span>×</span>
              <input placeholder="Qty (pieces)" type="number" step="1" value={qty} onChange={(e) => setQty(e.target.value)} />
              <span className="calc-readout">= {totalSqft.toFixed(2)} total sqft</span>
            </div>
          ) : (
            <div className="calc-row">
              <input placeholder="Qty (pieces)" type="number" step="1" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
          )}

          <button type="submit" disabled={adding}>
            {adding ? 'Adding…' : 'Add item'}
          </button>
        </form>
      )}
      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <p>No inventory items yet.</p>
      ) : (
        <div className="table-scroll">
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
                <th>Reorder level</th>
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
                  <td>{item.reorderLevel ?? ''}</td>
                  {canDelete && (
                    <td>
                      <button type="button" className="link-button" onClick={() => setPendingDelete(item)}>
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        message={`Remove "${pendingDelete?.description}"? This can't be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
