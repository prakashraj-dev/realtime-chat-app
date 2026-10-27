const { randomUUID } = require("crypto");

// ---------- Settings ----------
const ROOMS = ["general", "tech", "random"];
const MAX_NAME_LENGTH = 20;
const MAX_MESSAGE_LENGTH = 500;
const MAX_USER_ID_LENGTH = 64;

const WINDOW_MS = 10000; // every limit below is "per 10 seconds, per connection"
const MESSAGE_LIMIT = 20;
const JOIN_LIMIT = 20;
const TYPING_LIMIT = 40;

// ---------- Helpers ----------
function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Never trust the client: check the TYPE of every field, not just its value.
function validateJoin(payload) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Invalid request" };
  }
  const { name, room, userId } = payload;

  if (typeof name !== "string" || !name.trim()) {
    return { ok: false, error: "Name is required" };
  }
  if (typeof userId !== "string" || !userId || userId.length > MAX_USER_ID_LENGTH) {
    return { ok: false, error: "Invalid user id" };
  }
  if (typeof room !== "string" || !ROOMS.includes(room)) {
    return { ok: false, error: "Invalid room" };
  }

  return {
    ok: true,
    value: { name: name.trim().slice(0, MAX_NAME_LENGTH), room, userId },
  };
}

function validateMessage(payload) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Invalid request" };
  }
  if (typeof payload.text !== "string") {
    return { ok: false, error: "Message must be text" };
  }
  const text = payload.text.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!text) return { ok: false, error: "Empty message" };

  return { ok: true, value: { text } };
}

function buildMessage({ text, room, name, userId }, now = new Date()) {
  return {
    id: randomUUID(),
    senderId: userId,
    sender: name,
    text,
    room,
    time: formatTime(now),
  };
}

// Sliding window: allow at most `limit` calls per `windowMs`.
function createRateLimiter(limit, windowMs, now = () => Date.now()) {
  let timestamps = [];
  return function allow() {
    const t = now();
    timestamps = timestamps.filter((x) => t - x < windowMs);
    if (timestamps.length >= limit) return false;
    timestamps.push(t);
    return true;
  };
}

// The LAST argument of a socket event is the acknowledgement callback (if the client sent one)
function getAck(args) {
  const last = args[args.length - 1];
  return typeof last === "function" ? last : () => {};
}

// Wrap an event handler so an unexpected error can NEVER crash the whole server.
function safeHandler(fn, label = "handler") {
  return async (...args) => {
    try {
      await fn(...args);
    } catch (err) {
      console.error(`[${label}] unexpected error:`, err);
      try {
        getAck(args)({ ok: false, error: "Server error" });
      } catch {
        /* ignore errors from the ack itself */
      }
    }
  };
}

// ---------- Room helpers ----------
// Send the updated list of people in a room to everyone in that room
async function broadcastUsers(io, room) {
  const sockets = await io.in(room).fetchSockets();
  const users = sockets.map((s) => ({ id: s.data.userId, name: s.data.name }));
  io.to(room).emit("room_users", users);
}

// Remove a socket from its current room and tell the others
async function leaveCurrentRoom(io, socket) {
  const { room, name, userId } = socket.data;
  if (!room) return;

  await socket.leave(room);
  socket.data.room = null;

  // Clear this user's "typing" status for everyone else in the room
  socket.to(room).emit("typing", { userId, name, isTyping: false });
  socket.to(room).emit("system", { text: `${name} left the room` });
  await broadcastUsers(io, room);
}

// ---------- Event handlers ----------
function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    // One limiter per connection, so one abusive user cannot affect others
    const allowMessage = createRateLimiter(MESSAGE_LIMIT, WINDOW_MS);
    const allowJoin = createRateLimiter(JOIN_LIMIT, WINDOW_MS);
    const allowTyping = createRateLimiter(TYPING_LIMIT, WINDOW_MS);

    // ---------- JOIN A ROOM ----------
    socket.on(
      "join_room",
      safeHandler(async (...args) => {
        const reply = getAck(args);
        if (!allowJoin()) return reply({ ok: false, error: "Too many requests, slow down" });

        const checked = validateJoin(args[0]);
        if (!checked.ok) return reply(checked);

        const { name, room, userId } = checked.value;

        // Already in this room (duplicate join): nothing to do
        if (socket.data.room === room) return reply({ ok: true, room });

        await leaveCurrentRoom(io, socket); // leave the old room first

        socket.data.name = name;
        socket.data.userId = userId;
        socket.data.room = room;

        await socket.join(room);

        socket.to(room).emit("system", { text: `${name} joined the room` });
        await broadcastUsers(io, room);

        reply({ ok: true, room });
      }, "join_room")
    );

    // ---------- SEND A MESSAGE ----------
    socket.on(
      "send_message",
      safeHandler((...args) => {
        const reply = getAck(args);
        const { room, name, userId } = socket.data;

        if (!room) return reply({ ok: false, error: "Join a room first" });
        if (!allowMessage()) return reply({ ok: false, error: "Too many messages, slow down" });

        const checked = validateMessage(args[0]);
        if (!checked.ok) return reply(checked);

        const message = buildMessage({ text: checked.value.text, room, name, userId });

        socket.to(room).emit("message", message); // everyone in the room EXCEPT the sender
        reply({ ok: true, message });             // the sender gets it through the acknowledgement
      }, "send_message")
    );

    // ---------- TYPING INDICATOR ----------
    // Rate-limited too: every typing event is copied to the whole room,
    // so an unlimited flood would multiply into a lot of traffic.
    socket.on(
      "typing",
      safeHandler((isTyping) => {
        const { room, name, userId } = socket.data;
        if (!room || !allowTyping()) return; // silently ignore
        socket.to(room).emit("typing", { userId, name, isTyping: isTyping === true });
      }, "typing")
    );

    // ---------- DISCONNECT ----------
    socket.on(
      "disconnect",
      safeHandler(async () => {
        await leaveCurrentRoom(io, socket);
      }, "disconnect")
    );
  });
}

module.exports = registerSocketHandlers;
module.exports.helpers = {
  ROOMS,
  validateJoin,
  validateMessage,
  buildMessage,
  createRateLimiter,
  getAck,
  safeHandler,
};