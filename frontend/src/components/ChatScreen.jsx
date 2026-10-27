import { useEffect, useRef, useState } from "react";
import Sidebar from "./Sidebar";
import MessageBubble from "./MessageBubble";
import useTyping from "../hooks/useTyping";

function typingText(names) {
  if (names.length === 1) return `${names[0]} is typing`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing`;
  return "Several people are typing";
}

export default function ChatScreen({
  name, room, myId, messages, users, typing, connected,
  onSend, onTyping, onChangeRoom,
}) {
  const [text, setText] = useState("");
  const bottomRef = useRef(null);
  const { handleKeystroke, stopTyping } = useTyping(onTyping, 1500);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleChange(e) {
    const value = e.target.value;
    setText(value);

    // Empty input = stopped typing immediately; otherwise (re)start the debounce
    if (value.trim() === "") stopTyping();
    else handleKeystroke();
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim() || !connected) return;

    stopTyping(); // sending a message ends the typing state immediately
    onSend(text.trim());
    setText("");
  }

  const someoneTyping = typing.length > 0;

  return (
    <div className="app">
      <Sidebar room={room} users={users} myId={myId} onChangeRoom={onChangeRoom} />

      <main className="chat">
        <header>
          <div className="header-info">
            <strong># {room}</strong>
            {/* Top of the chat: shows who is typing, otherwise the online count */}
            <span className={`header-sub ${someoneTyping ? "is-typing" : ""}`}>
              {someoneTyping ? (
                <>
                  {typingText(typing.map((u) => u.name))}
                  <span className="dots"><i /><i /><i /></span>
                </>
              ) : (
                `${users.length} online`
              )}
            </span>
          </div>
          <span className="me">you are {name}</span>
        </header>

        {!connected && <div className="banner">Connection lost. Reconnecting…</div>}

        <div className="messages">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} myId={myId} />
          ))}
          <div ref={bottomRef} />
        </div>

        <form className="composer" onSubmit={handleSubmit}>
          <input
            placeholder={connected ? "Type a message" : "Waiting for connection…"}
            value={text}
            onChange={handleChange}
            disabled={!connected}
            maxLength={500}
          />
          <button type="submit" disabled={!connected}>Send</button>
        </form>
      </main>
    </div>
  );
}