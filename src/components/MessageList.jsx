export default function MessageList({ messages, isLoading }) {
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="chat-empty">
        <h2>How can I help you today?</h2>
        <p>Send a message to start the conversation.</p>
      </div>
    )
  }

  return (
    <div className="message-list">
      {messages.map((msg) => (
        <div key={msg.message_id || msg.id} className={`message message-${msg.role}`}>
          <div className="message-avatar">{msg.role === 'user' ? 'You' : 'AI'}</div>
          <div className="message-content">{msg.content}</div>
        </div>
      ))}
      {isLoading && (
        <div className="message message-assistant">
          <div className="message-avatar">AI</div>
          <div className="message-content typing">Thinking...</div>
        </div>
      )}
    </div>
  )
}
