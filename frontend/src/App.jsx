// App owns all state and ALL socket listeners. Child components only display things.
import { useEffect, useRef, useState } from "react";
import { socket, getUserId, makeId } from "./socket";
import JoinScreen from "./components/JoinScreen";
import ChatScreen from "./components/ChatScreen";

const userId = getUserId();

// Keep at most this many messages in memory, so a long session cannot slow the page down
const MAX_MESSAGES = 500;
const capped = (list) => (list.length > MAX_MESSAGES ? list.slice(-MAX_MESSAGES) : list);

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Ask the server to put us in a room. The callback is the acknowledgement.
function joinRoom(name, room) {
  socket.emit("join_room", { name, room, userId }, (res) => {
    if (!res?.ok) alert(res?.error || "Could not join the room");
  });
}

export default function App() {
  const [joined, setJoined] = useState(false);
  const [name, setName] = useState("");
  const [room, setRoom] = useState("general");
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [typing, setTyping] = useState([]);       // [{ userId, name }] of people typing
  const [connected, setConnected] = useState(false);

  // Latest name/room for the "connect" handler (a ref never goes stale)
  const session = useRef({ name: "", room: "general" });

  // ---------- Register all socket listeners once ----------
  useEffect(() => {
    // Fires on the FIRST connection and on every RECONNECTION.
    // The server forgets us when we drop, so we rejoin our room here.
    const onConnect = () => {
      setConnected(true);
      if (session.current.name) joinRoom(session.current.name, session.current.room);
    };

    const onDisconnect = () => {
      setConnected(false);
      setTyping([]);
    };

    // A message from someone else: also clear their "typing" status right away
    const onMessage = (msg) => {
      setMessages((prev) => capped([...prev, msg]));
      setTyping((prev) => prev.filter((u) => u.userId !== msg.senderId));
    };

    // "X joined" / "X left" notices
    const onSystem = ({ text }) =>
      setMessages((prev) => capped([...prev, { id: makeId(), type: "system", text }]));

    const onRoomUsers = (list) => setUsers(list);

    // Track typing users by userId (names aren't unique)
    const onTyping = ({ userId: uid, name: who, isTyping }) =>
      setTyping((prev) => {
        const others = prev.filter((u) => u.userId !== uid);
        return isTyping ? [...others, { userId: uid, name: who }] : others;
      });

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("message", onMessage);
    socket.on("system", onSystem);
    socket.on("room_users", onRoomUsers);
    socket.on("typing", onTyping);

    // Cleanup: remove listeners and close the connection
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("message", onMessage);
      socket.off("system", onSystem);
      socket.off("room_users", onRoomUsers);
      socket.off("typing", onTyping);
      socket.disconnect();
    };
  }, []);

  // ---------- Actions ----------
  function handleJoin(chosenName, chosenRoom) {
    session.current = { name: chosenName, room: chosenRoom };
    setName(chosenName);
    setRoom(chosenRoom);
    setJoined(true);
    socket.connect(); // the "connect" event above then joins the room
  }

  function handleChangeRoom(newRoom) {
    if (newRoom === room) return;
    session.current.room = newRoom;
    setRoom(newRoom);
    setMessages([]);
    setUsers([]);
    setTyping([]);
    joinRoom(session.current.name, newRoom);
  }

  function handleSend(text) {
    const tempId = makeId();

    // 1) Show the message immediately as "sending"
    setMessages((prev) =>
      capped([
        ...prev,
        { id: tempId, senderId: userId, sender: name, text, time: nowTime(), status: "sending" },
      ])
    );

    // 2) Emit with an acknowledgement callback and a 5 second timeout
    socket.timeout(5000).emit("send_message", { text }, (err, res) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== tempId) return m;
          if (err || !res?.ok) return { ...m, status: "failed" }; // timeout or rejected
          return { ...res.message, status: "sent" };             // server confirmed
        })
      );
    });
  }

  function handleTyping(isTyping) {
    socket.emit("typing", isTyping);
  }

  // ---------- Render ----------
  if (!joined) return <JoinScreen onJoin={handleJoin} />;

  return (
    <ChatScreen
      name={name}
      room={room}
      myId={userId}
      messages={messages}
      users={users}
      typing={typing}
      connected={connected}
      onSend={handleSend}
      onTyping={handleTyping}
      onChangeRoom={handleChangeRoom}
    />
  );
}