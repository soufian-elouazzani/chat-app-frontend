/**
 * Simple API client for the chat backend.
 *
 * Dev with Vite proxy:  VITE_API_URL=          (empty → same origin, proxied)
 * Direct to backend:      VITE_API_URL=http://localhost:8000
 */
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

function getToken() {
  return localStorage.getItem('token')
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  const token = getToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || error.message || `Request failed (${response.status})`)
  }

  if (response.status === 204) return null
  return response.json()
}

// --- Auth ---

export function register(username, password) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function login(username, password) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

// --- Sessions ---

export function getSessions() {
  return request('/sessions')
}

export function createSession(title) {
  return request('/sessions', {
    method: 'POST',
    body: JSON.stringify({ title: title || 'New chat' }),
  })
}

export function getMessages(sessionId) {
  return request(`/sessions/${sessionId}/messages`)
}

export function sendMessage(sessionId, prompt, model) {
  return request(`/sessions/${sessionId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ prompt, model }),
  })
}

// --- Tasks (async AI responses) ---

export function getTaskStatus(taskId) {
  return request(`/tasks/${taskId}/status`)
}

/** Poll until the task completes or fails. */
export async function waitForTask(taskId, intervalMs = 1500) {
  while (true) {
    const task = await getTaskStatus(taskId)

    if (task.status === 'completed') {
      return task.result
    }
    if (task.status === 'failed') {
      throw new Error(task.error || 'Task failed')
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

// --- Admin ---

export function getModels() {
  return request('/models')
}
