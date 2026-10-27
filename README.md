# Real-Time Chat App (Socket.IO + React)

A WhatsApp-style group chat with rooms, typing indicators, and delivery confirmation.

## Features
- Chat rooms (General, Tech, Random)
- Real-time messaging with Socket.IO
- Debounced "is typing" indicator in the chat header
- Delivery status on each message (sending, sent, failed)
- Automatic reconnect with automatic room rejoin
- Online users list per room
- Server protection: input validation, rate limiting, WebSocket origin check, crash-safe handlers

## Tech Stack
- **Backend:** Node.js, Express, Socket.IO
- **Frontend:** React 18, Vite, socket.io-client

## Requirements
Node.js 22.23.4 or newer.

## Run locally

Backend:
```bash
cd backend
npm install
npm start
```

Frontend (in a second terminal):
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in two browser tabs, join the same room with different names, and chat.

## Project structure
```
backend/
  server.js              Express + Socket.IO server setup
  src/socketHandler.js   Event handlers, validation, rate limiting
frontend/
  src/App.jsx            State and socket listeners
  src/components/        JoinScreen, Sidebar, ChatScreen, MessageBubble
  src/hooks/useTyping.js Debounced typing indicator
  src/socket.js          Socket connection and stable user id
```

## How it works
1. The client connects with Socket.IO and joins a room.
2. Messages are sent with `emit` and an acknowledgement callback, so the sender sees sending, then sent or failed.
3. The server sends each message to everyone else in the room with `socket.to(room).emit`.
4. The typing indicator emits once on the first keystroke and stops after 1.5 seconds of silence (debounce).
5. If the connection drops, Socket.IO reconnects and the app rejoins its room.

## Deployment settings
- **Backend:** set `CLIENT_URL` to your site (for example `https://chat.example.com`, several allowed, separated by commas) and optionally `PORT`.
- **Frontend:** set `VITE_SERVER_URL` at build time only if the server is on a different domain.
- Serve over HTTPS and run a single server instance.

## Limitations
- No login: names are self-declared.
- No database: message history is lost on refresh or restart.
- Single server only (multiple servers would need the Redis adapter).
