// End-to-end smoke test for the reconstructed server (HTTP + Socket.IO).
// Usage: node scripts/smoke-test.mjs [baseUrl] (default http://localhost:3199)
import { io } from "socket.io-client";

const BASE = process.argv[2] || "http://localhost:3199";
const results = [];
const ok = (name, cond, extra = "") => {
  results.push({ name, pass: !!cond, extra });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  → " + extra}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let cookie = "";
async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.getSetCookie?.() || [];
  if (setCookie.length) cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* plain */ }
  return { status: res.status, json, text };
}

function connectSocket() {
  return new Promise((resolve, reject) => {
    const socket = io(BASE, {
      transports: ["websocket", "polling"],
      extraHeaders: cookie ? { Cookie: cookie } : {},
      reconnection: false,
    });
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", (err) => reject(err));
    setTimeout(() => reject(new Error("socket connect timeout")), 8000);
  });
}

// ---------- 1. HTTP flow ----------
const health = await api("/healthz");
ok("healthz 200", health.status === 200);

const login = await api("/auth/login", { method: "POST", body: { username: "Admin", password: "Admin@789" } });
ok("login with default password", login.status === 200, `status=${login.status}`);

const me = await api("/api/users/me");
ok("users/me exposes mustChangePassword=true", me.json?.mustChangePassword === true, JSON.stringify(me.json));

const blocked = await api("/api/chat/getMessages", { method: "POST", body: { limit: 20, lastId: null } });
ok("API blocked until password change (403)", blocked.status === 403 && blocked.json?.code === "password_change_required", `status=${blocked.status} body=${blocked.text}`);

const wrongPw = await api("/api/changePassword", { method: "POST", body: { currentPassword: "WRONG", password: "NewPass@123" } });
ok("wrong current password rejected", wrongPw.status === 400, `status=${wrongPw.status}`);

const changed = await api("/api/changePassword", { method: "POST", body: { currentPassword: "Admin@789", password: "NewPass@123" } });
ok("password change with current password", changed.status === 200 && changed.json?.mustChangePassword === false, `status=${changed.status} body=${changed.text}`);

const me2 = await api("/api/users/me");
ok("users/me mustChangePassword=false after change", me2.json?.mustChangePassword === false, JSON.stringify(me2.json));
ok("users/me has no password hash", !("password" in (me2.json || {})));

// ---------- 2. sockets ----------
const socket = await connectSocket().catch((e) => { ok("socket connect", false, e.message); return null; });
if (socket) {
  ok("socket connect authenticated", socket.connected);

  // chat message with HTML: script stripped, b/style kept
  const ack = await new Promise((resolve) => socket.emit("chatMessage", { text: 'hello <script>alert(1)</script><b style="color:red">world</b> <img src="https://x/y.png" onerror="x()">', replyTo: { text: undefined } }, resolve));
  ok("chatMessage ack returns id", typeof ack?.id === "number", JSON.stringify(ack));
  ok("script tag stripped server-side", typeof ack?.text === "string" && !ack.text.includes("<script"), ack?.text);
  ok("inline style kept (CSS support)", typeof ack?.text === "string" && ack.text.includes("style"), ack?.text);
  ok("onerror attribute stripped", typeof ack?.text === "string" && !ack.text.includes("onerror"), ack?.text);

  const ack2 = await new Promise((resolve) => socket.emit("chatMessage", { text: "second message" }, resolve));
  ok("second message id increments", ack2?.id === (ack?.id ?? 0) + 1, JSON.stringify(ack2?.id));

  // second socket receives broadcast
  const socket2 = await connectSocket().catch(() => null);
  let received = null;
  if (socket2) {
    received = await new Promise((resolve) => {
      socket2.on("chatMessage", (msg) => resolve(msg));
      socket.emit("chatMessage", { text: "broadcast me" }, () => {});
      setTimeout(() => resolve(null), 4000);
    });
  }
  ok("second socket receives broadcast", received?.text === "broadcast me", JSON.stringify(received));

  // typing broadcast carries session username
  let typing = null;
  if (socket2) {
    typing = await new Promise((resolve) => {
      socket2.on("typingMessage", (u) => resolve(u));
      socket.emit("triggerTyping", { username: "SPOOFED", typing: true }, () => {});
      setTimeout(() => resolve(null), 4000);
    });
  }
  ok("typing uses session username (no spoofing)", typing?.username === "Admin", JSON.stringify(typing));

  // edit + react + delete
  const editAck = await new Promise((resolve) => socket.emit("editMessage", { id: ack.id, text: "edited <i>text</i>" }, resolve));
  ok("editMessage ack", editAck?.edited_at && editAck?.text.includes("edited"), JSON.stringify(editAck));
  const reactAck = await new Promise((resolve) => socket.emit("reactMessage", { id: ack.id, reactions: { "👍": { usernames: ["Admin"] } } }, resolve));
  ok("reactMessage ack adds reaction", reactAck?.reactions?.["👍"]?.usernames?.[0] === "Admin", JSON.stringify(reactAck?.reactions));
  const badReactAck = await new Promise((resolve) => socket.emit("reactMessage", { id: ack.id, reactions: { "😀": "not-an-object" } }, resolve));
  ok("malformed reaction tolerated (no hang)", badReactAck !== undefined, JSON.stringify(badReactAck));
  const delAck = await new Promise((resolve) => socket.emit("deleteMessage", ack2.id, resolve));
  ok("deleteMessage ack", delAck?.status === true, JSON.stringify(delAck));

  // pagination (id-based)
  const page = await api("/api/chat/getMessages", { method: "POST", body: { limit: 1, lastId: null } });
  const firstPageIds = (page.json?.messages || []).map((m) => m.id);
  ok("initial page returns latest message", firstPageIds.length === 1 && firstPageIds[0] === 3, JSON.stringify(firstPageIds));
  ok("hasMore=true on first page", page.json?.hasMore === true);
  const page2 = await api("/api/chat/getMessages", { method: "POST", body: { limit: 5, lastId: firstPageIds[0] } });
  // message id 2 was deleted above — id-based pagination must still return exactly the surviving older ids
  ok("older page returns remaining ids", (page2.json?.messages || []).map((m) => m.id).join(",") === "1", JSON.stringify(page2.json?.messages?.map((m) => m.id)));

  // export
  const txt = await api("/api/chat/export?format=txt");
  ok("export txt 200", txt.status === 200, `status=${txt.status}`);
  ok("export txt header present", txt.text.includes("Our Discussion Room") && txt.text.includes("[20"), txt.text.slice(0, 120));
  ok("export txt html stripped", !txt.text.includes("<i>"), "");
  const jsonExp = await api("/api/chat/export?format=json");
  ok("export json array", Array.isArray(jsonExp.json) && jsonExp.json.length === 2, `len=${jsonExp.json?.length}`);

  // notice (admin) — sanitized + served back
  const noticePut = await api("/api/chat/updateNotice", { method: "PUT", body: { notice: '<b style="color:blue">বড় নোটিশ</b><script>bad()</script>' } });
  ok("updateNotice 200", noticePut.status === 200, `status=${noticePut.status}`);
  const noticeGet = await api("/api/chat/getNotice");
  ok("notice sanitized but HTML kept", noticeGet.json?.notice?.includes("<b") && !noticeGet.json?.notice?.includes("script"), JSON.stringify(noticeGet.json));

  // hijri
  const hijri = await api("/api/hijri");
  ok("hijri yyyy-mm-dd format", /^\d{4}-\d{2}-\d{2}$/.test(hijri.json?.hijri || ""), JSON.stringify(hijri.json));

  socket.disconnect();
  socket2?.disconnect();
}

// ---------- summary ----------
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log("FAILED:", failed.map((f) => f.name).join(" | "));
  process.exit(1);
}
process.exit(0);
