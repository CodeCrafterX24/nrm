"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.initialFrequentSymbols = exports.ATTENDANCE_DEFAULT_HTML = exports.SETTING_LIMITS = exports.PERMISSION_MODES = exports.Setting = void 0;
const BaseModel_1 = require("./BaseModel.js");
const initialFrequentSymbols = `
بِسْمِ اللَّـهِ الرَّحْمَـٰنِ الرَّحِيمِ
السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ
وَعَلَيْكُمُ السَّلَامُ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ
الْحَمْدُ لِلَّهِ الْكَرِيمِ الَّذِي أَسْبَغَ نِعَمَهُ عَلَيْنَا بَاطِنَةً وَظَاهِرَةً، الْعَزِيزِ الَّذِي خَضَعَتْ لِعِزَّتِهِ رِقَابُ الْجَبَابِرَةُ، وَأَشْهَدُ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ شَهَادَةً نَرْجُو بِهَا النَّجَاةَ فِي الدَّارِ الْآخِرَةِ، وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ صَلَّى اللَّهُ عَلَيْهِ وَعَلَى آلِهِ وَصَحْبِهِ وَسَلَّمَ تَسْلِيمًا كَثِيرًا
سُبْحَانَكَ اللّٰهُمَّ وَبِحَمْدِكَ، أَشْهَدُ أَنْ لاَ إِلَهَ إِلاَّ أَنْتَ، أَسْتَغْفِرُكَ وَأَتُوْبُ إِلَيْكَ
<img src="IMAGE_LINK" style="max-width:100%" />
<span class="message-body admin">Yellow text</span>
<a href="LINK" >click here</a>
<div style="background-color: #fdff77;color: #151362;border-radius:7px;padding:7px;font-family:Kalpurush;border:4px solid rgb(189, 19, 79);box-shadow: 3px 5px 1px #ccc;">special_text</div>`;
exports.initialFrequentSymbols = initialFrequentSymbols;

/**
 * Who may use a feature. `selected` means: the admins plus the usernames
 * listed in the matching `<feature>Selected` array.
 */
const PERMISSION_MODES = ["all", "admin", "selected"];
exports.PERMISSION_MODES = PERMISSION_MODES;

/** stored-size guard rails — the Setting document lives in a single gist file */
const SETTING_LIMITS = {
    /** UI-editable html for the attendance counter page (raw html, not sanitized) */
    attendanceHtml: 300000,
    /** shared note shown on the attendance page (plain text, not sanitized) */
    attendanceNote: 100000,
    /** UI-editable html/css/js for the fullscreen login notice (raw, not sanitized) */
    fsNotice: 100000,
    /** fullscreen-notice confirm button label (plain text, short) */
    fsNoticeOkLabel: 60,
    /** fullscreen-notice button position: left | center | right */
    fsNoticeBtnAlign: 6,
    /** one username entry */
    username: 50,
    /** members of a selected-users list */
    members: 200,
};
exports.SETTING_LIMITS = SETTING_LIMITS;

/** starter page for the attendance counter — the admin replaces it freely */
const ATTENDANCE_DEFAULT_HTML = `<!doctype html>
<html lang="bn">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>হাজিরা কাউন্টার</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; padding: 24px 16px; font-family: "Noto Sans Bengali", "Hind Siliguri", system-ui, sans-serif;
         background: #f6f7f9; color: #1b1f24; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p.hint { margin: 0 0 20px; font-size: 13px; color: #5b6572; }
  .row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
  input, button { font: inherit; padding: 8px 12px; border-radius: 8px; border: 1px solid #c9d1da; }
  button { background: #2563eb; color: #fff; border-color: #2563eb; cursor: pointer; }
  button.ghost { background: #fff; color: #1b1f24; border-color: #c9d1da; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { background: #fff; border: 1px solid #e3e8ee; border-radius: 10px; padding: 10px 12px;
       margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
  .empty { color: #5b6572; font-size: 14px; }
  @media (prefers-color-scheme: dark) {
    body { background: #12161b; color: #e8edf3; }
    li, button.ghost { background: #1b2128; border-color: #2b333d; }
    p.hint, .empty { color: #9aa5b1; }
  }
</style>
</head>
<body>
  <h1>হাজিরা কাউন্টার</h1>
  <p class="hint">এই পেজের সম্পূর্ণ কোড অ্যাডমিন সেটিংস থেকে বদলানো যায়।</p>
  <div class="row">
    <input id="who" placeholder="নাম লিখুন" />
    <button id="add">হাজিরা দিন</button>
    <button id="reset" class="ghost">রিসেট</button>
  </div>
  <ul id="list"></ul>
  <p class="empty" id="empty">এখনো কেউ হাজিরা দেয়নি।</p>
  <script>
    (function () {
      var KEY = "attendance-records";
      var list = document.getElementById("list");
      var empty = document.getElementById("empty");
      var who = document.getElementById("who");
      function read() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; } }
      function write(rows) { localStorage.setItem(KEY, JSON.stringify(rows)); }
      function render() {
        var rows = read();
        list.innerHTML = "";
        rows.forEach(function (r, i) {
          var li = document.createElement("li");
          var span = document.createElement("span");
          span.textContent = r.name + " — " + r.at;
          var del = document.createElement("button");
          del.className = "ghost";
          del.textContent = "✕";
          del.onclick = function () { var next = read(); next.splice(i, 1); write(next); render(); };
          li.appendChild(span);
          li.appendChild(del);
          list.appendChild(li);
        });
        empty.style.display = rows.length ? "none" : "";
      }
      document.getElementById("add").onclick = function () {
        var name = (who.value || "").trim();
        if (!name) return;
        var rows = read();
        rows.push({ name: name, at: new Date().toLocaleString("bn-BD") });
        write(rows);
        who.value = "";
        render();
      };
      document.getElementById("reset").onclick = function () { write([]); render(); };
      render();
    })();
  </script>
</body>
</html>
`;
exports.ATTENDANCE_DEFAULT_HTML = ATTENDANCE_DEFAULT_HTML;

const normalizeMode = (value, fallback) => (PERMISSION_MODES.includes(value) ? value : fallback);

/** usernames arrive from the admin UI as an array (or a comma separated string) */
const normalizeUsernames = (value) => {
    const raw = Array.isArray(value)
        ? value
        : typeof value === "string"
            ? value.split(/[\n,]+/)
            : [];
    const out = [];
    for (const entry of raw) {
        if (typeof entry !== "string")
            continue;
        const name = entry.trim().slice(0, SETTING_LIMITS.username);
        if (!name)
            continue;
        // case-insensitive dedupe, keep the first spelling the admin used
        if (out.some((existing) => existing.toLowerCase() === name.toLowerCase()))
            continue;
        out.push(name);
        if (out.length >= SETTING_LIMITS.members)
            break;
    }
    return out;
};
exports.normalizeUsernames = normalizeUsernames;

class Setting extends BaseModel_1.BaseModel {
    notice;
    chatState;
    hijri;
    frequentSymbols;
    /** who may use the "copy all" export — "all" | "admin" | "selected" */
    copyAllMode;
    /** usernames allowed to copy when copyAllMode === "selected" */
    copyAllSelected;
    /** who may see the online-users list — "all" | "admin" | "selected" */
    showOnlineUsers;
    /** usernames allowed to see the list when showOnlineUsers === "selected" */
    onlineUsersSelected;
    /** who may open the attendance counter page — "admin" | "selected" */
    attendanceViewMode;
    /** usernames allowed to open the attendance page when the mode is "selected" */
    attendanceSelected;
    /** who may delete the whole chat history — "all" | "admin" | "selected" */
    deleteChatMode;
    /** usernames allowed to delete the whole history when deleteChatMode === "selected" */
    deleteChatSelected;
    /** who may send media messages (voice/photo) — "all" | "admin" | "selected";
        admins always can (owner request 2026-11-09: per-feature media on/off) */
    mediaMode;
    /** usernames allowed to send media when mediaMode === "selected" */
    mediaSelected;
    /** raw, admin-editiable html rendered by GET /attendance */
    attendanceHtml;
    /** shared plain-text note shown on the attendance page (admin + selected users) */
    attendanceNote;
    /** raw, admin-editable html/css/js shown fullscreen after every login */
    fsNotice;
    /** ISO timestamp of the last fullscreen-notice save ("" = never) */
    fsNoticeUpdatedAt;
    /** custom text for the fullscreen-notice confirm button ("" = default) */
    fsNoticeOkLabel;
    /** button position inside the fullscreen overlay: left (default) | center | right */
    fsNoticeBtnAlign;
    /** where new chat messages persist: "gist" (durable, slower) | "memory"
        (server-local, fast — lost on restart/redeploy). User+Setting always
        persist in the gist regardless. */
    messageStoreMode;
    constructor(json = {}) {
        super(json);
        this.notice = json.notice || "";
        this.chatState = json.chatState ?? true; // by default chat should be enabled (|| would have forced true)
        this.hijri = {
            date: "",
            lastUpdate: "",
            adjustment: 0,
        };
        this.frequentSymbols = initialFrequentSymbols;
        // admin-configurable features; fall back to permissive defaults when
        // the stored setting predates these fields
        // (showOnlineUsers used to be a boolean — migrate true/false into all/admin)
        const legacyOnline = typeof json.showOnlineUsers === "boolean"
            ? (json.showOnlineUsers ? "all" : "admin")
            : json.showOnlineUsers;
        this.copyAllMode = normalizeMode(json.copyAllMode, "all");
        this.copyAllSelected = normalizeUsernames(json.copyAllSelected);
        this.showOnlineUsers = normalizeMode(legacyOnline, "all");
        this.onlineUsersSelected = normalizeUsernames(json.onlineUsersSelected);
        // the attendance page is never public: default is admins only
        this.attendanceViewMode = normalizeMode(json.attendanceViewMode, "admin") === "all"
            ? "admin"
            : normalizeMode(json.attendanceViewMode, "admin");
        this.attendanceSelected = normalizeUsernames(json.attendanceSelected);
        // deleting the whole history is destructive — default stays admin-only
        this.deleteChatMode = normalizeMode(json.deleteChatMode, "admin");
        this.deleteChatSelected = normalizeUsernames(json.deleteChatSelected);
        this.mediaMode = normalizeMode(json.mediaMode, "all");
        this.mediaSelected = normalizeUsernames(json.mediaSelected);
        this.attendanceHtml = typeof json.attendanceHtml === "string"
            ? json.attendanceHtml.slice(0, SETTING_LIMITS.attendanceHtml)
            : "";
        this.attendanceNote = typeof json.attendanceNote === "string"
            ? json.attendanceNote.slice(0, SETTING_LIMITS.attendanceNote)
            : "";
        this.fsNotice = typeof json.fsNotice === "string"
            ? json.fsNotice.slice(0, SETTING_LIMITS.fsNotice)
            : "";
        this.fsNoticeUpdatedAt = typeof json.fsNoticeUpdatedAt === "string" ? json.fsNoticeUpdatedAt : "";
        this.fsNoticeOkLabel = typeof json.fsNoticeOkLabel === "string" ? json.fsNoticeOkLabel.slice(0, SETTING_LIMITS.fsNoticeOkLabel) : "";
        this.fsNoticeBtnAlign = (json.fsNoticeBtnAlign === "center" || json.fsNoticeBtnAlign === "right") ? json.fsNoticeBtnAlign : "left";
        this.messageStoreMode = json.messageStoreMode === "gist" ? "gist" : "memory";
    }
}
exports.Setting = Setting;
