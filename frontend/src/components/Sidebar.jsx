import { ROOMS } from "../constants";

export default function Sidebar({ room, users, myId, onChangeRoom }) {
  return (
    <aside className="sidebar">
      <div className="rooms">
        <h3>Rooms</h3>
        {ROOMS.map((r) => (
          <button
            key={r.id}
            className={`room-btn ${r.id === room ? "active" : ""}`}
            onClick={() => onChangeRoom(r.id)}
          >
            # {r.label}
          </button>
        ))}
      </div>

      <div className="online">
        <h3>Online ({users.length})</h3>
        {users.map((u) => (
          <div key={u.id} className="user">
            <span className="dot" />
            {u.name}{u.id === myId ? " (you)" : ""}
          </div>
        ))}
      </div>
    </aside>
  );
}