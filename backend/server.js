const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const registerSocketHandlers = require("./src/socketHandler");

const DEFAULT_ORIGIN = "http://localhost:5173";

// CLIENT_URL can hold several sites, separated by commas: "https://a.com,https://b.com"
function parseOrigins(value) {
  return String(value || DEFAULT_ORIGIN)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Builds the server WITHOUT starting it (so it can be started on any port, or tested)
function createChatServer({ clientUrl = DEFAULT_ORIGIN } = {}) {
  const allowed = parseOrigins(clientUrl);
  const allowAll = allowed.includes("*");

  const app = express();
  app.disable("x-powered-by");
  app.get("/health", (req, res) => res.json({ status: "ok" }));

  const httpServer = http.createServer(app);

  const io = new Server(httpServer, {
    cors: { origin: allowAll ? "*" : allowed },
    maxHttpBufferSize: 1e5, // 100 KB per message: bigger payloads drop the connection

    // CORS does not protect WebSockets, so we check the Origin ourselves.
    // Browsers always send it, so other websites cannot open a socket as your users.
    // Tools without an Origin header (curl, server-to-server) are still allowed.
    allowRequest: (req, callback) => {
      const origin = req.headers.origin;
      callback(null, allowAll || !origin || allowed.includes(origin));
    },
  });

  registerSocketHandlers(io);
  return { app, httpServer, io };
}

module.exports = { createChatServer };

// ---------- Start the server (only when run with `npm start`, not when imported) ----------
if (require.main === module) {
  const PORT = Number(process.env.PORT) || 8080;
  const { httpServer, io } = createChatServer({ clientUrl: process.env.CLIENT_URL });

  httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Safety nets: log problems instead of dying silently
  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled promise rejection:", reason);
  });
  process.on("uncaughtException", (err) => {
    console.error("Uncaught exception:", err);
    process.exit(1); // state may be corrupt: exit and let a process manager restart us
  });

  // Graceful shutdown (Ctrl+C or a deploy), with a 10s deadline so it can never hang
  let shuttingDown = false;
  function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("Shutting down...");
    setTimeout(() => process.exit(1), 10000).unref();
    io.close(() => process.exit(0));
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}