import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import type { ActivityEntry, DashboardData } from '../lib/types'
import { formatMoney } from '../lib/format'

const ACTIVITY_LABELS: Record<ActivityEntry['type'], string> = {
  receipt: 'Invoice',
  quotation: 'Quotation',
  challan: 'Challan',
  payment: 'Payment',
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    const res = await apiFetch('/dashboard')
    if (!res.ok) {
      setError(`Failed to load dashboard (HTTP ${res.status})`)
      setLoading(false)
      return
    }
    const body = await res.json()
    setData(body)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="resource-page">
        <h2>Dashboard</h2>
        <p>Loading…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="resource-page">
        <h2>Dashboard</h2>
        <p className="form-error">{error ?? 'Failed to load dashboard'}</p>
      </div>
    )
  }

  const lowStockCount = data.lowStockItems.length

  return (
    <div className="resource-page">
      <h2>Dashboard</h2>

      <div className="kpi-row">
        <div className="kpi-tile">
          <span className="kpi-label">Today's Sales</span>
          <span className="kpi-value">Rs {formatMoney(data.todaysSales)}</span>
        </div>
        <div className="kpi-tile">
          <span className="kpi-label">Outstanding Receivables</span>
          <span className="kpi-value">Rs {formatMoney(data.outstandingReceivables)}</span>
        </div>
        <div className={`kpi-tile ${lowStockCount > 0 ? 'kpi-warning' : ''}`}>
          <span className="kpi-label">{lowStockCount > 0 ? '⚠ Low Stock Items' : 'Low Stock Items'}</span>
          <span className="kpi-value">{lowStockCount}</span>
        </div>
      </div>

      <h2>Low Stock</h2>
      {lowStockCount === 0 ? (
        <p>Nothing below its reorder level.</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Description</th>
                <th>Qty on hand</th>
                <th>Reorder level</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              {data.lowStockItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.category}</td>
                  <td>{item.description}</td>
                  <td className="kpi-warning-text">{item.qtyOnHand}</td>
                  <td>{item.reorderLevel}</td>
                  <td>{item.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Recent Activity</h2>
      {data.recentActivity.length === 0 ? (
        <p>Nothing recorded yet.</p>
      ) : (
        <ul className="activity-feed">
          {data.recentActivity.map((entry) => (
            <li key={`${entry.type}-${entry.id}`}>
              <span className="activity-type">{ACTIVITY_LABELS[entry.type]}</span>
              <span className="activity-label">{entry.label}</span>
              {entry.amount !== null && <span className="activity-amount">Rs {formatMoney(entry.amount)}</span>}
              <span className="activity-date">{new Date(entry.createdAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
