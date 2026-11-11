/* Media messages (voice + photos) — standalone addon for "Our Discussion Room".
   Owner request 2026-11-08: send voice messages and photos in the chat.

   v2 (owner bug report 2026-11-08: "audio/photo uploads never show up"):
   the send path was dead — this addon waited for a global `window.io` that
   the minified app never exposes (0 matches in the bundle), and its fallback
   `if (!sendViaAppSocket(...))` treated a Promise as truthy so the REST twin
   never ran. Uploads succeeded, the chatMessage never left the browser.
   Fixes:
     • loadIo(): loads the SAME vendored /addons/socket.io.min.js the addon
       layer already uses (server builds do not serve /socket.io/socket.io.js)
     • send path awaits the ack; on failure it really falls back to
       POST /api/chat and toasts an honest error instead of dying silently
     • render path: the old marker-string scanner never matched (the app
       stores raw text, the DOM is sanitized) — removed. Own bubbles render
       from the send ack; other people's + history bubbles are covered by an
       XHR tap on the app's own getMessages/getMissingMessages axios calls
       (the app re-syncs on reconnect and scroll-up) plus a targeted 5s
       history walk while logged in. All DOM markers (__bcaMediaDone) survive
       React edits/re-renders because the bubble element itself is reused.

   SEND (composer buttons, injected next to the app's emoji tray):
     🎤 press to record (MediaRecorder, ≤90s by default, tap again to send,
        ✕ to cancel)   🖼️ file picker; images compressed client-side
        (max 2000px, JPEG ~0.75) before upload
   Flow: POST /api/chat/media {mime, data(base64)} → { mediaId } → chatMessage
   {text:"", media:{mediaId,mime,seconds}} — the exact transport of every
   other message, so all delivery guarantees come for free.

   This file never edits the minified app or other addons; it only reads
   window.__bcaSession (the shared hub) for the logged-in state.
*/
(() => {
  "use strict";
  if (window.__bcaMedia) return;
  window.__bcaMedia = true;
  // silent (owner request 2026-11-08: no console noise)

  const MAX_SECONDS = Math.min(parseInt(localStorage.getItem("bcaMediaMaxSec") || "90", 10), 120);
  const MAX_B64 = 300000; // server-enforced cap, mirrored here for UX
  const MAX_IMG_PX = 2000;

  const T = {
    en: { rec: "Record voice", stop: "Send", cancel: "Cancel recording", photo: "Send a photo",
          recMax: "Max 90 seconds", recShort: "Too short — nothing sent, try again",
          silence: "No sound captured — please try recording again",
          up: "Uploading…", toobig: "Too large — pick a smaller photo",
          mic: "Microphone unavailable", deny: "Recording failed — check the mic permission",
          sending: "Sending…", sendFail: "Could not send — please try again" },
    bn: { rec: "ভয়েস রেকর্ড", stop: "পাঠান", cancel: "রেকর্ড বাতিল", photo: "ছবি পাঠান",
          recMax: "সর্বোচ্চ ৯০ সেকেন্ড", recShort: "খুব ছোট — কিছু পাঠানো হয়নি, আবার চেষ্টা করুন",
          silence: "রেকর্ডিং-এ শব্দ পাওয়া যায়নি — আবার চেষ্টা করুন",
          up: "আপলোড হচ্ছে…", toobig: "খুব বড় — ছোট ছবি দিন",
          mic: "মাইক পাওয়া যাচ্ছে না", deny: "রেকর্ড হয়নি — মাইক-পারমিশন দেখুন",
          sending: "পাঠানো হচ্ছে…", sendFail: "পাঠানো যায়নি — আবার চেষ্টা করুন" },
  };
  const lang = () => (localStorage.getItem("langPref") === "en" ? "en" : "bn");
  const tt = (k) => T[lang()][k] || k;

  // ---------- capability probe: REST up + logged in + media permission ----------
  let backendOk = null; // null = unknown, true/false after the first probe
  let mediaAllowed = true; // mediaMode all|admin|selected — resolved from
                           // visibility; legacy servers keep everyone-can
  let backendProbe = null; // in-flight probe — the MutationObserver ticks fast,
                           // so concurrent callers must share ONE fetch
  let lastProbeAt = 0; // timestamp-based periodic re-probe (permission flips
                       // must land without depending on tick ordering)
  const PROBE_TTL = 10000; // re-resolve visibility at most every 10s
  function backendReady() {
    if (backendOk === false) return Promise.resolve(false);
    const sess = window.__bcaSession;
    if (!sess?.loggedIn) return Promise.resolve(false);
    // TTL applies regardless of the resolved permission — without this the
    // denied state re-probed every 1.8s tick (12 fetches/20s measured)
    const fresh = Date.now() - lastProbeAt < PROBE_TTL;
    if (fresh && backendOk === true) return Promise.resolve(mediaAllowed);
    if (!backendProbe) {
      lastProbeAt = Date.now();
      backendProbe = fetch("/api/chat/visibility", { credentials: "same-origin" })
        .then(async (res) => {
          backendOk = res.ok; // modern backends answer; legacy 404s hide the UI
          if (res.ok) {
            const body = await res.json().catch(() => null);
            // owner request 2026-11-09: admin on/off for the media buttons;
            // admins always can; legacy servers (no field) keep everyone-can
            mediaAllowed = body && typeof body.canUseMedia === "boolean" ? body.canUseMedia : true;
            if (sess.me?.isAdmin) mediaAllowed = true;
          }
          return backendOk && mediaAllowed;
        })
        .catch(() => false)
        .finally(() => { backendProbe = null; });
    }
    return backendProbe;
  }

  // ---------- upload ----------
  async function uploadMedia(mime, dataB64) {
    const ctrl = (typeof AbortController === "function") ? new AbortController() : null;
    const to = ctrl && setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetch("/api/chat/media", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mime, data: dataB64 }),
        ...(ctrl ? { signal: ctrl.signal } : {}),
      });
      if (!res.ok) throw new Error("upload " + res.status);
      return await res.json(); // { mediaId, bytes }
    } finally { if (to) clearTimeout(to); }
  }

  // ---------- find the composer + tray ----------
  function composerTextarea() {
    return document.querySelector(".chat-box-tray textarea") ||
      document.querySelector("textarea.form-control");
  }
  function trayRow() { return document.querySelector(".chat-box-tray"); }

  // ---------- socket.io client loader ----------
  // The minified app keeps its socket (and its `io`) inside a closure, so this
  // addon loads the SAME vendored official client the addon layer already
  // ships at /addons/socket.io.min.js (v1 wrongly assumed a global window.io
  // existed — it never does, so nothing was ever sent).
  let ioLoading = null;
  function loadIo() {
    if (window.io) return Promise.resolve(window.io);
    if (ioLoading) return ioLoading;
    ioLoading = new Promise((resolve) => {
      const sc = document.createElement("script");
      sc.src = "/addons/socket.io.min.js";
      sc.onload = () => resolve(window.io || null);
      sc.onerror = () => resolve(null);
      document.head.appendChild(sc);
    });
    return ioLoading;
  }

  // ---------- send through a short-lived socket.io connection ----------
  // connect → emit chatMessage → take the ack → disconnect. Media sends are
  // rare, so a ~0.3s handshake per send is fine and nothing stays open in the
  // background (one-surface rule respected). Resolves with the server ack
  // ({id, media, ...}) on success, or null if the socket path failed.
  function sendViaAppSocket(payload) {
    return loadIo().then((IO) => new Promise((resolve) => {
      if (!IO) { resolve(null); return; }
      let settled = false;
      const s = IO({ transports: ["websocket", "polling"], reconnection: false, timeout: 8000 });
      const done = (ok, ack) => {
        if (settled) return;
        settled = true;
        try { s.disconnect(); } catch { /* already down */ }
        resolve(ok ? (ack || { ok: true }) : null);
      };
      s.on("connect", () => {
        s.timeout(8000).emit("chatMessage", payload, (err, ackPayload) => done(!err, ackPayload));
      });
      s.on("connect_error", () => done(false));
      setTimeout(() => done(false), 9500);
    }));
  }

  // ---------- recording state ----------
  let recorder = null, chunks = [], recStart = 0, recTimer = null, recBtn = null;

  async function toggleRecord(btn) {
    if (recorder && recorder.state === "recording") { stopRecording(true); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast(tt("mic")); return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch { toast(tt("deny")); return; }
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"]
      .find((m) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || "";
    // NOTE: no audioBitsPerSecond constraint — several WebKit/Chromium builds
    // silently produce a valid-timeline-but-ALL-ZEROS opus stream (container
    // with hundreds of frames, every payload byte 0x00) when a bitrate
    // constraint is forced onto the opus encoder. Owner hit exactly that:
    // "3s voice, plays 3s, zero sound". Default-quality recording is loud;
    // the size budget is guarded AFTER the fact (toobig below + server cap).
    try {
      recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
    } catch { stream.getTracks().forEach((t) => t.stop()); toast(tt("deny")); return; }
    chunks = []; recStart = Date.now();
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      if (recTimer) { clearInterval(recTimer); recTimer = null; }
      const seconds = Math.round((Date.now() - recStart) / 1000);
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      recorder = null; restoreBtn();
      if (!cancelRequested) {
        if (seconds < 1) { toast(tt("recShort")); return; }
        await sendVoiceBlob(blob, seconds, mime.split(";")[0] || "audio/webm");
      }
      cancelRequested = false;
    };
    recorder.start(250);
    paintRecState(btn);
    startRecTimer();
    showCancelButton();
    // auto-stop at the cap
    recTimer = setTimeout(() => { if (recorder && recorder.state === "recording") stopRecording(true); }, MAX_SECONDS * 1000);
  }
  let cancelRequested = false;
  function stopRecording(send) {
    cancelRequested = !send;
    try { recorder.stop(); } catch { /* already stopped */ }
  }
  function paintRecState(btn) {
    recBtn = btn;
    btn.textContent = "⏺";
    btn.classList.add("bca-media-rec");
    btn.title = tt("stop");
  }
  function restoreBtn() {
    removeRecUi();
    if (!recBtn) return;
    recBtn.textContent = "🎙️";
    recBtn.classList.remove("bca-media-rec");
    recBtn.title = tt("rec") + " (" + tt("recMax") + ")";
    recBtn = null;
  }
  // ---------- recording UI: live seconds timer + explicit cancel (owner
  // request: a mistapped record must be cancellable, not forced-send) ----------
  let recUiTimer = null, cancelBtn = null;
  function startRecTimer() {
    stopRecTimer();
    recUiTimer = setInterval(() => {
      if (!recBtn || !recorder) { stopRecTimer(); return; }
      recBtn.textContent = "⏺ " + Math.min(Math.floor((Date.now() - recStart) / 1000), MAX_SECONDS) + "s";
    }, 500);
  }
  function stopRecTimer() {
    if (recUiTimer) { clearInterval(recUiTimer); recUiTimer = null; }
  }
  function showCancelButton() {
    removeCancelButton();
    if (!recBtn || !recBtn.parentNode) return;
    cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn-outline-secondary btn-sm icon-button bca-media-cancel";
    cancelBtn.textContent = "✕";
    cancelBtn.title = tt("cancel");
    cancelBtn.setAttribute("aria-label", tt("cancel"));
    cancelBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (recorder && recorder.state === "recording") stopRecording(false);
    });
    recBtn.parentNode.insertBefore(cancelBtn, recBtn);
  }
  function removeCancelButton() {
    if (cancelBtn) { cancelBtn.remove(); cancelBtn = null; }
  }
  function removeRecUi() {
    stopRecTimer();
    removeCancelButton();
  }

  async function sendVoiceBlob(blob, seconds, mime) {
    // silence tripwire: some encoder/bitmrate combos emit a well-formed but
    // all-zero-payload opus stream ("plays N s, no sound") — refuse to send it
    const buf = new Uint8Array(await blob.arrayBuffer());
    let zeros = 0;
    for (let i = 0; i < buf.length; i++) if (!buf[i]) zeros++;
    if (buf.length > 400 && zeros > buf.length * 0.9) {
      console.warn("[bca] voice recording looks silent (all-zero opus payload) — re-recording without bitrate constraint is required");
      toast(tt("silence"));
      return;
    }
    if (blob.size * 1.34 > MAX_B64) { toast(tt("toobig") + " (" + Math.round(blob.size/1024) + "KB)" ); return; }
    const b64 = await new Promise((res) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result).split(",")[1] || "");
      fr.readAsDataURL(blob);
    });
    toast(tt("up"));
    try {
      const { mediaId } = await uploadMedia(mime, b64);
      sendMediaMessage({ mediaId, mime, seconds });
    } catch (e) {
      console.warn("[bca] voice upload failed:", e);
      toast(tt("deny"));
    }
  }

  // ---------- send the message that carries the media ----------
  // v2: the socket result is awaited; only a REAL failure falls back to the
  // REST twin (POST /api/chat), and a failed fallback toasts honestly instead
  // of vanishing (v1 resolved a Promise — always truthy — so the fallback was
  // dead code and failures were silent).
  function sendMediaMessage(media) {
    const payload = { text: "", media };
    sendViaAppSocket(payload).then((ack) => {
      if (ack) { rememberOwnMedia(ack, media); return; }
      fetch("/api/chat", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => {
        if (!r.ok) { toast(tt("sendFail")); return; }
        r.json().then((m) => rememberOwnMedia(m, media)).catch(() => {});
      }).catch(() => toast(tt("sendFail")));
    });
  }

  // ---------- photo compression + send ----------
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        try {
          let { width, height } = img;
          const scale = Math.min(1, MAX_IMG_PX / Math.max(width, height));
          width = Math.max(1, Math.round(width * scale));
          height = Math.max(1, Math.round(height * scale));
          const cv = document.createElement("canvas");
          cv.width = width; cv.height = height;
          cv.getContext("2d").drawImage(img, 0, 0, width, height);
          let q = 0.78, out = cv.toDataURL("image/jpeg", q);
          // one extra step down if still over the wire cap
          while (out.length > MAX_B64 && q > 0.4) { q -= 0.15; out = cv.toDataURL("image/jpeg", q); }
          URL.revokeObjectURL(url);
          if (out.length > MAX_B64) return reject(new Error("big"));
          resolve({ mime: "image/jpeg", data: out.split(",")[1] });
        } catch (e) { URL.revokeObjectURL(url); reject(e); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("img")); };
      img.src = url;
    });
  }

  async function sendPhoto(file) {
    if (!/^image\//.test(file.type)) return;
    toast(tt("up"));
    try {
      const { mime, data } = await compressImage(file);
      const { mediaId } = await uploadMedia(mime, data);
      sendMediaMessage({ mediaId, mime });
    } catch (e) {
      console.warn("[bca] photo send failed:", e);
      toast(String(e?.message) === "big" ? tt("toobig") : tt("deny"));
    }
  }

  // ---------- composer buttons ----------
  function ensureComposerButtons() {
    const tray = trayRow();
    if (!tray) return;
    // permission revoked → remove the buttons (admin flips mediaMode); the
    // next allowed cycle re-adds them (mirrors the navbar-icon re-attach flow)
    const existing = tray.querySelector(".bca-media-btns");
    if (existing && mediaAllowed === false) { existing.remove(); return; }
    // not allowed + nothing drawn: still probe — a flip back to allowed must
    // re-draw within one cycle (early-return here would freeze the state)
    if (!existing && mediaAllowed === false) { backendReady(); return; }
    // create buttons lazily after the probe resolves
    backendReady().then((ok) => {
      if (!tray.isConnected) return;
      const already = tray.querySelector(".bca-media-btns");
      // the probe may have just flipped the permission — remove immediately
      if (already && mediaAllowed === false) { already.remove(); return; }
      if (!ok) return;
      if (already) return;
      const wrap = document.createElement("div");
      wrap.className = "bca-media-btns";
      const mic = document.createElement("button");
      mic.type = "button"; mic.className = "btn btn-outline-secondary btn-sm icon-button bca-media-mic";
      mic.textContent = "🎙️"; mic.title = tt("rec") + " (" + tt("recMax") + ")";
      mic.addEventListener("click", (e) => { e.preventDefault(); toggleRecord(mic); });
      const photo = document.createElement("button");
      photo.type = "button"; photo.className = "btn btn-outline-secondary btn-sm icon-button bca-media-photo";
      photo.textContent = "🖼️"; photo.title = tt("photo");
      const file = document.createElement("input");
      file.type = "file"; file.accept = "image/*"; file.style.display = "none";
      file.addEventListener("change", () => {
        const f = file.files && file.files[0];
        if (f) sendPhoto(f);
        file.value = "";
      });
      photo.addEventListener("click", (e) => { e.preventDefault(); file.click(); });
      wrap.appendChild(mic); wrap.appendChild(photo); wrap.appendChild(file);
      tray.appendChild(wrap);
    });
  }

  // ---------- render media bubbles ----------
  let lightbox = null;
  function openLightbox(src) {
    if (lightbox) { lightbox.remove(); lightbox = null; }
    lightbox = document.createElement("div");
    lightbox.className = "bca-lightbox";
    const img = document.createElement("img");
    img.src = src;
    lightbox.appendChild(img);
    lightbox.addEventListener("click", () => { lightbox.remove(); lightbox = null; });
    document.body.appendChild(lightbox);
  }

  function buildMediaHost(body, media) {
    const host = document.createElement("div");
    host.className = "bca-media";
    if (/^audio\//.test(media.mime)) {
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.preload = "metadata";
      audio.src = `/api/chat/media/${media.mediaId}`;
      host.appendChild(audio);
      if (media.seconds) {
        const d = document.createElement("span");
        d.className = "bca-media-dur";
        d.textContent = media.seconds + "s";
        host.appendChild(d);
      }
    } else if (/^image\//.test(media.mime)) {
      const img = document.createElement("img");
      img.className = "bca-media-img";
      img.loading = "lazy";
      img.alt = "photo";
      img.src = `/api/chat/media/${media.mediaId}`;
      img.addEventListener("click", () => openLightbox(img.src));
      host.appendChild(img);
    }
    body.appendChild(host);
  }

  // media ids we know about, keyed by message id — filled by our own send
  // acks, by tapping the app's history XHRs, and by the periodic history walk
  const pendingMedia = new Map();

  // remember OUR own outgoing media (the message id arrives in the ack); the
  // app's own socket also receives the chatMessage broadcast (our short-lived
  // sender socket is the only one excluded), so React paints the bubble and
  // the next scan decorates it
  function rememberOwnMedia(ackPayload, media) {
    if (ackPayload && Number.isFinite(Number(ackPayload.id)) && media) {
      pendingMedia.set(Number(ackPayload.id), media);
      scheduleScan();
    }
  }

  let scanQueued = false;
  function scheduleScan() {
    if (scanQueued) return;
    scanQueued = true;
    setTimeout(() => {
      scanQueued = false;
      document.querySelectorAll('div[id^="message-"]').forEach((bubble) => {
        if (bubble.__bcaMediaDone) return;
        const id = Number(String(bubble.id || "").replace("message-", ""));
        const media = pendingMedia.get(id);
        if (!media) return;
        const body = bubble.querySelector(".message-body");
        if (!body || body.childElementCount) return; // text messages untouched
        if (bubble.__bcaMediaTimer) { clearTimeout(bubble.__bcaMediaTimer); bubble.__bcaMediaTimer = null; }
        bubble.__bcaMediaDone = true;
        buildMediaHost(body, media);
      });
    }, 60);
  }

  // ---------- live receive: tap the app's own history XHRs ----------
  // The app fetches history through axios (XHR) — on login, on scroll-up and
  // whenever its reconnect sync detects a gap (getMissingMessages). Tapping
  // those responses costs nothing and keeps everyone's media metadata fresh
  // without a second websocket. Other people's brand-new live messages are
  // covered by the 5s scanHistory walk below.
  (function tapHistoryXhr() {
    const OrigOpen = XMLHttpRequest.prototype.open;
    const OrigSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this.__bcaUrl = String(url || "");
      return OrigOpen.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.send = function (...args) {
      const url = this.__bcaUrl || "";
      if (/\/api\/chat\/getMessages|\/api\/chat\/getMissingMessages/.test(url)) {
        this.addEventListener("load", function () {
          try {
            const data = JSON.parse(this.responseText);
            const arr = Array.isArray(data) ? data : (data.messages || []);
            let hit = false;
            for (const m of arr) {
              if (m?.media?.mediaId && Number.isFinite(Number(m.id)) && !pendingMedia.has(Number(m.id))) {
                pendingMedia.set(Number(m.id), m.media);
                hit = true;
              }
            }
            if (hit) scheduleScan();
          } catch { /* not json — ignore */ }
        });
      }
      return OrigSend.apply(this, args);
    };
  })();

  // ---------- targeted history walk (covers other users' live media) ----------
  // Full re-walks were O(history) on every tick; the walk below asks only for
  // the latest 100 and re-checks an already-known bubble only while it is
  // still undecorated (React keeps the element across edits).
  async function scanHistory() {
    try {
      const res = await fetch("/api/chat/getMessages", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 100 }),
      });
      if (!res.ok) return;
      const data = await res.json();
      // persisted rows only: skip entries with no time — the server's own
      // REST twins emit an in-flight copy without a time right after saving,
      // and the durable history fetch right behind it carries the real row
      const arr = (data.messages || data || []).filter((m) => m && typeof m.time === "string" && m.time);
      let hit = false;
      for (const m of arr) {
        if (m?.media?.mediaId && Number.isFinite(Number(m.id))) {
          const id = Number(m.id);
          if (!pendingMedia.has(id)) { pendingMedia.set(id, m.media); hit = true; }
          const el = document.getElementById("message-" + id);
          if (el && !el.__bcaMediaDone) { scheduleScan(); break; }
        }
      }
      if (hit) scheduleScan();
    } catch { /* silent — retried on the next interval */ }
  }

  // ---------- toast ----------
  function toast(msg) {
    let host = document.getElementById("bca-root");
    if (!host) {
      host = document.createElement("div");
      host.id = "bca-root"; host.className = "bca-root";
      document.body.appendChild(host);
    }
    host.querySelectorAll(".bca-toast").forEach((x) => x.remove());
    const el = document.createElement("div");
    el.className = "bca-toast";
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  // ---------- loops ----------
  const mo = new MutationObserver(() => { ensureComposerButtons(); scheduleScan(); });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(() => {
    if (window.__bcaSession?.loggedIn) {
      ensureComposerButtons();
      scheduleScan();
    }
  }, 1800);
  setInterval(() => { if (window.__bcaSession?.loggedIn) scanHistory(); }, 5000);
  setTimeout(() => { scanHistory(); }, 1200);
  ensureComposerButtons();
})();
