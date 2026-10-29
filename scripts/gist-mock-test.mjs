// Logic test for the gist-backed repositories using a mocked GitHub API.
// Verifies: sync ids, batch persistence, reload-from-gists (simulated reboot),
// sharded overflow split, cross-shard update/remove, removeAll, load-abort safety.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// --- in-memory fake of the GitHub gists API ---
const gists = new Map(); // id -> {id, description, files: {name: {content}}}
let gistSeq = 0;
let failReads = false;

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
    if (method === "GET") {
      if (failReads) return new Response("{}", { status: 500 });
      return json(gist);
    }
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
  if (m && method === "GET") {
    if (failReads) return new Response("{}", { status: 500 });
    return json([...gists.values()]);
  }
  return new Response("{}", { status: 404 });
};

// import repo classes (server modules are CommonJS)
process.env.GIST_LOAD_ATTEMPTS = "2"; // keep failure-path tests fast
process.env.GIST_SHARD_BYTES = "800"; // tiny shards to exercise rotation/split
const { MemoryGistRepository } = await import(pathToFileURL(path.resolve("server/src/repositories/MemoryGistRepository.js")).href);
const { ShardedGistMessageRepository } = await import(pathToFileURL(path.resolve("server/src/repositories/ShardedGistMessageRepository.js")).href);

const creds = { token: "t", username: "tester" };
const results = [];
const ok = (name, cond, extra = "") => { results.push(cond); console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : " → " + extra}`); };
const flushAll = async (repo) => { await repo.flush(); };

// ---------- MemoryGistRepository (User) ----------
{
  const repo = new MemoryGistRepository(creds, "User", "secret");
  const a = await repo.add({ username: "rakib", password: "h1" });
  const b = await repo.add({ username: "karim", password: "h2" });
  ok("sync ids assigned", a.id === 1 && b.id === 2, `${a.id},${b.id}`);
  await flushAll(repo);
  ok("single gist created", gists.size === 1, `gists=${gists.size}`);

  // simulate reboot: fresh instance loads from gists
  const repo2 = new MemoryGistRepository(creds, "User", "secret");
  const users = await repo2.get();
  ok("reload after reboot", users.length === 2 && users[0].username === "rakib", JSON.stringify(users.length));
  const upd = await repo2.update({ ...users[0], langPref: "bn" });
  await flushAll(repo2);
  const repo3 = new MemoryGistRepository(creds, "User", "secret");
  const users3 = await repo3.get();
  ok("update persisted across reboot", users3[0].langPref === "bn", users3[0].langPref);
  await repo3.remove(users3[1].id);
  await flushAll(repo3);
  const repo4 = new MemoryGistRepository(creds, "User", "secret");
  ok("remove persisted", (await repo4.get()).length === 1, String((await repo4.get()).length));
}

// ---------- ShardedGistMessageRepository (Message) ----------
{
  const repo = new ShardedGistMessageRepository(creds, "Message", "secret");
  const ids = [];
  for (let i = 1; i <= 40; i++) {
    const msg = await repo.add({ text: `message number ${i} ` + "x".repeat(30), time: new Date().toISOString() });
    ids.push(msg.id);
  }
  ok("40 messages, ids sequential", ids[0] === 1 && ids[39] === 40 && new Set(ids).size === 40);
  ok("messages readable immediately (memory authoritative)", (await repo.get()).length === 40);
  await flushAll(repo);
  ok("multiple shards created", repo.shards.length > 1, `shards=${repo.shards.length}`);
  const gistCountBefore = gists.size;

  // reboot: reload all shards
  const repo2 = new ShardedGistMessageRepository(creds, "Message", "secret");
  const loaded = await repo2.get();
  ok("all messages survive reboot", loaded.length === 40 && loaded[39].id === 40, `len=${loaded.length} last=${loaded[39]?.id}`);
  ok("no duplicate ids after reload", new Set(loaded.map((m) => m.id)).size === 40);

  // cross-shard update + remove
  const victim = loaded[5]; // lives in some early shard
  victim.text = "edited across shards";
  await repo2.update(victim);
  const removeTargetId = loaded[30].id; // capture BEFORE removal mutates the live array
  const removed = await repo2.remove(removeTargetId);
  ok("cross-shard update+remove ok", removed === true);
  await flushAll(repo2);
  const repo3 = new ShardedGistMessageRepository(creds, "Message", "secret");
  const after = await repo3.get();
  ok("edits survive reboot", after.find((m) => m.id === victim.id)?.text === "edited across shards");
  ok("removal survives reboot", !after.some((m) => m.id === removeTargetId) && after.length === 39, `len=${after.length}`);

  // load failure must not destroy gists (batch abort)
  failReads = true;
  const repo4 = new ShardedGistMessageRepository(creds, "Message", "secret");
  let loadFailed = false;
  try { await repo4.get(); } catch { loadFailed = true; }
  ok("failed load surfaces as error (no silent empty)", loadFailed);
  failReads = false;
  ok("gists intact after failed load", gists.size >= gistCountBefore - 0, `gists=${gists.size}`);

  // removeAll wipes shard gists
  await repo3.removeAll();
  await new Promise((r) => setTimeout(r, 50));
  const messageGists = [...gists.values()].filter((g) => g.description.startsWith("Storage_Message_"));
  ok("removeAll deletes shard gists", messageGists.length === 0, `left=${messageGists.length}`);
  const next = await repo3.add({ text: "fresh start", time: new Date().toISOString() });
  ok("ids stay monotonic after removeAll", next.id === 41, String(next.id));
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
