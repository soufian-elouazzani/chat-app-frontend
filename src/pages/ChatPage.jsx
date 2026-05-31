import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'
import MessageList from '../components/MessageList'
import MessageInput from '../components/MessageInput'
import {
  getSessions,
  createSession,
  getMessages,
  sendMessage,
  waitForTask,
} from '../api/client'

const DEFAULT_MODEL = 'llama3'

export default function ChatPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [sessions, setSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef(null)

  // Load sessions on mount
  useEffect(() => {
    async function load() {
      try {
        const data = await getSessions()
        setSessions(data)
        if (data.length > 0) {
          setActiveSessionId((current) => current ?? data[0].session_id)
        }
      } catch (err) {
        setError(err.message)
      }
    }
    load()
  }, [])

  // Load messages when active session changes
  useEffect(() => {
    if (!activeSessionId) return

    async function load() {
      try {
        setError('')
        const data = await getMessages(activeSessionId)
        setMessages(data)
      } catch (err) {
        setError(err.message)
      }
    }
    load()
  }, [activeSessionId])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  async function loadSessions() {
    try {
      const data = await getSessions()
      setSessions(data)
      if (data.length > 0 && !activeSessionId) {
        setActiveSessionId(data[0].session_id)
      }
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleNewChat() {
    try {
      setError('')
      const session = await createSession('New chat')
      setSessions((prev) => [session, ...prev])
      setActiveSessionId(session.session_id)
      setMessages([])
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleSend(prompt) {
    let sessionId = activeSessionId

    if (!sessionId) {
      try {
        const session = await createSession('New chat')
        setSessions((prev) => [session, ...prev])
        setActiveSessionId(session.session_id)
        sessionId = session.session_id
        setMessages([])
      } catch (err) {
        setError(err.message)
        return
      }
    }

    await sendAndPoll(sessionId, prompt)
  }

  async function sendAndPoll(sessionId, prompt) {
    const tempId = `temp-${Date.now()}`
    const userMessage = {
      message_id: tempId,
      role: 'user',
      content: prompt,
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)
    setError('')

    try {
      const { task_id } = await sendMessage(sessionId, prompt, DEFAULT_MODEL)
      const result = await waitForTask(task_id)

      const assistantMessage = {
        message_id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result,
      }
      setMessages((prev) => [...prev, assistantMessage])

      // Refresh sessions to update titles/order
      loadSessions()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="chat-layout">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onNewChat={handleNewChat}
        onLogout={handleLogout}
        username={user?.username}
        isAdmin={user?.is_admin}
      />

      <main className="chat-main">
        {error && <div className="chat-error">{error}</div>}

        <div className="chat-messages">
          <MessageList messages={messages} isLoading={isLoading} />
          <div ref={messagesEndRef} />
        </div>

        <MessageInput onSend={handleSend} disabled={isLoading} />
      </main>
    </div>
  )
}
