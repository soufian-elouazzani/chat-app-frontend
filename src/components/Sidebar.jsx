import { Link } from 'react-router-dom'

export default function Sidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onLogout,
  username,
  isAdmin,
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <button type="button" className="btn-new-chat" onClick={onNewChat}>
          + New chat
        </button>
      </div>

      <nav className="session-list">
        {sessions.length === 0 && (
          <p className="session-empty">No chats yet</p>
        )}
        {sessions.map((session) => (
          <button
            key={session.session_id}
            type="button"
            className={`session-item ${session.session_id === activeSessionId ? 'active' : ''}`}
            onClick={() => onSelectSession(session.session_id)}
          >
            {session.title || 'Untitled chat'}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span className="username">{username}</span>
        {isAdmin && (
          <Link to="/admin" className="sidebar-link">
            Models
          </Link>
        )}
        <button type="button" className="btn-logout" onClick={onLogout}>
          Log out
        </button>
      </div>
    </aside>
  )
}
