// Logic test for the APP_ID room namespace: changing APP_ID must address a
// completely separate set of gists (a different "room") on the same account.
// Each phase runs in its own node process (APP_ID is read at module load and
// CJS modules can't be re-evaluated in-process).
// Run: node scripts/appid-mock-test.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

const STORE = path.join(os.tmpdir(), "appid-mock-gists.json");
const SELF = path.resolve(import.meta.filename);

if (process.argv[2]) {
  await runPhase(process.argv[2]); // child process — exit code set by the phase
  process.exit(process.exitCode ?? 0);
}

// ---------- driver ----------
const phases = [
  ["A-default", { APP_ID: "" }],
  ["B-room-b", { APP_ID: "room-b" }],
  ["C-isolation", { APP_ID: "" }],
  ["D-sanitize", { APP_ID: "room/ x!" }], // unsafe chars must be stripped
];
let fail = false;
fs.rmSync(STORE, { force: true });
for (const [phase, env] of phases) {
  const out = await new Promise((resolve) => {
    const child = spawn(process.execPath, [SELF, phase], {
      env: { ...process.env, ...env },
    });
    let buf = "";
    child.stdout.on("data", (d) => (buf += d));
    child.stderr.on("data", (d) => (buf += d));
    child.on("close", (code) => resolve({ code, buf }));
  });
  console.log(`--- phase ${phase} (APP_ID=${JSON.stringify(env.APP_ID)}) ---`);
  console.log(out.buf.trim());
  if (out.code !== 0) fail = true;
}
fs.rmSync(STORE, { force: true });
console.log(fail ? "\nSOME PHASES FAILED" : "\nall phases passed");
process.exit(fail ? 1 : 0);

// ---------- child phase ----------
async function runPhase(phase) {
  // same in-memory fake of the GitHub gists API, persisted to STORE between phases
  const gists = new Map();
  let gistSeq = 0;
  if (fs.existsSync(STORE)) {
    const saved = JSON.parse(fs.readFileSync(STORE, "utf8"));
    gistSeq = saved.gistSeq;
    for (const g of saved.gists) gists.set(g.id, g);
  }
  const persist = () => fs.writeFileSync(STORE, JSON.stringify({ gistSeq, gists: [...gists.values()] }));
  globalThis.fetch = async (url, options = {}) => {
    const u = new URL(url);
    const method = options.method || "GET";
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
    if (u.pathname === "/gists" && method === "POST") {
      const body = JSON.parse(options.body);
      const id = `gist-${++gistSeq}`;
      gists.set(id, { id, description: body.description, files: Object.fromEntries(Object.entries(body.files).map(([n, f]) => [n, { content: f.content, truncated: false }])) });
      return json({ id });
    }
    let m = /^\/gists\/([^/]+)$/.exec(u.pathname);
    if (m) {
      const gist = gists.get(m[1]);
      if (!gist) return new Response("{}", { status: 404 });
      if (method === "GET") return json(gist);
      if (method === "PATCH") {
        const body = JSON.parse(options.body);
        for (const [name, f] of Object.entries(body.files)) {
          if (f.content === null) delete gist.files[name];
          else gist.files[name] = { content: f.content, truncated: false };
        }
        return json(gist);
      }
      if (method === "DELETE") { gists.delete(m[1]); return new Response(null, { status: 204 }); }
    }
    m = /^\/users\/[^/]+\/gists$/.exec(u.pathname);
    if (m && method === "GET") return json([...gists.values()]);
    return new Response("{}", { status: 404 });
  };

  const { MemoryGistRepository: Memory } = await import(pathToFileURL(path.resolve("server/src/repositories/MemoryGistRepository.js")));
  const { ShardedGistMessageRepository: Sharded } = await import(pathToFileURL(path.resolve("server/src/repositories/ShardedGistMessageRepository.js")));
  const creds = { token: "t", username: "tester" };
  const descriptions = () => [...gists.values()].map((g) => g.description).sort();
  const results = [];
  const ok = (name, cond, extra = "") => { results.push(cond); console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : " → " + extra}`); };

  if (phase === "A-default") {
    const users = new Memory(creds, "User", "secret");
    const msgs = new Sharded(creds, "Message", "secret");
    await users.add({ username: "rakib", password: "h1" });
    await msgs.add({ username: "rakib", text: "hi", time: new Date().toISOString() });
    await users.flush();
    await msgs.flush();
    ok("default room uses legacy gist names", descriptions().join(",") === "Storage_Message_1,Storage_User", descriptions().join(","));
    persist();
  }
  else if (phase === "B-room-b") {
    const users = new Memory(creds, "User", "secret");
    const msgs = new Sharded(creds, "Message", "secret");
    await users.add({ username: "karim", password: "h2" });
    await msgs.add({ username: "karim", text: "hello", time: new Date().toISOString() });
    await users.flush();
    await msgs.flush();
    const desc = descriptions();
    ok("namespaced gist names created", desc.includes("room-b_Storage_User") && desc.includes("room-b_Storage_Message_1"), desc.join(","));
    // reload with the same APP_ID — the new room sees only its own data
    const users2 = new Memory(creds, "User", "secret");
    const msgs2 = new Sharded(creds, "Message", "secret");
    const u = await users2.get();
    const m = await msgs2.get();
    ok("new room reloads its own user", u.length === 1 && u[0].username === "karim", JSON.stringify(u.map((x) => x.username)));
    ok("new room reloads its own message", m.length === 1 && m[0].username === "karim", JSON.stringify(m.map((x) => x.username)));
    persist();
  }
  else if (phase === "C-isolation") {
    const users = new Memory(creds, "User", "secret");
    const msgs = new Sharded(creds, "Message", "secret");
    const u = await users.get();
    const m = await msgs.get();
    ok("default room unaffected by other room", u.length === 1 && u[0].username === "rakib", JSON.stringify(u.map((x) => x.username)));
    ok("default history unaffected", m.length === 1 && m[0].username === "rakib", JSON.stringify(m.map((x) => x.username)));
  }
  else if (phase === "D-sanitize") {
    // started with APP_ID="room/ x!" — must sanitise to "roomx_"
    const users3 = new Memory(creds, "User", "secret");
    await users3.add({ username: "x", password: "h" });
    await users3.flush();
    ok("unsafe APP_ID chars stripped", descriptions().includes("roomx_Storage_User"), descriptions().join(","));
  }
  else {
    console.log(`FAIL  unknown phase ${phase}`);
    process.exit(1);
  }
  process.exitCode = results.every(Boolean) ? 0 : 1;
}
