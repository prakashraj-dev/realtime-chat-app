export default function MessageBubble({ message, myId }) {
  if (message.type === "system") {
    return <div className="system">{message.text}</div>;
  }

  // Compare stable userIds (not names, not socket.id which changes on reconnect)
  const mine = message.senderId === myId;

  return (
    <div className={`bubble ${mine ? "mine" : "theirs"}`}>
      {!mine && <div className="sender">{message.sender}</div>}
      <div>{message.text}</div>

      <div className="meta">
        <span>{message.time}</span>
        {mine && message.status === "sending" && <span title="Sending">🕓</span>}
        {mine && message.status === "sent" && <span title="Delivered to server">✓</span>}
        {mine && message.status === "failed" && <span className="failed">Failed to send</span>}
      </div>
    </div>
  );
}