import { useState } from "react";
import { ROOMS } from "../constants";

export default function JoinScreen({ onJoin }) {
  const [name, setName] = useState("");
  const [room, setRoom] = useState(ROOMS[0].id);

  function handleSubmit(e) {
    e.preventDefault();
    if (name.trim()) onJoin(name.trim(), room);
  }

  return (
    <div className="join">
      <form onSubmit={handleSubmit}>
        <h2>Join the chat</h2>
        <input
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          autoFocus
        />
      <select value={room} onChange={(e) => setRoom(e.target.value)} aria-label="Room">
          {ROOMS.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
        <button type="submit">Join</button>
      </form>
    </div>
  );
}