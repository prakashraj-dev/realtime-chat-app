import { io } from "socket.io-client";

// Development: talk to the local server.
// Production: use the same site the page is served from (works behind a reverse proxy),
// or set VITE_SERVER_URL when building to point at a separate server.
const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.DEV ? "http://localhost:8080" : window.location.origin);

// One socket for the whole app. autoConnect:false means we connect
// only after the user clicks "Join". Auto-reconnect is ON by default.
export const socket = io(SERVER_URL, { autoConnect: false });

// crypto.randomUUID only exists on HTTPS or localhost. Without this fallback
// the whole app would crash on a plain-HTTP deployment.
export function makeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const STORAGE_KEY = "chat-user-id";
let memoryId = null;

// socket.id changes on every reconnect, so we also keep our own stable userId.
// sessionStorage = unique per browser tab, and survives a page refresh.
export function getUserId() {
  try {
    let id = sessionStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = makeId();
      sessionStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    // Storage can be blocked (privacy modes, embedded pages): keep the id in memory instead
    if (!memoryId) memoryId = makeId();
    return memoryId;
  }
}