import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getModels } from '../api/client'

export default function AdminPage() {
  const [models, setModels] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadModels()
  }, [])

  async function loadModels() {
    try {
      setLoading(true)
      const data = await getModels()
      setModels(Array.isArray(data) ? data : data.models || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <Link to="/" className="back-link">
          ← Back to chat
        </Link>
        <h1>Ollama Models</h1>
        <p>Available models on the backend</p>
      </header>

      {loading && <p className="admin-status">Loading models...</p>}
      {error && <p className="admin-error">{error}</p>}

      {!loading && !error && models.length === 0 && (
        <p className="admin-status">No models found.</p>
      )}

      <ul className="model-list">
        {models.map((model) => {
          const name = typeof model === 'string' ? model : model.name || model.model_name
          return (
            <li key={name} className="model-item">
              <span className="model-name">{name}</span>
              {model.size && <span className="model-meta">{model.size}</span>}
            </li>
          )
        })}
      </ul>

      <button type="button" className="btn-refresh" onClick={loadModels}>
        Refresh
      </button>
    </div>
  )
}
