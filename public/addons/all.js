/* "Our Discussion Room" — ONE-FILE addon bundle (auto-generated).
   DO NOT EDIT — edit the individual files in public/addons/ and run
   `node scripts/build-addons.mjs`. Generated 2026-11-09T11:06:55.683Z.
   Order preserved from the historical index.html script sequence; every
   module keeps its own IIFE + guard variable, so behavior is identical
   to loading the files separately (defer order). */
/* ===== bundle source: addons/inactive-text.js ===== */
/* Replaces the app's "নিষ্ক্রিয় ব্যবহারকারী" / "Inactive User" wording with
   the owner-approved text, everywhere the bundled React app renders it:
   the login error (client_error.inactive_user) and any user-list badges.
   The minified bundle must not be edited (project rule), so this filters
   text nodes in the DOM: any node whose text is EXACTLY the old wording is
   swapped for the new sentence — nothing else is touched, so names,
   messages and all other UI stay untouched. React re-renders are covered
   by a MutationObserver. Language follows the app (localStorage.langPref).
*/
(() => {
  "use strict";
  if (window.__bcaInactiveText) return;
  window.__bcaInactiveText = true;

  const OLD = {
    en: "Inactive User",
    bn: "নিষ্ক্রিয় ব্যবহারকারী",
    // defensive: trimmed/variant forms seen in older builds
    enAlt: ["Inactive user", "Inactive"],
  };
  const NEW = {
    en: "This account has not been approved yet. Please contact the admin for approval.",
    bn: "এই আইডি এখনো অনুমোদন করা হয়নি। অনুমোদনের জন্য এডমিনের সাথে যোগাযোগ করুন।",
  };
  const lang = () => (localStorage.getItem("langPref") === "en" ? "en" : "bn");

  const exact = new Set([OLD.en, OLD.bn]);
  for (const s of OLD.enAlt) exact.add(s);
  // unicode-escaped / normalized variants collapse to the same trimmed text
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  const oldNorm = new Set([...exact].map(norm));
  const newFor = () => NEW[lang()];

  function swap(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const hits = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.nodeValue) continue;
      if (oldNorm.has(norm(node.nodeValue))) hits.push(node);
    }
    for (const node of hits) node.nodeValue = newFor();
    return hits.length;
  }

  // 1) swap anything already on the page
  swap(document.body);

  // 2) keep watching — React renders this string on failed logins etc.
  const mo = new MutationObserver((muts) => {
    let touched = false;
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (n.nodeType === 1) {
          if (swap(n) > 0) touched = true;
        } else if (n.nodeType === 3 && oldNorm.has(norm(n.nodeValue))) {
          n.nodeValue = newFor();
          touched = true;
        }
      }
    }
    if (touched) swap(document.body); // catch wrapper re-flows
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();

/* ===== bundle source: addons/addon.js ===== */
/* Bird-chat addon layer.
   Runs alongside the bundled React app without touching it:
   1) forced password-change modal for the seeded default admin
   2) "copy all messages" button — lives in the navbar icon group
      (falls back to a floating button if the navbar isn't there);
      txt / html / json formats — html copies with the rich look intact
   3) notice marquee fix — duration computed from the real text width
   4) admin panel — toggles for the copy button + online-users-list
      visibility and per-user force-logout (kick); admins only
   All addon UI follows the app language: the React app stores "en"/"bn"
   (default "bn") in localStorage.langPref and updates it on every change.
*/
(() => {
  "use strict";
  if (window.__bcaAddon) return;
  window.__bcaAddon = true;

  // ---------- shared helpers ----------
  const root = () => {
    let el = document.getElementById("bca-root");
    if (!el) {
      el = document.createElement("div");
      el.id = "bca-root";
      el.className = "bca-root";
      document.body.appendChild(el);
    }
    el.classList.toggle("bca-dark", isDark());
    return el;
  };
  const isDark = () => !!document.querySelector(".navbar.bg-dark");
  const t = (ms, fn) => setTimeout(fn, ms);

  // ---------- i18n ----------
  const curLang = () => (localStorage.getItem("langPref") === "en" ? "en" : "bn");
  const S = () => STRINGS[curLang()];

  const STRINGS = {
    en: {
      menuCopy: "Copy all messages",
      fabLabel: "Copy all",
      close: "Close",
      pwdTitle: "Change your password",
      pwdSub: "For security, chat can't be used with the default password. Choose a new one.",
      curPwd: "Current password",
      newPwd: "New password (at least 6 characters)",
      newPwd2: "Repeat new password",
      changeBtn: "Change password",
      changingBtn: "Changing…",
      fillAll: "Please fill in all fields",
      minSix: "The new password must be at least 6 characters",
      notMatch: "The two new passwords don't match",
      pwdChanged: "✓ Password changed — welcome!",
      noServer: "Can't reach the server",
      genericErr: "Something went wrong, please try again",
      errors: {
        "client_error.wrong_password": "The current password is incorrect",
        "client_error.passwords_not_identical_error": "The passwords don't match",
        "client_error.invalid_error": "Invalid input",
        "client_error.too_large_error": "Too large",
        "client_error.too_many_attempts": "Too many attempts — try again in a while",
        "client_error.internal_error": "Server problem",
        "client_error.admin_only": "Only admins can copy right now",
        "client_error.not_exists_error": "User not found",
      },
      copyTitle: "Copy all messages",
      copySub: "",
      fmtTxt: "📝 Clean note (TXT)",
      fmtTxtDesc: "HTML stripped, ready for a notebook",
      fmtHtml: "🎨 As shown (HTML)",
      fmtHtmlDesc: "The exact chat look — loads the full history, then copies the real page",
      fmtJson: "🧾 Raw data (JSON)",
      fmtJsonDesc: "Full details incl. reactions and edits",
      copyBtn: "📋 Copy",
      dlBtn: "⬇ Download",
      copied: (f) => `✓ Copied (${f})`,
      copyFail: "Couldn't copy — try again",
      collecting: (n) => `⏳ ${n}`,
      noMessagesYet: "No messages on screen yet",
      dlStarted: "✓ Download started",
      dlFail: "Couldn't download",
      adminMenu: "Admin panel",
      adminTitle: "Admin panel",
      adminSub: "Feature visibility and user sessions",
      copyModeLabel: "Who can use the copy button?",
      copyModeAll: "Everyone",
      copyModeAdmin: "Admins only",
      onlineModeLabel: "Who sees the online-users list?",
      onlineModeShow: "Everyone",
      onlineModeAdmin: "Admins only",
      modeAll: "Everyone",
      modeAdmin: "Admins only",
      modeAdminOnly: "Admins only",
      modeSelected: "Selected users",
      pickerCopyTitle: "Users allowed to copy",
      pickerOnlineTitle: "Users allowed to see the list",
      pickerAttendanceTitle: "Users allowed to open the attendance page",
      pickerPlaceholder: "username",
      delChatLabel: "Who may delete the whole chat history?",
      pickerDeleteTitle: "Users allowed to delete the history",
      delMenuItem: "Delete entire chat history",
      delConfirm: "Delete the ENTIRE chat history for everyone? This cannot be undone.",
      delDone: "Chat history deleted",
      delMenu: "Delete chat history",
      menuMore: "Menu",
      mediaModeLabel: "Who can send voice/photos (media)?",
      pickerMediaTitle: "Users allowed to send media",
      delCancel: "Cancel",
      noSelectedUsers: "Nobody selected yet",
      removeUser: "Remove",
      tabPermissions: "Permissions",
      tabUsers: "Users",
      tabAttendance: "Attendance counter",
      attViewLabel: "Who may open the attendance page?",
      attLinkLabel: "Attendance link",
      attOpenPage: "Attendance & notepad",
      attEditorLabel: "HTML code of the page",
      attNoteLabel: "Shared note (visible on the attendance page)",
      attNoteSave: "Save note",
      attHint: "",
      attSave: "Save code",
      attSaving: "Saving…",
      attRestore: "Restore starter page",
      attRestoreConfirm: "Replace the editor content with the starter page? Nothing is saved until you press Save code.",
      attRestoreHint: "Starter page loaded — press Save code to store it",
      attNoDefault: "No starter page available",
      attPrefillHint: "Starter page loaded — edit it and press Save code",
      sessionExpired: "Session expired — reload the page and log in again",
      tabSymbols: "Emoji set",
      symTitle: "Emoji / symbol set for the composer menu",
      symHint: "One entry per line — they appear in the chat composer's symbols menu. Click catalogue emojis to select/unselect, search, or add ANY emoji via the box below (system keyboard / paste).",
      symPickLabel: "Pick emojis (click = select, again = remove)",
      symSearch: "Search… (bn/en)",
      symAddLabel: "Any custom emoji / symbol / text",
      symAddHint: "Type or paste anything — e.g. 🙂, 🎉, or a Bengali phrase. WhatsApp-style: any emoji your keyboard can produce works.",
      symSave: "Save set",
      symDefaultSet: "Set to app default",
      symDefaultConfirm: "Replace the whole set with the app's default symbols? This saves immediately.",
      symCountSuffix: "items",
      symNoResults: "No emoji matched the search",
      reactMore: "More reactions",
      selectedCopied: "✓ Copied selection",
      reactFail: "Couldn't add the reaction — try again",
      attCopied: "✓ Link copied",
      attTooLarge: "The code is too large — shorten it a little",
      saved: "✓ Saved",
      usersTitle: "Logged-in users",
      badgeAdmin: "admin",
      badgeSuspended: "suspended",
      kickBtn: "Log out",
      kickConfirm: (n) => `Log out ${n} from all their devices?`,
      kicked: (n) => `✓ ${n} was logged out`,
      kickSelf: "You can't log yourself out here",
      noUsers: "No users found",
      noLoggedIn: "No logged-in users right now",
      fetchFail: "Couldn't load data",
    },
    bn: {
      menuCopy: "সব মেসেজ কপি করুন",
      fabLabel: "সব কপি",
      close: "বন্ধ করুন",
      pwdTitle: "পাসওয়ার্ড বদলে নিন",
      pwdSub: "নিরাপত্তার জন্য ডিফল্ট পাসওয়ার্ড দিয়ে চ্যাট ব্যবহার করা যাবে না। নতুন পাসওয়ার্ড দিন।",
      curPwd: "বর্তমান পাসওয়ার্ড",
      newPwd: "নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)",
      newPwd2: "নতুন পাসওয়ার্ড আবার",
      changeBtn: "পাসওয়ার্ড পরিবর্তন করুন",
      changingBtn: "পরিবর্তন হচ্ছে…",
      fillAll: "সব ঘর পূরণ করুন",
      minSix: "নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে",
      notMatch: "নতুন পাসওয়ার্ড দুটো মিলছে না",
      pwdChanged: "✓ পাসওয়ার্ড পরিবর্তন হয়েছে — স্বাগতম!",
      noServer: "সার্ভারে পৌঁছানো যাচ্ছে না",
      genericErr: "সমস্যা হয়েছে, আবার চেষ্টা করুন",
      errors: {
        "client_error.wrong_password": "বর্তমান পাসওয়ার্ড সঠিক নয়",
        "client_error.passwords_not_identical_error": "পাসওয়ার্ড দুটো মিলছে না",
        "client_error.invalid_error": "ইনপুট সঠিক নয়",
        "client_error.too_large_error": "খুব বড় হয়ে গেছে",
        "client_error.too_many_attempts": "অনেকবার চেষ্টা হয়েছে — কিছুক্ষণ পরে চেষ্টা করুন",
        "client_error.internal_error": "সার্ভারে সমস্যা হয়েছে",
        "client_error.admin_only": "এখন শুধু অ্যাডমিন কপি করতে পারবেন",
        "client_error.not_exists_error": "ইউজার পাওয়া যায়নি",
      },
      copyTitle: "সব মেসেজ কপি করুন",
      copySub: "",
      fmtTxt: "📝 সুন্দর নোট (TXT)",
      fmtTxtDesc: "HTML বাদ, নোট-বুকে রাখার উপযোগী",
      fmtHtml: "🎨 যেমন দেখায় (HTML)",
      fmtHtmlDesc: "চ্যাটে ঠিক যেমন দেখায় — পুরো হিস্ট্রি লোড করে আসল পেজটাই কপি হয়",
      fmtJson: "🧾 কাঁচা ডেটা (JSON)",
      fmtJsonDesc: "রিঅ্যাকশন, সম্পাদনাসহ পূর্ণ তথ্য",
      copyBtn: "📋 কপি",
      dlBtn: "⬇ ডাউনলোড",
      copied: (f) => `✓ কপি হয়েছে (${f})`,
      copyFail: "কপি করা যায়নি — আবার চেষ্টা করুন",
      collecting: (n) => `⏳ ${n}`,
      noMessagesYet: "পর্দায় এখনো কোনো মেসেজ নেই",
      dlStarted: "✓ ডাউনলোড শুরু হয়েছে",
      dlFail: "ডাউনলোড করা যায়নি",
      adminMenu: "অ্যাডমিন প্যানেল",
      adminTitle: "অ্যাডমিন প্যানেল",
      adminSub: "ফিচার দেখানো-লুকানো ও ইউজার সেশন",
      copyModeLabel: "কপি বাটন কারা ব্যবহার করতে পারবে?",
      copyModeAll: "সবাই",
      copyModeAdmin: "শুধু অ্যাডমিন",
      onlineModeLabel: "অনলাইন ইউজারের তালিকা কারা দেখবে?",
      onlineModeShow: "সবাই",
      onlineModeAdmin: "শুধু অ্যাডমিন",
      modeAll: "সবাই",
      modeAdmin: "শুধু অ্যাডমিন",
      modeAdminOnly: "শুধু অ্যাডমিন",
      modeSelected: "নির্বাচিত ইউজার",
      pickerCopyTitle: "কারা কপি করতে পারবে",
      pickerOnlineTitle: "তালিকা কারা দেখতে পারবে",
      pickerAttendanceTitle: "কাজিরা পেজ কারা খুলতে পারবে",
      pickerPlaceholder: "ইউজারনেম",
      delChatLabel: "পুরো চ্যাট-হিস্টরি কারা মুছতে পারবে?",
      pickerDeleteTitle: "হিস্টরি কারা মুছতে পারবে",
      delMenuItem: "পুরো চ্যাট-হিস্টরি মুছুন",
      delConfirm: "সবার জন্য পুরো চ্যাট-হিস্টরি মুছে ফেলবেন? এটা আর ফেরানো যাবে না।",
      delDone: "চ্যাট-হিস্টরি মুছে ফেলা হয়েছে",
      delMenu: "চ্যাট-হিস্টরি মুছুন",
      menuMore: "মেনু",
      mediaModeLabel: "ভয়েস/ছবি (মিডিয়া) কারা পাঠাতে পারবে?",
      pickerMediaTitle: "মিডিয়া কারা পাঠাতে পারবে",
      delCancel: "বাতিল",
      noSelectedUsers: "এখনো কাউকে বাছাই করা হয়নি",
      removeUser: "সরান",
      tabPermissions: "পারমিশন",
      tabUsers: "ইউজার",
      tabAttendance: "হাজিরা কাউন্টার",
      attViewLabel: "হাজিরা পেজ কারা খুলতে পারবে?",
      attLinkLabel: "হাজিরা লিংক",
      attOpenPage: "হাজিরা ও নোটপ্যাড",
      attEditorLabel: "পেজের HTML কোড",
      attNoteLabel: "শেয়ার্ড নোট (হাজিরা পেজে দেখা যাবে)",
      attNoteSave: "নোট সেভ করুন",
      attHint: "",
      attSave: "কোড সেভ করুন",
      attSaving: "সেভ হচ্ছে…",
      attRestore: "শুরুর পেজ ফিরিয়ে আনুন",
      attRestoreConfirm: "এডিটরের লেখা শুরুর পেজ দিয়ে বদলে দেব? সেভ না করলে কিছুই বদলাবে না।",
      attRestoreHint: "শুরুর পেজ লোড হয়েছে — সেভ করতে ‘কোড সেভ করুন’ চাপুন",
      attNoDefault: "কোনো শুরুর পেজ পাওয়া যায়নি",
      attPrefillHint: "শুরুর পেজটা লোড হয়েছে — দরকারমতো বদলে ‘কোড সেভ করুন’ চাপুন",
      sessionExpired: "সেশন শেষ — পেজ রিলোড করে আবার লগইন করুন",
      tabSymbols: "ইমোজি সেট",
      symTitle: "কম্পোজার মেনুর ইমোজি / সিম্বল সেট",
      symHint: "প্রতি লাইনে একটি — চ্যাট কম্পোজারের সিম্বল-মেনুতে এগুলোই দেখা যায়। ক্যাটালগের ইমোজিতে ক্লিক করলে যোগ/বাদ হয়, সার্চ করা যায়, বা নিচের ঘরে যেকোনো ইমোজি দেওয়া যায়।",
      symPickLabel: "ইমোজি বাছুন (ক্লিক = যোগ, আবার ক্লিক = বাদ)",
      symSearch: "খুঁজুন… (বাং/ইং)",
      symAddLabel: "যেকোনো কাস্টম ইমোজি / সিম্বল / লেখা",
      symAddHint: "যা খুশি লিখুন বা পেস্ট করুন — যেমন 🙂, 🎉, বা বাংলা বাক্য। হোয়াটসঅ্যাপ-স্টাইলে কিবোর্ডে যে ইমোজি আছে সবই চলবে।",
      symSave: "সেট সেভ করুন",
      symDefaultSet: "অ্যাপের ডিফল্ট সেট করুন",
      symDefaultConfirm: "পুরো সেটটা অ্যাপের ডিফল্ট সিম্বল দিয়ে বদলে দেব? সাথে সাথে সেভ হবে।",
      symCountSuffix: "টি",
      symNoResults: "এই খোঁজে কোনো ইমোজি মেলেনি",
      reactMore: "আরও রিয়েকশন",
      selectedCopied: "✓ নির্বাচিত অংশ কপি হয়েছে",
      reactFail: "রিয়েকশন দেওয়া যায়নি — আবার চেষ্টা করুন",
      attCopied: "✓ লিংক কপি হয়েছে",
      attTooLarge: "কোডটা অনেক বড় — একটু ছোট করুন",
      saved: "✓ সেভ হয়েছে",
      usersTitle: "লগইন-করা ইউজার",
      badgeAdmin: "অ্যাডমিন",
      badgeSuspended: "বন্ধ",
      kickBtn: "লগআউট",
      kickConfirm: (n) => `নিশ্চিত? ${n} তার সব ডিভাইস থেকে লগআউট হয়ে যাবে।`,
      kicked: (n) => `✓ ${n} লগআউট করা হয়েছে`,
      kickSelf: "নিজেকে এখান থেকে লগআউট করা যাবে না",
      noUsers: "কোনো ইউজার নেই",
      noLoggedIn: "এই মুহূর্তে কোনো লগইন-করা ইউজার নেই",
      fetchFail: "তথ্য আনা যায়নি",
    },
  };

  const errText = (body) =>
    (body && (S().errors[body.message] || body.message)) || S().genericErr;

  function toast(message, isErr = false) {
    const host = root();
    host.querySelectorAll(".bca-toast").forEach((x) => x.remove());
    const el = document.createElement("div");
    el.className = "bca-toast" + (isErr ? " err" : "");
    el.textContent = message;
    host.appendChild(el);
    t(3200, () => el.remove());
  }

  async function fetchMe() {
    // session state from the shared hub (ui-fixes.js owns the single
    // /api/users/me poll — owner request: এক কল, সবাই শোনে)
    const sess = window.__bcaSession;
    if (sess?.loggedIn && sess.me) return sess.me;
    return null;
  }

  // ---------- feature visibility (admin-configurable) ----------
  let meUser = null;
  /** resolved permissions come from the server: `canCopyAll` / `canSeeOnlineUsers`
      answer "may *I*, this user, do it?" — the selected-user lists never leave
      the admin API, so the addon never has to reproduce the rule */
  const DEFAULT_FEATURES = () => ({
    copyAllMode: "all",
    showOnlineUsers: "all",
    attendanceMode: "admin",
    canCopyAll: true,
    canSeeOnlineUsers: true,
    canViewAttendance: false,
    hasAttendanceHtml: false,
    supported: true,
  });
  let features = DEFAULT_FEATURES();

  const modeOf = (value, fallback) =>
    value === "admin" || value === "selected" ? value : value === "all" ? "all" : fallback;

  function applyVisibility(body, isAdmin) {
    if (!body || typeof body !== "object") return;
    features.copyAllMode = modeOf(body.copyAllMode, "all");
    features.showOnlineUsers = modeOf(body.showOnlineUsers, "all");
    features.attendanceMode = body.attendanceMode === "selected" ? "selected" : "admin";
    // an admin always keeps every feature — also true when talking to a server
    // that predates the boolean fields
    features.canCopyAll =
      typeof body.canCopyAll === "boolean" ? body.canCopyAll : features.copyAllMode === "all";
    features.canSeeOnlineUsers =
      typeof body.canSeeOnlineUsers === "boolean" ? body.canSeeOnlineUsers : features.showOnlineUsers === "all";
    features.canViewAttendance =
      typeof body.canViewAttendance === "boolean" ? body.canViewAttendance : !!isAdmin;
    // destructive feature — default stays admin-only on legacy servers
    features.deleteChatMode = modeOf(body.deleteChatMode, "admin");
    features.canDeleteAllChat =
      typeof body.canDeleteAllChat === "boolean" ? body.canDeleteAllChat : !!isAdmin;
    // media (voice/photo) — legacy servers without the field keep the
    // historical everyone-can behavior; admins always can
    features.mediaMode = modeOf(body.mediaMode, "all");
    features.canUseMedia =
      typeof body.canUseMedia === "boolean" ? body.canUseMedia : true;
    features.hasAttendanceHtml = body.hasAttendanceHtml === true;
    features.supported = true;
  }

  async function refreshFeatures() {
    try {
      const res = await fetch("/api/chat/visibility", { credentials: "same-origin" });
      if (res.status === 404) {
        // backend without this endpoint (older build) — hide the admin panel
        // and the html format, keep the classic copy working
        features.supported = false;
        return;
      }
      if (!res.ok) return; // transient — keep the last known values
      applyVisibility(await res.json().catch(() => null), !!meUser?.isAdmin);
    } catch {
      /* transient — keep the last known values */
    }
  }
  const copyAllowed = () => !!(meUser && (meUser.isAdmin || features.canCopyAll));

  // ==================================================================
  // 1) forced password change (seeded default admin, first login)
  // ==================================================================
  function showForceChangeModal() {
    const s = S();
    const host = root();
    if (host.querySelector(".bca-overlay")) return;

    const overlay = document.createElement("div");
    overlay.className = "bca-overlay";
    overlay.innerHTML = `
      <div class="bca-modal" role="dialog" aria-modal="true">
        <div class="bca-shield">🔐</div>
        <h2></h2>
        <p class="bca-sub"></p>
        <div class="bca-err"></div>
        <div class="bca-field">
          <label></label>
          <input type="password" name="cur" autocomplete="current-password" autofocus>
        </div>
        <div class="bca-field">
          <label></label>
          <input type="password" name="new1" autocomplete="new-password">
        </div>
        <div class="bca-field">
          <label></label>
          <input type="password" name="new2" autocomplete="new-password">
        </div>
        <button class="bca-btn" type="button"></button>
      </div>`;
    // text via textContent (strings contain no markup, but stay XSS-clean)
    overlay.querySelector("h2").textContent = s.pwdTitle;
    overlay.querySelector(".bca-sub").textContent = s.pwdSub;
    const labels = overlay.querySelectorAll(".bca-field label");
    labels[0].textContent = s.curPwd;
    labels[1].textContent = s.newPwd;
    labels[2].textContent = s.newPwd2;
    const btn = overlay.querySelector("button.bca-btn");
    btn.textContent = s.changeBtn;
    host.appendChild(overlay);

    const err = overlay.querySelector(".bca-err");
    const inputs = overlay.querySelectorAll("input");
    const fail = (msg) => { err.textContent = msg; err.classList.add("show"); };

    const submit = async () => {
      const [cur, n1, n2] = [...inputs].map((i) => i.value);
      err.classList.remove("show");
      if (!cur || !n1 || !n2) return fail(s.fillAll);
      if (n1.length < 6) return fail(s.minSix);
      if (n1 !== n2) return fail(s.notMatch);
      btn.disabled = true;
      btn.textContent = s.changingBtn;
      try {
        const res = await fetch("/api/changePassword", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPassword: cur, password: n1 }),
        });
        const body = await res.json().catch(() => null);
        if (res.ok) {
          overlay.remove();
          toast(s.pwdChanged);
          t(600, () => location.reload());
        } else {
          fail(errText(body));
          btn.disabled = false;
          btn.textContent = s.changeBtn;
        }
      } catch {
        fail(s.noServer);
        btn.disabled = false;
        btn.textContent = s.changeBtn;
      }
    };
    btn.addEventListener("click", submit);
    overlay.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
    t(50, () => inputs[0].focus());
  }

  // ==================================================================
  // 2) copy-all-messages button (navbar icon group) + popup
  // ==================================================================
  let outsideHandler = null;
  let escapeHandler = null;

  function closePopup() {
    root().querySelectorAll(".bca-popup").forEach((p) => p.remove());
    if (outsideHandler) { document.removeEventListener("click", outsideHandler); outsideHandler = null; }
    if (escapeHandler) { document.removeEventListener("keydown", escapeHandler); escapeHandler = null; }
  }

  function watchPopup(pop, openerSelector) {
    const closeBtn = pop.querySelector(".bca-close");
    closeBtn.title = S().close;
    closeBtn.setAttribute("aria-label", S().close);
    closeBtn.addEventListener("click", closePopup);
    outsideHandler = (e) => {
      if (!pop.contains(e.target) && !e.target.closest(openerSelector)) closePopup();
    };
    escapeHandler = (e) => { if (e.key === "Escape") closePopup(); };
    t(30, () => {
      document.addEventListener("click", outsideHandler);
      document.addEventListener("keydown", escapeHandler);
    });
  }

  // ---------- "as shown" HTML export: capture the real chat DOM ----------
  // no hand-made template — the live React nodes themselves are cloned, so the
  // copy looks exactly like the browser. Full history is loaded by auto-
  // scrolling to the top (the app fetches older pages while scrolling).
  const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

  function messageNodes() {
    return [...document.querySelectorAll('div[id^="message-"]')];
  }

  function findChatScroller() {
    let el = messageNodes()[0]?.parentElement;
    while (el && el !== document.body) {
      const cs = getComputedStyle(el);
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 50) return el;
      el = el.parentElement;
    }
    return null;
  }

  function cleanMessageClone(node) {
    // keep the node EXACTLY as the browser renders it — the user pastes the
    // raw rendered html (position/top included); nothing is flattened here
    return node;
  }

  async function captureMessagesHtml(progress) {
    if (!messageNodes().length) throw new Error("no messages on screen");
    const scroller = findChatScroller();
    const seen = new Map(); // id -> clone (virtualization may unmount as we scroll)
    const grab = () => {
      for (const n of messageNodes()) {
        const id = parseInt(n.id.slice("message-".length), 10);
        if (Number.isFinite(id) && !seen.has(id)) seen.set(id, n.cloneNode(true));
      }
    };
    grab();
    const wasAt = scroller ? scroller.scrollTop : 0;
    if (scroller) {
      let stale = 0;
      let prev = seen.size;
      for (let i = 0; i < 400 && stale < 5; i++) {
        scroller.scrollTop = 0; // jumping to the top makes the app page in older history
        await sleepMs(320);
        grab();
        if (progress) progress(seen.size);
        if (seen.size === prev) stale++;
        else { stale = 0; prev = seen.size; }
      }
      scroller.scrollTop = scroller.scrollHeight; // back to the live bottom
      void wasAt;
    }
    // the copy IS the rendered fragments — byte-for-byte what the browser has,
    // one <div id="message-N">…</div> per message, joined in id order
    const parts = [];
    for (const id of [...seen.keys()].sort((a, b) => a - b)) {
      parts.push(cleanMessageClone(seen.get(id)).outerHTML);
    }
    return parts.join("");
  }

  // ---------- delete-history: ONE shared flow for every entry point ----------
  // Owner report 2026-11-09: the delete option lived inside the copy popup,
  // which never renders without copy permission — a delete-permitted user
  // then had NO reachable path. Now both the copy popup's inline option and
  // the standalone navbar button open this same confirm popup; the real
  // guard stays server-side (deleteChatMode).
  function showDeletePopup() {
    closePopup();
    const s = S();
    const host = root();
    const pop = document.createElement("div");
    pop.className = "bca-popup bca-delpop";
    pop.innerHTML = `
      <button class="bca-close" type="button">✕</button>
      <h3></h3>
      <p class="bca-delwarn"></p>
      <div class="bca-actions">
        <button class="bca-btn bca-danger" data-act="del" type="button"></button>
        <button class="bca-btn ghost" data-act="cancel" type="button"></button>
      </div>`;
    pop.querySelector("h3").textContent = s.delMenu;
    pop.querySelector(".bca-delwarn").textContent = s.delConfirm;
    const delBtn = pop.querySelector('[data-act="del"]');
    delBtn.textContent = s.delMenuItem;
    pop.querySelector('[data-act="cancel"]').textContent = s.delCancel;
    pop.querySelector('[data-act="cancel"]').addEventListener("click", closePopup);
    host.appendChild(pop);
    watchPopup(pop, ".bca-fab, .bca-navcopy, .bca-navdel");
    delBtn.addEventListener("click", async () => {
      delBtn.disabled = true;
      try {
        const res = await fetch("/api/chat/delete", { method: "DELETE", credentials: "same-origin" });
        if (res.ok) { closePopup(); toast(s.delDone); }
        else {
          const body = await res.json().catch(() => null);
          toast(body && body.message ? errText(body) : S().genericErr, true);
        }
      } catch { toast(S().genericErr, true); }
      finally { delBtn.disabled = false; }
    });
  }

  /** the shared DELETE action used by every entry point */
  async function deleteAllChat() { showDeletePopup(); }

  function showExportPopup() {
    closePopup();
    const s = S();
    const host = root();
    const pop = document.createElement("div");
    pop.className = "bca-popup";
    pop.innerHTML = `
      <button class="bca-close" type="button">✕</button>
      <h3></h3>
      <p class="bca-sub"></p>
      <div class="bca-format">
        <label>
          <input type="radio" name="bca-fmt" value="txt" checked>
          <span><span class="bca-fmt-title"></span><br>
          <span class="bca-fmt-desc"></span></span>
        </label>
        <label class="bca-fmt-html">
          <input type="radio" name="bca-fmt" value="html">
          <span><span class="bca-fmt-title"></span><br>
          <span class="bca-fmt-desc"></span></span>
        </label>
        <label>
          <input type="radio" name="bca-fmt" value="json">
          <span><span class="bca-fmt-title"></span><br>
          <span class="bca-fmt-desc"></span></span>
        </label>
      </div>
      <div class="bca-actions">
        <button class="bca-btn" data-act="copy" type="button"></button>
        <button class="bca-btn ghost" data-act="download" type="button"></button>
      </div>`;
    pop.querySelector("h3").textContent = s.copyTitle;
    const subEl = pop.querySelector(".bca-sub");
    subEl.textContent = s.copySub || "";
    subEl.style.display = s.copySub ? "" : "none"; // খালি হলে লুকানো — বাটনের জায়গা নষ্ট নয়
    const titles = pop.querySelectorAll(".bca-fmt-title");
    const descs = pop.querySelectorAll(".bca-fmt-desc");
    titles[0].textContent = s.fmtTxt;
    descs[0].textContent = s.fmtTxtDesc;
    titles[1].textContent = s.fmtHtml;
    descs[1].textContent = s.fmtHtmlDesc;
    titles[2].textContent = s.fmtJson;
    descs[2].textContent = s.fmtJsonDesc;
    if (!features.supported) pop.querySelector(".bca-fmt-html").style.display = "none";
    const buttons = pop.querySelectorAll(".bca-actions .bca-btn");
    buttons[0].textContent = s.copyBtn;
    buttons[1].textContent = s.dlBtn;
    host.appendChild(pop);
    watchPopup(pop, ".bca-fab, .bca-navcopy");

    const fmt = () => pop.querySelector("input[name=bca-fmt]:checked").value;

    const loadExport = async (format) => {
      const res = await fetch(`/api/chat/export?format=${format}&lang=${curLang()}`, { credentials: "same-origin" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw Object.assign(new Error("export failed"), { body });
      }
      return { format, text: await res.text() };
    };

    const writeRich = async (html, plain) => {
      // rich paste (Word, Mail, Notion, WhatsApp-web…): text/html flavor with
      // a text/plain twin; falls back to the html source as plain text
      const richSupported =
        window.ClipboardItem &&
        navigator.clipboard &&
        (!ClipboardItem.supports || ClipboardItem.supports("text/html"));
      if (richSupported) {
        await navigator.clipboard.write([new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" }),
        })]);
        return;
      }
      await writePlain(html);
    };

    const writePlain = async (text) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
    };

    const copy = async () => {
      buttons.forEach((b) => (b.disabled = true));
      try {
        const format = fmt();
        if (format === "html") {
          const html = await captureMessagesHtml((n) => { buttons[0].textContent = s.collecting(n); });
          // both clipboard flavors carry the SAME raw fragments the download
          // saves — a paste target that prefers text/plain must not swap in
          // the txt note instead
          await writeRich(html, html);
        } else {
          const { text } = await loadExport(format);
          await writePlain(text);
        }
        closePopup();
        toast(s.copied(format.toUpperCase()));
      } catch (err) {
        toast(err?.body ? errText(err.body) : err?.message === "no messages on screen" ? s.noMessagesYet : s.copyFail, true);
      } finally {
        buttons[0].textContent = s.copyBtn;
        buttons.forEach((b) => (b.disabled = false));
      }
    };

    const download = async () => {
      buttons.forEach((b) => (b.disabled = true));
      try {
        const format = fmt();
        let text;
        if (format === "html") text = await captureMessagesHtml((n) => { buttons[1].textContent = s.collecting(n); });
        else text = (await loadExport(format)).text;
        const d = new Date();
        const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
        const mime = format === "json" ? "application/json" : format === "html" ? "text/html;charset=utf-8" : "text/plain;charset=utf-8";
        const blob = new Blob([text], { type: mime });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `chat-export-${stamp}.${format}`;
        a.click();
        t(1500, () => URL.revokeObjectURL(a.href));
        closePopup();
        toast(s.dlStarted);
      } catch {
        toast(s.dlFail, true);
      } finally {
        buttons[1].textContent = s.dlBtn;
        buttons.forEach((b) => (b.disabled = false));
      }
    };

    buttons[0].addEventListener("click", copy);
    buttons[1].addEventListener("click", download);

    // owner request 2026-11-08: those with delete-permission get the option
    // right here — same popup, guarded server-side by deleteChatMode
    if (loggedIn && features.supported && features.canDeleteAllChat) {
      const del = document.createElement("button");
      del.type = "button";
      del.className = "bca-btn bca-danger";
      del.textContent = s.delMenuItem;
      pop.querySelector(".bca-actions").appendChild(del);
      del.addEventListener("click", () => { closePopup(); deleteAllChat(); });
    }
  }

  // ==================================================================
  // 2b) admin panel — three-mode feature permissions, the per-feature
  //     user picker, the attendance-counter editor, per-user force-logout
  // ==================================================================

  /** tick the radio matching `value` inside a mode segment */
  const checkRadio = (seg, value) => {
    if (!seg) return;
    const input = seg.querySelector(`input[value="${value}"]`);
    if (input) input.checked = true;
  };

  /** three-way permission control: everyone / admins only / hand-picked users */
  function modeSegment(name, labels) {
    const wrap = document.createElement("div");
    wrap.className = "bca-opts";
    for (const [value, label] of labels) {
      const lab = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = name;
      input.value = value;
      const span = document.createElement("span");
      span.textContent = label;
      lab.appendChild(input);
      lab.appendChild(span);
      wrap.appendChild(lab);
    }
    return wrap;
  }

  /**
   * Username picker: every account as a checkbox plus a free-text box for a
   * name that is not in the list yet (useful before the person registers).
   */
  function userPicker(title, placeholder, initial) {
    const s = S();
    const box = document.createElement("div");
    box.className = "bca-picker";
    const head = document.createElement("div");
    head.className = "bca-setting-label";
    head.textContent = title;
    box.appendChild(head);

    const chips = document.createElement("div");
    chips.className = "bca-chips";
    box.appendChild(chips);

    const entry = document.createElement("div");
    entry.className = "bca-picker-entry";
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = placeholder;
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "bca-mini";
    addBtn.textContent = "+";
    entry.appendChild(input);
    entry.appendChild(addBtn);
    box.appendChild(entry);

    const list = document.createElement("div");
    list.className = "bca-picker-list";
    box.appendChild(list);

    const state = new Set(
      (Array.isArray(initial) ? initial : []).map((n) => String(n).trim()).filter(Boolean)
    );

    const handlers = [];
    const emit = () => handlers.forEach((fn) => fn());

    const renderChips = () => {
      chips.innerHTML = "";
      if (!state.size) {
        const none = document.createElement("span");
        none.className = "bca-chips-empty";
        none.textContent = s.noSelectedUsers;
        chips.appendChild(none);
        return;
      }
      for (const name of [...state]) {
        const chip = document.createElement("span");
        chip.className = "bca-chip";
        const label = document.createElement("span");
        label.textContent = name;
        const x = document.createElement("button");
        x.type = "button";
        x.className = "bca-chip-x";
        x.textContent = "✕";
        x.title = s.removeUser;
        x.setAttribute("aria-label", s.removeUser);
        x.addEventListener("click", () => {
          state.delete(name);
          renderChips();
          syncBoxes();
          emit();
        });
        chip.appendChild(label);
        chip.appendChild(x);
        chips.appendChild(chip);
      }
    };

    const boxes = new Map();
    const syncBoxes = () => {
      for (const [name, cb] of boxes) cb.checked = state.has(name);
    };

    const add = (raw) => {
      const name = String(raw || "").trim().slice(0, 50);
      if (!name) return;
      if ([...state].some((n) => n.toLowerCase() === name.toLowerCase())) return;
      state.add(name);
      input.value = "";
      renderChips();
      syncBoxes();
      emit();
    };

    addBtn.addEventListener("click", () => add(input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        add(input.value);
      }
    });

    // the account list needs the admin API; when it is unavailable the free
    // text box still lets the admin pick any username
    const loadAccounts = async () => {
      list.textContent = "…";
      try {
        const res = await fetch("/api/users", { credentials: "same-origin" });
        if (!res.ok) {
          list.textContent = "";
          return;
        }
        const users = await res.json();
        list.innerHTML = "";
        for (const u of Array.isArray(users) ? users : []) {
          const username = u.username || "";
          if (!username) continue;
          const lab = document.createElement("label");
          lab.className = "bca-picker-item";
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = state.has(username);
          cb.addEventListener("change", () => {
            if (cb.checked) {
              state.add(username);
            } else {
              for (const n of [...state]) {
                if (n.toLowerCase() === username.toLowerCase()) state.delete(n);
              }
            }
            renderChips();
            emit();
          });
          boxes.set(username, cb);
          const span = document.createElement("span");
          span.textContent = username;
          lab.appendChild(cb);
          lab.appendChild(span);
          if (u.isAdmin) {
            const b = document.createElement("span");
            b.className = "bca-badge admin";
            b.textContent = s.badgeAdmin;
            lab.appendChild(b);
          }
          list.appendChild(lab);
        }
      } catch {
        list.textContent = "";
      }
    };

    renderChips();
    loadAccounts();

    return {
      el: box,
      values: () => [...state],
      onChange: (fn) => handlers.push(fn),
      setValues: (names) => {
        for (const name of names) state.add(String(name).trim());
        renderChips();
        loadAccounts(); // refresh the checkbox list too (kept in userPicker scope)
      },
    };
  }

  async function showAdminPanel() {
    closePopup();
    const s = S();
    const host = root();
    const pop = document.createElement("div");
    pop.className = "bca-popup bca-admin";
    pop.innerHTML = `
      <button class="bca-close" type="button">✕</button>
      <h3></h3>
      <p class="bca-sub"></p>
      <div class="bca-tabs" role="tablist">
        <button type="button" class="bca-tab on" data-tab="perm"></button>
        <button type="button" class="bca-tab" data-tab="users"></button>
        <button type="button" class="bca-tab" data-tab="attendance"></button>
        <button type="button" class="bca-tab" data-tab="symbols"></button>
      </div>
      <div class="bca-tabpanel" data-panel="perm"></div>
      <div class="bca-tabpanel" data-panel="users" hidden></div>
      <div class="bca-tabpanel" data-panel="attendance" hidden></div>
      <div class="bca-tabpanel" data-panel="symbols" hidden></div>`;
    pop.querySelector("h3").textContent = s.adminTitle;
    pop.querySelector(".bca-sub").textContent = s.adminSub;
    const tabLabels = [s.tabPermissions, s.tabUsers, s.tabAttendance, s.tabSymbols];
    pop.querySelectorAll(".bca-tab").forEach((tab, i) => (tab.textContent = tabLabels[i]));
    host.appendChild(pop);
    watchPopup(pop, ".bca-navadmin");

    const permPane = pop.querySelector('[data-panel="perm"]');
    const usersPane = pop.querySelector('[data-panel="users"]');
    const attendancePane = pop.querySelector('[data-panel="attendance"]');
    const symbolsPane = pop.querySelector('[data-panel="symbols"]');

    pop.querySelectorAll(".bca-tab").forEach((tab) =>
      tab.addEventListener("click", () => {
        pop.querySelectorAll(".bca-tab").forEach((x) => x.classList.toggle("on", x === tab));
        pop.querySelectorAll(".bca-tabpanel").forEach((pane) => {
          pane.hidden = pane.dataset.panel !== tab.dataset.tab;
        });
      })
    );

    // every pane is built up-front — the attendance editor loads its own
    // document, so it is ready the moment the tab is opened
    buildAttendancePane(attendancePane);
    buildSymbolsPane(symbolsPane);

    // ---------- shared save ----------
    const applyServerState = (next) => {
      if (!next || typeof next !== "object") return;
      features.copyAllMode =
        next.copyAllMode === "admin" ? "admin" : next.copyAllMode === "selected" ? "selected" : "all";
      features.showOnlineUsers =
        next.showOnlineUsers === "admin" ? "admin" : next.showOnlineUsers === "selected" ? "selected" : "all";
      features.attendanceMode = next.attendanceMode === "selected" ? "selected" : "admin";
      if (typeof next.canCopyAll === "boolean") features.canCopyAll = next.canCopyAll;
      if (typeof next.canSeeOnlineUsers === "boolean") features.canSeeOnlineUsers = next.canSeeOnlineUsers;
      if (typeof next.canViewAttendance === "boolean") features.canViewAttendance = next.canViewAttendance;
      if (typeof next.hasAttendanceHtml === "boolean") features.hasAttendanceHtml = next.hasAttendanceHtml;
      features.supported = true;
    };

    const save = async (body, onFail) => {
      try {
        const res = await fetch("/api/chat/admin-settings", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("save failed");
        applyServerState(await res.json().catch(() => null));
        ensureNavButtons();
        applyUsersPanelVisibility();
        toast(s.saved);
        return true;
      } catch {
        if (onFail) onFail();
        toast(s.fetchFail, true);
        return false;
      }
    };

    /** one feature block: label + three-mode segment (+ optional user picker) */
    const featureBlock = (labelText, segName, mode, picker) => {
      const wrap = document.createElement("div");
      wrap.className = "bca-setting";
      const label = document.createElement("div");
      label.className = "bca-setting-label";
      label.textContent = labelText;
      const seg = modeSegment(segName, [
        ["all", s.modeAll],
        ["admin", s.modeAdmin],
        ["selected", s.modeSelected],
      ]);
      wrap.appendChild(label);
      wrap.appendChild(seg);
      if (picker) wrap.appendChild(picker.el);
      permPane.appendChild(wrap);
      return seg;
    };

    // the selected-user lists stay behind the admin API — load them so the
    // pickers show the current selections on every device
    let lists = null;
    try {
      const res = await fetch("/api/chat/admin-settings", { credentials: "same-origin" });
      if (res.ok) lists = await res.json().catch(() => null);
    } catch { /* fall back to the resolved visibility values */ }

    const copyMode = lists?.copyAllMode || features.copyAllMode;
    const onlineMode = lists?.showOnlineUsers || features.showOnlineUsers;
    const copyPicker = userPicker(s.pickerCopyTitle, s.pickerPlaceholder, lists?.copyAllSelected || []);
    const copySeg = featureBlock(s.copyModeLabel, "bca-copymode", copyMode, copyPicker);

    const onlinePicker = userPicker(s.pickerOnlineTitle, s.pickerPlaceholder, lists?.onlineUsersSelected || []);
    const onlineSeg = featureBlock(s.onlineModeLabel, "bca-online", onlineMode, onlinePicker);

    checkRadio(copySeg, copyMode);
    checkRadio(onlineSeg, onlineMode);

    copySeg.querySelectorAll("input").forEach((input) =>
      input.addEventListener("change", () =>
        save({ copyAllMode: input.value, copyAllSelected: copyPicker.values() }, () =>
          checkRadio(copySeg, features.copyAllMode)
        )
      )
    );
    onlineSeg.querySelectorAll("input").forEach((input) =>
      input.addEventListener("change", () =>
        save({ showOnlineUsers: input.value, onlineUsersSelected: onlinePicker.values() }, () =>
          checkRadio(onlineSeg, features.showOnlineUsers)
        )
      )
    );
    copyPicker.onChange(() => save({ copyAllSelected: copyPicker.values() }));
    onlinePicker.onChange(() => save({ onlineUsersSelected: onlinePicker.values() }));

    // owner request 2026-11-08: who may delete the WHOLE chat history
    const deleteMode = lists?.deleteChatMode || "admin";
    const deletePicker = userPicker(s.pickerDeleteTitle, s.pickerPlaceholder, lists?.deleteChatSelected || []);
    const deleteSeg = featureBlock(s.delChatLabel, "bca-delmode", deleteMode, deletePicker);
    checkRadio(deleteSeg, deleteMode);
    deleteSeg.querySelectorAll("input").forEach((input) =>
      input.addEventListener("change", () =>
        save({ deleteChatMode: input.value, deleteChatSelected: deletePicker.values() }, () =>
          checkRadio(deleteSeg, features.deleteChatMode || "admin")
        )
      )
    );
    deletePicker.onChange(() => save({ deleteChatSelected: deletePicker.values() }));

    // owner request 2026-11-09: media (voice/photo) on/off per feature —
    // the deleteChat twin; admins always can, default "all" keeps the
    // historical behavior on servers without these fields
    const mediaMode = lists?.mediaMode || "all";
    const mediaPicker = userPicker(s.pickerMediaTitle, s.pickerPlaceholder, lists?.mediaSelected || []);
    const mediaSeg = featureBlock(s.mediaModeLabel, "bca-mediamode", mediaMode, mediaPicker);
    checkRadio(mediaSeg, mediaMode);
    mediaSeg.querySelectorAll("input").forEach((input) =>
      input.addEventListener("change", () =>
        save({ mediaMode: input.value, mediaSelected: mediaPicker.values() }, () =>
          checkRadio(mediaSeg, features.mediaMode || "all")
        )
      )
    );
    mediaPicker.onChange(() => save({ mediaSelected: mediaPicker.values() }));

    // ---------- users tab: force-logout ----------
    usersPane.innerHTML = `
      <div class="bca-users">
        <div class="bca-setting-label"></div>
        <div class="bca-userlist"><div class="bca-userlist-note"></div></div>
      </div>`;
    usersPane.querySelector(".bca-setting-label").textContent = s.usersTitle;
    const list = usersPane.querySelector(".bca-userlist");
    const note = (msg) => {
      list.innerHTML = "";
      const d = document.createElement("div");
      d.className = "bca-userlist-note";
      d.textContent = msg;
      list.appendChild(d);
    };

    const kick = async (username, btn) => {
      if (!window.confirm(s.kickConfirm(username))) return;
      btn.disabled = true;
      try {
        const res = await fetch("/api/users/kick", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          toast(errText(body), true);
        } else {
          toast(s.kicked(username));
          loadUsers();
        }
      } catch {
        toast(s.fetchFail, true);
      } finally {
        btn.disabled = false;
      }
    };

    async function loadUsers() {
      note("…");
      try {
        const res = await fetch("/api/users", { credentials: "same-origin" });
        if (!res.ok) return note(s.fetchFail);
        const users = await res.json();
        if (!Array.isArray(users) || users.length === 0) return note(s.noUsers);
        // kicking only makes sense for users who are actually logged in —
        // servers that don't flag sessions yet (old build) fall back to showing all
        const hasFlag = users.some((u) => typeof u.loggedIn === "boolean");
        const shown = hasFlag ? users.filter((u) => u.loggedIn) : users;
        if (shown.length === 0) return note(s.noLoggedIn);
        list.innerHTML = "";
        for (const u of shown) {
          const row = document.createElement("div");
          row.className = "bca-user";
          const name = document.createElement("span");
          name.className = "bca-user-name";
          name.textContent = u.username || "?";
          row.appendChild(name);
          if (u.isAdmin) {
            const b = document.createElement("span");
            b.className = "bca-badge admin";
            b.textContent = s.badgeAdmin;
            row.appendChild(b);
          }
          if (u.active === false) {
            const b = document.createElement("span");
            b.className = "bca-badge suspended";
            b.textContent = s.badgeSuspended;
            row.appendChild(b);
          }
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "bca-kick";
          btn.textContent = s.kickBtn;
          const self = (u.username || "").toLowerCase() === (meUser?.username || "").toLowerCase();
          if (self) {
            btn.disabled = true;
            btn.title = s.kickSelf;
          } else {
            btn.addEventListener("click", () => kick(u.username, btn));
          }
          row.appendChild(btn);
          list.appendChild(row);
        }
      } catch {
        note(s.fetchFail);
      }
    }
    loadUsers();

  }

  /** attendance-counter section: view permissions, the link, the html editor */
  function buildAttendancePane(pane) {
    const s = S();
    pane.innerHTML = `
      <div class="bca-setting">
        <div class="bca-setting-label bca-att-view-label"></div>
        <div class="bca-opts-slot"></div>
        <div class="bca-picker-slot"></div>
      </div>
      <div class="bca-setting">
        <div class="bca-setting-label bca-att-link-label"></div>
        <div class="bca-linkrow">
          <a class="bca-att-link" target="_blank" rel="noopener"></a>
          <button type="button" class="bca-mini bca-copy-link"></button>
        </div>
        <div class="bca-hint bca-att-note"></div>
      </div>
      <div class="bca-setting">
        <div class="bca-setting-label bca-att-editor-label"></div>
        <textarea class="bca-editor" spellcheck="false" wrap="off"></textarea>
        <div class="bca-editor-bar">
          <span class="bca-editor-count"></span>
          <span class="bca-editor-msg"></span>
          <button type="button" class="bca-btn bca-att-save"></button>
          <button type="button" class="bca-mini bca-att-default"></button>
        </div>
      </div>`;

    pane.querySelector(".bca-att-view-label").textContent = s.attViewLabel;
    pane.querySelector(".bca-att-link-label").textContent = s.attLinkLabel;
    pane.querySelector(".bca-att-editor-label").textContent = s.attEditorLabel;
    const noteEl = pane.querySelector(".bca-att-note");
    noteEl.textContent = s.attHint || "";
    noteEl.style.display = s.attHint ? "" : "none"; // hint কাটা → এলিমেন্ট লুকানো (কোনো ফাঁকা জায়গা নয়)

    const url = location.origin + "/attendance";
    const link = pane.querySelector(".bca-att-link");
    link.href = "/attendance";
    link.textContent = url;
    const copyLink = pane.querySelector(".bca-copy-link");
    copyLink.textContent = s.attCopyLink;

    const saveBtn = pane.querySelector(".bca-att-save");
    saveBtn.textContent = s.attSave;
    const defBtn = pane.querySelector(".bca-att-default");
    defBtn.textContent = s.attRestore;
    const editor = pane.querySelector(".bca-editor");
    const count = pane.querySelector(".bca-editor-count");
    const msg = pane.querySelector(".bca-editor-msg");

    let defaultHtml = "";
    let limit = 300000;

    const seg = modeSegment("bca-attmode", [
      ["admin", s.modeAdminOnly],
      ["selected", s.modeSelected],
    ]);
    pane.querySelector(".bca-opts-slot").appendChild(seg);

    const picker = userPicker(s.pickerAttendanceTitle, s.pickerPlaceholder, features.attendanceSelected || []);
    pane.querySelector(".bca-picker-slot").appendChild(picker.el);

    // the selected list lives behind the admin API — load it so the picker
    // shows the CURRENTLY saved users when the panel opens (owner report:
    // ticks vanished after reopening). Also re-syncs the mode radio.
    (async () => {
      try {
        const res = await fetch("/api/chat/admin-settings", { credentials: "same-origin" });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!data) return;
        if (Array.isArray(data.attendanceSelected) && data.attendanceSelected.length)
          picker.setValues(data.attendanceSelected);
        if (data.attendanceMode) checkRadio(seg, data.attendanceMode);
      } catch { /* transient — picker starts empty */ }
    })();

    const paintCount = () => {
      count.textContent = `${editor.value.length.toLocaleString()} / ${limit.toLocaleString()}`;
      count.classList.toggle("over", editor.value.length > limit);
    };
    editor.addEventListener("input", () => {
      paintCount();
      msg.textContent = "";
    });

    const fill = (data) => {
      if (!data || typeof data !== "object") return;
      features.attendanceMode = data.attendanceViewMode === "selected" ? "selected" : "admin";
      features.attendanceSelected = Array.isArray(data.attendanceSelected) ? data.attendanceSelected : [];
      features.supported = true;
      checkRadio(seg, features.attendanceMode);
      defaultHtml = typeof data.defaultHtml === "string" ? data.defaultHtml : "";
      limit = Number(data.limit) > 0 ? Number(data.limit) : limit;
      const saved = typeof data.attendanceHtml === "string" ? data.attendanceHtml : "";
      // a fresh store used to show a BLANK box — prefill with the built-in
      // starter page so the admin always sees the code they are about to save
      editor.value = saved || defaultHtml;
      msg.textContent = !saved && defaultHtml ? s.attPrefillHint : "";
      paintCount();
    };

    const savePermissions = async (body) => {
      try {
        const res = await fetch("/api/chat/admin-settings", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("save failed");
        const next = await res.json().catch(() => null);
        if (next) {
          features.attendanceMode = next.attendanceMode === "selected" ? "selected" : "admin";
          if (typeof next.canViewAttendance === "boolean") features.canViewAttendance = next.canViewAttendance;
          if (typeof next.hasAttendanceHtml === "boolean") features.hasAttendanceHtml = next.hasAttendanceHtml;
        }
        toast(s.saved);
      } catch {
        toast(s.fetchFail, true);
      }
    };

    seg.querySelectorAll("input").forEach((input) =>
      input.addEventListener("change", () =>
        savePermissions({ attendanceViewMode: input.value, attendanceSelected: picker.values() })
      )
    );
    picker.onChange(() => savePermissions({ attendanceSelected: picker.values() }));

    copyLink.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(url);
        toast(s.attCopied);
      } catch {
        toast(url);
      }
    });

    saveBtn.addEventListener("click", () => saveNow());

    async function saveNow() {
      if (editor.value.length > limit) {
        msg.textContent = s.attTooLarge;
        return;
      }
      saveBtn.disabled = true;
      const label = saveBtn.textContent;
      saveBtn.textContent = s.attSaving;
      msg.textContent = "";
      try {
        const res = await fetch("/api/chat/attendance", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attendanceHtml: editor.value }),
        });
        if (res.status === 401) {
          // session died (server restart / 10h expiry) — say what actually happened
          msg.textContent = s.sessionExpired;
          toast(s.sessionExpired, true);
        } else if (!res.ok) {
          const body = await res.json().catch(() => null);
          msg.textContent = body?.errorMessage ? errText(body) : s.fetchFail;
          toast(s.fetchFail, true);
        } else {
          const data = await res.json().catch(() => null);
          // the save itself already succeeded — a fill hiccup must NOT show
          // "can't reach the server" over a 200 response
          try { fill(data); } catch (err) { console.error("attendance fill failed", err); }
          msg.textContent = s.saved;
          toast(s.saved);
        }
      } catch {
        msg.textContent = s.noServer;
        toast(s.noServer, true);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = label;
      }
    };

    defBtn.addEventListener("click", async () => {
      if (!defaultHtml) return toast(s.attNoDefault, true);
      if (!window.confirm(s.attRestoreConfirm)) return;
      editor.value = defaultHtml;
      paintCount();
      await saveNow(); // restore = replace AND save, so the page actually reverts
    });

    // load the current document
    (async () => {
      try {
        const res = await fetch("/api/chat/attendance", { credentials: "same-origin" });
        if (res.status === 401) {
          msg.textContent = s.sessionExpired;
          return;
        }
        if (!res.ok) return;
        fill(await res.json());
      } catch {
        /* transient — the editor simply stays empty */
      }
    })();
  }

  // ---------- navbar icons  }

  // ==================================================================
  // 2d) emoji / symbol set — the app renders one entry per line in the
  //     composer's "frequently used symbols" menu; this pane edits that
  //     exact document (text emojis, unicode, Bengali tags AND raw html)
  // ==================================================================
  // WhatsApp/Messenger-style catalogue — categories mirror the big pickers,
  // each entry is [name for search, emoji]. Names are bn+en so search works
  // in both app languages.
  const EMOJI_CATEGORIES = [
    {
      key: "smileys", label: { en: "Smileys", bn: "মুখ" }, icon: "😀",
      items: [
        ["হাসি smile", "😀"], ["দাঁতহাসি grin", "😁"], ["হাসি-কান্না lol", "😂"], ["মেঝেতে-গড়া rofl", "🤣"],
        ["হাসি smile", "😊"], ["চোখ-ঝলক-ish", "😍"], ["চুম্বন kiss", "😘"], ["সামান্য-হাসি slight", "🙂"],
        ["ঠোঁট-কামড় wink", "😉"], ["সানগ্লাস cool", "😎"], ["তারা-চোখ star", "🤩"], ["পার্টি party", "🥳"],
        ["কান্না cry", "😢"], ["ঝরে-কাঁদা sob", "😭"], ["রাগ angry", "😡"], ["ভাবুন think", "🤔"],
        ["জড়িয়ে hug", "🤗"], ["শ্রদ্ধা pray", "🙏"], ["থামুন stop", "🤚"], ["আশীর্বাদ bless", "🫱"],
        ["শান্ত relieved", "😌"], ["ঘুম sleepy", "😴"], ["অসুস্থ sick", "🤒"], ["মাথা-ঘোরা dizzy", "😵"],
        ["ঠান্ডা cold", "🥶"], ["গরম hot", "🥵"], ["নাকি-মাস্ক mask", "🤥"], ["সন্দেহ smirk", "😏"],
        ["নির্বোধ silly", "🤪"], ["চমৎকার zany", "🤯"], ["ভয় fear", "😨"], ["কাঁপা shiver", "😰"],
      ],
    },
    {
      key: "gestures", label: { en: "Gestures", bn: "হাত" }, icon: "👍",
      items: [
        ["থাম্ব-উপর like", "👍"], ["থাম্ব-নিচ dislike", "👎"], ["করতালি clap", "👏"], ["উৎসব hands", "🙌"],
        ["শক্তি muscle", "💪"], ["হ্যান্ডশেক deal", "🤝"], ["ওকে-হাত ok", "👌"], ["বিজয় peace", "✌️"],
        ["আঙুল-কাটা crossed", "🤞"], ["তর্কসাপেক্ষে ok", "🤙"], ["নমস্কার wave", "👋"], ["তালি-হাত raised", "🖐"],
        ["ইশারা point-right", "👉"], ["ইশারা point-left", "👈"], ["ইশারা point-up", "👆"], ["ইশারা point-down", "👇"],
        ["হাত-উঠানো hand", "✋"], ["দুই-হাত hands", "🤲"], ["হাত-জোড়া fold", "🙏"], ["লেখা write", "✍️"],
      ],
    },
    {
      key: "hearts", label: { en: "Hearts", bn: "হৃদয়" }, icon: "❤️",
      items: [
        ["লাল-হৃদয় love", "❤️"], ["কমলা heart", "🧡"], ["হলুদ heart", "💛"], ["সবুজ heart", "💚"],
        ["নীল heart", "💙"], ["বেগুনি heart", "💜"], ["কালো heart", "🖤"], ["সাদা heart", "🤍"],
        ["ভাঙা heart", "💔"], ["চুম্বন kiss", "💌"], ["ফুল flower", "🌹"], ["গোলাপ rose", "🌸"],
        ["তারা star", "⭐"], ["ঝলক sparkle", "✨"], ["উজ্জ্বল glow", "🌟"], ["আগুন fire", "🔥"],
      ],
    },
    {
      key: "objects", label: { en: "Objects", bn: "জিনিস" }, icon: "🎉",
      items: [
        ["উৎসব party", "🎉"], ["কনফেটি confetti", "🎊"], ["উপহার gift", "🎁"], ["ট্রফি trophy", "🏆"],
        ["পদক medal", "🥇"], ["ফুটবল football", "⚽"], ["ক্রিকেট cricket", "🏏"], ["ব্যাট bat", "🥎"],
        ["চা tea", "☕"], ["চা-গ্লাস cup", "🍵"], ["খাবার food", "🍚"], ["মিষ্টি sweet", "🍰"],
        ["কলম pen", "📝"], ["মেমো note", "📋"], ["স্টাডি study", "📚"], ["চিঠি mail", "✉️"],
        ["ঘণ্টা bell", "🔔"], ["ক্যামেরা camera", "📷"], ["মোবাইল phone", "📱"], ["কম্পিউটার pc", "💻"],
      ],
    },
    {
      key: "symbols", label: { en: "Symbols", bn: "চিহ্ন" }, icon: "✅",
      items: [
        ["সঠিক check", "✅"], ["ভুল cross", "❌"], ["প্রশ্ন question", "❓"], ["বিস্ময় bang", "❗"],
        ["সতর্কতা warn", "⚠️"], ["লাল red", "🔴"], ["সবুজ green", "🟢"], ["নীল blue", "🔵"],
        ["হলুদ yellow", "🟡"], ["বাদামি brown", "🟤"], ["বৃত্ত circle", "⭕"], ["হীরা diamond", "💠"],
        ["মোজাইক mosaic", "⛎"], ["তীর arrow", "➡️"], ["ফেরত back", "🔙"], ["উপরে top", "🔝"],
        ["লক lock", "🔒"], ["চাবি key", "🔑"], ["হাতুড়ি tool", "🔨"], ["বৈদ্যুতিক zap", "⚡"],
      ],
    },
    {
      key: "nature", label: { en: "Nature", bn: "প্রকৃতি" }, icon: "🌸",
      items: [
        ["সূর্য sun", "☀️"], ["চাঁদ moon", "🌙"], ["তারা-রাত night", "🌃"], ["মেঘ cloud", "☁️"],
        ["বৃষ্টি rain", "🌧"], ["তুষার snow", "❄️"], ["গাছ tree", "🌳"], ["পাতা leaf", "🍃"],
        ["ফুল-বাগান blossom", "🌺"], ["সূর্যমুখী sunflower", "🌻"], ["নদী river", "🏞"], ["সমুদ্র sea", "🌊"],
        ["পাখি bird", "🐦"], ["মৌমাছি bee", "🐝"], ["প্রজাপতি butterfly", "🦋"], ["বিড়াল cat", "🐱"],
        ["কুকুর dog", "🐶"], ["গরু cow", "🐮"], ["মুরগি hen", "🐔"], ["মাছ fish", "🐟"],
      ],
    },
  ];

  function buildSymbolsPane(pane) {
    const s = S();
    pane.innerHTML = `
      <div class="bca-setting">
        <div class="bca-setting-label bca-sym-title"></div>
        <div class="bca-hint bca-sym-hint"></div>
      </div>
      <div class="bca-setting">
        <div class="bca-setting-label bca-sym-pick-label"></div>
        <input type="text" class="bca-emoji-search" />
        <div class="bca-emoji-cats"></div>
        <div class="bca-emoji-grid"></div>
      </div>
      <div class="bca-setting">
        <textarea class="bca-editor bca-sym-editor" spellcheck="false" rows="9"></textarea>
        <div class="bca-editor-bar">
          <span class="bca-editor-count bca-sym-count"></span>
          <span class="bca-editor-msg bca-sym-msg"></span>
          <button type="button" class="bca-btn bca-sym-save"></button>
          <button type="button" class="bca-mini bca-sym-default"></button>
        </div>
      </div>
      <div class="bca-setting">
        <div class="bca-setting-label bca-sym-add-label"></div>
        <div class="bca-picker-entry">
          <input type="text" class="bca-sym-input" maxlength="200" />
          <button type="button" class="bca-mini bca-sym-add">+</button>
        </div>
        <div class="bca-hint bca-sym-add-hint"></div>
      </div>`;

    pane.querySelector(".bca-sym-title").textContent = s.symTitle;
    pane.querySelector(".bca-sym-hint").textContent = s.symHint;
    pane.querySelector(".bca-sym-pick-label").textContent = s.symPickLabel;
    const search = pane.querySelector(".bca-emoji-search");
    search.placeholder = s.symSearch;
    pane.querySelector(".bca-sym-add-label").textContent = s.symAddLabel;
    pane.querySelector(".bca-sym-add-hint").textContent = s.symAddHint;

    const editor = pane.querySelector(".bca-sym-editor");
    const count = pane.querySelector(".bca-sym-count");
    const msg = pane.querySelector(".bca-sym-msg");
    const saveBtn = pane.querySelector(".bca-sym-save");
    const defBtn = pane.querySelector(".bca-sym-default");
    const input = pane.querySelector(".bca-sym-input");
    const addBtn = pane.querySelector(".bca-sym-add");
    saveBtn.textContent = s.symSave;
    defBtn.textContent = s.symDefaultSet;

    let limit = 20000;
    let activeCat = EMOJI_CATEGORIES[0].key;

    // ---------- the list (editor) is the source of truth ----------
    const lineSet = () => new Set(editor.value.split("\n").map((l) => l.trim()).filter(Boolean));
    const paint = () => {
      const n = editor.value.split("\n").filter((l) => l.trim()).length;
      count.textContent = `${editor.value.length.toLocaleString()} / ${limit.toLocaleString()} · ${n} ${s.symCountSuffix}`;
      count.classList.toggle("over", editor.value.length > limit);
      // sync the picker highlight with the list
      const present = lineSet();
      grid.querySelectorAll(".bca-emoji").forEach((b) => {
        b.classList.toggle("on", present.has(b.dataset.emoji));
      });
    };
    editor.addEventListener("input", () => {
      paint();
      msg.textContent = "";
    });

    const append = (text) => {
      const value = String(text || "").trim();
      if (!value) return;
      const current = editor.value.replace(/\s+$/, "");
      editor.value = (current ? current + "\n" : "") + value;
      paint();
      msg.textContent = "";
    };

    // ---------- category tabs + grid (WhatsApp-style) ----------
    const cats = pane.querySelector(".bca-emoji-cats");
    const grid = pane.querySelector(".bca-emoji-grid");

    for (const cat of EMOJI_CATEGORIES) {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "bca-emoji-cat" + (cat.key === activeCat ? " on" : "");
      tab.textContent = cat.icon;
      tab.title = cat.label[curLang()];
      tab.addEventListener("click", () => {
        activeCat = cat.key;
        cats.querySelectorAll(".bca-emoji-cat").forEach((x) => x.classList.toggle("on", x === tab));
        renderGrid();
      });
      cats.appendChild(tab);
    }

    function renderGrid() {
      grid.innerHTML = "";
      const q = search.value.trim().toLowerCase();
      const catsToScan = q
        ? EMOJI_CATEGORIES // search spans every category
        : EMOJI_CATEGORIES.filter((c) => c.key === activeCat);
      let shown = 0;
      for (const cat of catsToScan) {
        for (const [name, emoji] of cat.items) {
          if (q && !(name.toLowerCase().includes(q) || emoji.includes(q))) continue;
          const b = document.createElement("button");
          b.type = "button";
          b.className = "bca-emoji";
          b.dataset.emoji = emoji;
          b.textContent = emoji;
          b.title = name;
          b.addEventListener("click", () => {
            // toggle: click adds the emoji to the list, clicking a selected
            // one removes it — exactly the "select defaults" flow
            const present = lineSet();
            if (present.has(emoji)) {
              const kept = editor.value.split("\n").filter((l) => l.trim() !== emoji);
              editor.value = kept.join("\n");
            } else {
              append(emoji);
            }
            paint();
          });
          grid.appendChild(b);
          shown++;
        }
      }
      if (!shown) {
        const none = document.createElement("div");
        none.className = "bca-chips-empty";
        none.textContent = s.symNoResults;
        grid.appendChild(none);
      }
      paint();
    }
    search.addEventListener("input", renderGrid);
    renderGrid();

    // ---------- free-form entry: ANY emoji from the system keyboard ----------
    addBtn.addEventListener("click", () => {
      append(input.value);
      input.value = "";
    });
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      append(input.value);
      input.value = "";
    });

    const fill = (data) => {
      if (!data || typeof data !== "object") return;
      limit = Number(data.limit) > 0 ? Number(data.limit) : limit;
      const saved = typeof data.frequentSymbols === "string" ? data.frequentSymbols : "";
      editor.value = saved;
      paint();
    };

    async function saveNow() {
      if (editor.value.length > limit) {
        msg.textContent = s.attTooLarge;
        return false;
      }
      saveBtn.disabled = true;
      const label = saveBtn.textContent;
      saveBtn.textContent = s.attSaving;
      msg.textContent = "";
      try {
        const res = await fetch("/api/chat/saveFrequentSymbols", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ frequentSymbols: editor.value }),
        });
        if (res.status === 401) {
          msg.textContent = s.sessionExpired;
          toast(s.sessionExpired, true);
        } else if (!res.ok) {
          msg.textContent = s.fetchFail;
          toast(s.fetchFail, true);
        } else {
          msg.textContent = s.saved;
          toast(s.saved);
          return true;
        }
      } catch {
        msg.textContent = s.noServer;
        toast(s.noServer, true);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = label;
      }
      return false;
    }
    saveBtn.addEventListener("click", () => saveNow());

    // "অ্যাপের ডিফল্ট সেট করুন" — the server resets to its built-in list
    defBtn.addEventListener("click", async () => {
      if (!window.confirm(s.symDefaultConfirm)) return;
      defBtn.disabled = true;
      try {
        const res = await fetch("/api/chat/restoreFrequentSymbols", {
          method: "POST",
          credentials: "same-origin",
        });
        if (res.ok) {
          const fresh = await fetch("/api/chat/getFrequentSymbols", { credentials: "same-origin" });
          if (fresh.ok) fill(await fresh.json());
          msg.textContent = s.saved;
          toast(s.saved);
        } else if (res.status === 401) {
          msg.textContent = s.sessionExpired;
          toast(s.sessionExpired, true);
        } else {
          msg.textContent = s.fetchFail;
          toast(s.fetchFail, true);
        }
      } catch {
        msg.textContent = s.noServer;
        toast(s.noServer, true);
      } finally {
        defBtn.disabled = false;
      }
    });

    (async () => {
      try {
        const res = await fetch("/api/chat/getFrequentSymbols", { credentials: "same-origin" });
        if (res.status === 401) {
          msg.textContent = s.sessionExpired;
          return;
        }
        if (!res.ok) return;
        fill(await res.json());
      } catch {
        /* transient */
      }
    })();
  }

  // ==================================================================
  // 2e) custom reactions: a "+" at the far right of the app's quick-reaction
  //     row opens a full picker; selecting an emoji reacts on that message
  //     via the addon's own socket.io connection (same session cookie).
  //     The official client is vendored at /addons/socket.io.min.js because
  //     the minified app does not expose its `io` globally.
  // ==================================================================
  let reactionSock = null;
  let reactionSockReady = null;
  let socketClientLoading = null;
  let reactionOutside = null;

  function loadSocketClient() {
    if (window.io) return Promise.resolve(window.io);
    if (socketClientLoading) return socketClientLoading;
    socketClientLoading = new Promise((resolve) => {
      const sc = document.createElement("script");
      sc.src = "/addons/socket.io.min.js"; // vendored client — /socket.io/socket.io.js is NOT served by the Render/CF builds (client-dist not deployed there)
      sc.onload = () => resolve(window.io || null);
      sc.onerror = () => resolve(null);
      document.head.appendChild(sc);
    });
    return socketClientLoading;
  }

  async function reactionSocket() {
    const IO = await loadSocketClient();
    if (!IO) return null;
    if (reactionSockReady) return reactionSockReady;
    reactionSockReady = new Promise((resolve) => {
      try {
        reactionSock = IO({ transports: ["websocket", "polling"], reconnection: true });
        reactionSock.on("connect", () => resolve(reactionSock));
        reactionSock.on("connect_error", () => { /* socket.io retries */ });
        // don't hang the picker forever if the socket never connects
        t(8000, () => resolve(reactionSock?.connected ? reactionSock : null));
      } catch {
        resolve(null);
      }
    });
    return reactionSockReady;
  }

  /** the message model keeps reactions as { "<emoji>": { usernames: [] } } */
  function toggleReactionPayload(msgReactions, emoji, username) {
    const reactions = {};
    for (const key of Object.keys(msgReactions || {})) {
      reactions[key] = { usernames: [...(msgReactions[key]?.usernames || [])] };
    }
    const list = reactions[emoji]?.usernames || [];
    const mine = list.find((u) => u === username);
    if (mine) {
      reactions[emoji].usernames = list.filter((u) => u !== username);
    } else {
      reactions[emoji] = { usernames: [...list, username] };
    }
    return reactions;
  }

  /** read the reaction state from the bubble's own DOM (truth on screen) */
  function readReactionsFromDom(bubble) {
    const reactions = {};
    bubble.querySelectorAll(".reaction-emoji").forEach((chip) => {
      const first = chip.querySelector("div > div");
      if (!first) return;
      const text = first.textContent || "";
      const m = text.match(/^([\s\S]+?)\s+(\d+)$/);
      if (!m) return;
      const userNames = [...chip.querySelectorAll(".reaction-username")].map((p) => p.textContent.trim());
      reactions[m[1]] = { usernames: userNames };
    });
    return reactions;
  }

  async function reactOnMessage(bubble, emoji) {
    return; // dead path — tray-picker owns reactions (REST-first, shared surface)
    const id = parseInt(String(bubble.id || "").replace("message-", ""), 10);
    if (!Number.isFinite(id)) return;
    const username = meUser?.username;
    if (!username) return;
    const s = S();
    const sock = await reactionSocket();
    if (!sock) return toast(s.reactFail, true);
    const reactions = toggleReactionPayload(readReactionsFromDom(bubble), emoji, username);
    sock.timeout(8000).emit("reactMessage", { id, reactions }, (err) => {
      if (err) return toast(s.reactFail, true);
      // NO manual DOM write: the app's own socket receives the reactedMessage
      // broadcast and renders the chip itself — writing here doubled it
    });
  }

  function closeReactionPickers() {
    root().querySelectorAll(".bca-react-pop").forEach((p) => p.remove());
    if (reactionOutside) {
      document.removeEventListener("mousedown", reactionOutside, true);
      reactionOutside = null;
    }
  }

  function openReactionPicker(msgRoot, anchor) {
    const existing = root().querySelector(".bca-react-pop");
    closeReactionPickers();
    if (existing) return; // "+" toggles the picker
    const s = S();
    const pop = document.createElement("div");
    pop.className = "bca-popup bca-react-pop";
    pop.innerHTML = `
      <div class="bca-picker-entry">
        <input type="text" class="bca-emoji-search" />
      </div>
      <div class="bca-emoji-cats"></div>
      <div class="bca-emoji-grid"></div>`;
    const search = pop.querySelector(".bca-emoji-search");
    search.placeholder = s.symSearch;
    const cats = pop.querySelector(".bca-emoji-cats");
    const grid = pop.querySelector(".bca-emoji-grid");
    let activeCat = EMOJI_CATEGORIES[0].key;

    for (const cat of EMOJI_CATEGORIES) {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "bca-emoji-cat" + (cat.key === activeCat ? " on" : "");
      tab.textContent = cat.icon;
      tab.title = cat.label[curLang()];
      tab.addEventListener("click", () => {
        activeCat = cat.key;
        cats.querySelectorAll(".bca-emoji-cat").forEach((x) => x.classList.toggle("on", x === tab));
        render();
      });
      cats.appendChild(tab);
    }

    function render() {
      grid.innerHTML = "";
      const q = search.value.trim().toLowerCase();
      const scan = q ? EMOJI_CATEGORIES : EMOJI_CATEGORIES.filter((c) => c.key === activeCat);
      let shown = 0;
      for (const cat of scan) {
        for (const [name, emoji] of cat.items) {
          if (q && !(name.toLowerCase().includes(q) || emoji.includes(q))) continue;
          const b = document.createElement("button");
          b.type = "button";
          b.className = "bca-emoji";
          b.textContent = emoji;
          b.title = name;
          b.addEventListener("click", () => {
            reactOnMessage(msgRoot, emoji);
            closeReactionPickers();
          });
          grid.appendChild(b);
          shown++;
        }
      }
      if (!shown) {
        const none = document.createElement("div");
        none.className = "bca-chips-empty";
        none.textContent = s.symNoResults;
        grid.appendChild(none);
      }
    }
    search.addEventListener("input", render);
    render();

    // park it near the "+", clamped to the viewport
    const rect = anchor.getBoundingClientRect();
    const width = 320;
    pop.style.top = Math.max(rect.top - 330, 8) + "px";
    const right = Math.max(8, window.innerWidth - rect.right);
    pop.style.right = right + "px";
    if (rect.right < width + 8) pop.style.left = "8px";
    root().appendChild(pop);

    // outside click (anywhere that is not the popup or the "+") closes it —
    // a persistent listener, removed together with the popup
    reactionOutside = (e) => {
      if (!pop.contains(e.target) && !anchor.contains(e.target)) closeReactionPickers();
    };
    document.addEventListener("mousedown", reactionOutside, true);
  }

  /** the "+" sits at the far right of the 8-emoji quick-reaction row */
  function ensureReactionPlus() {
    return; // the standalone tray-picker addon owns the "+" now (one picker, no legacy socket)
    if (!loggedIn) return;
    document.querySelectorAll(".dropdown-menu.context-menu.show").forEach((menu) => {
      if (menu.querySelector(".bca-react-plus")) return;
      const msgRoot = menu.closest('[id^="message-"]');
      if (!msgRoot) return;
      for (const row of menu.querySelectorAll(".dropdown-item, .menu-button")) {
        const emojiBtns = [...row.querySelectorAll(".btn")].filter(
          (b) => (b.textContent || "").trim().length <= 4
        );
        if (emojiBtns.length < 6) continue; // that's the reactions row, not others
        const plus = document.createElement("button");
        plus.type = "button";
        plus.className = "btn btn-outline-secondary btn-sm icon-button bca-react-plus";
        plus.textContent = "＋";
        plus.title = S().reactMore;
        plus.setAttribute("aria-label", S().reactMore);
        plus.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          openReactionPicker(msgRoot, plus);
        });
        row.appendChild(plus); // far right of the emoji row
        break;
      }
    });
  }

  // ---------- navbar icons (bootstrap-icons, matching the app's own) ----------
  const CLIPBOARD_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-clipboard" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zM9.5 0h-3a1.5 1.5 0 0 0-1.5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0z"/></svg>';
  const MORE_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-three-dots" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3"/></svg>';
  const TRASH_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/><path d="M14.54 3.87 13.3 13a2 2 0 0 1-2 1.72H4.7a2 2 0 0 1-2-1.72L1.46 3.87A1 1 0 0 1 2.45 2.5h11.1a1 1 0 0 1 .99 1.37M4.7 13.72h6.6a1 1 0 0 0 1-.86l1.24-9.13a.5.5 0 0 0-.5-.59H2.46a.5.5 0 0 0-.5.59l1.25 9.13a1 1 0 0 0 .99.86"/><path d="M2.52 3.5 3.7 12.86q.04.36.36.64l-1.04-10.5zm11.96 0-.5 10.5q.32-.28.36-.64L15.48 3.5z"/></svg>';
  const SHIELD_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-shield-lock" viewBox="0 0 16 16" aria-hidden="true"><path d="M5.338 1.59a61 61 0 0 0-2.837.856.48.48 0 0 0-.328.39c-.554 4.157.726 7.19 2.253 9.188a10.7 10.7 0 0 0 2.287 2.233c.346.244.652.42.893.533q.18.085.293.118a1 1 0 0 0 .101.025 1 1 0 0 0 .1-.025q.114-.034.294-.118c.24-.113.547-.29.893-.533a10.7 10.7 0 0 0 2.287-2.233c1.527-1.997 2.807-5.031 2.253-9.188a.48.48 0 0 0-.328-.39c-.651-.213-1.75-.56-2.837-.855C9.552 1.29 8.531 1.067 8 1.067c-.53 0-1.552.223-2.662.524zM5.072.56C6.157.265 7.31 0 8 0s1.843.265 2.928.56c1.11.3 2.229.655 2.887.87a1.54 1.54 0 0 1 1.044 1.262c.596 4.477-.787 7.795-2.465 9.99a11.8 11.8 0 0 1-2.517 2.453 7 7 0 0 1-1.048.625c-.28.132-.581.24-.829.24s-.548-.108-.829-.24a7 7 0 0 1-1.048-.625 11.8 11.8 0 0 1-2.517-2.453C1.928 10.487.545 7.169 1.141 2.692A1.54 1.54 0 0 1 2.185 1.43 63 63 0 0 1 5.072.56"/><path d="M9.5 6.5a1.5 1.5 0 0 1-1 1.415l.385 1.99a.5.5 0 0 1-.491.595h-.788a.5.5 0 0 1-.49-.595l.384-1.99a1.5 1.5 0 1 1 2-1.415z"/></svg>';
  const ATTENDANCE_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-clipboard2-check" viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 0a.5.5 0 0 1 .5.5.5.5 0 0 0 .5.5.5.5 0 0 1 .5.5V2a.5.5 0 0 1-.5.5h-5A.5.5 0 0 1 5 2v-.5a.5.5 0 0 1 .5-.5.5.5 0 0 0 .5-.5.5.5 0 0 1 .5-.5z"/><path d="M3 2.5a.5.5 0 0 1 .5-.5H4a.5.5 0 0 0 0-1h-.5A1.5 1.5 0 0 0 2 2.5v12A1.5 1.5 0 0 0 3.5 16h9a1.5 1.5 0 0 0 1.5-1.5v-12A1.5 1.5 0 0 0 12.5 1H12a.5.5 0 0 0 0 1h.5a.5.5 0 0 1 .5.5v12a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5z"/><path d="M10.854 7.854a.5.5 0 0 0-.708-.708L7.5 9.793 6.354 8.646a.5.5 0 1 0-.708.708l1.5 1.5a.5.5 0 0 0 .708 0z"/></svg>';

  let menuBtn = null;
  let menuOutside = null;
  let menuEscape = null;
  function removeMenuDropdown() {
    root().querySelectorAll(".bca-navmenu-drop").forEach((p) => p.remove());
    if (menuOutside) { document.removeEventListener("click", menuOutside, true); menuOutside = null; }
    if (menuEscape) { document.removeEventListener("keydown", menuEscape, true); menuEscape = null; }
  }

  function refreshCopyUi() {
    const s = S();
    for (const [btn, label] of [[menuBtn, s.menuMore]]) {
      if (btn && document.contains(btn)) {
        btn.title = label;
        btn.setAttribute("aria-label", label);
      }
    }
    const fab = root().querySelector(".bca-fab span");
    if (fab) {
      const wrapper = fab.closest(".bca-fab");
      wrapper.title = s.menuCopy;
      wrapper.setAttribute("aria-label", s.menuCopy);
      fab.textContent = s.fabLabel;
    }
  }

  function toggleCopyPopup() {
    if (root().querySelector(".bca-popup")) closePopup();
    else showExportPopup();
  }

  function toggleAdminPanel() {
    if (root().querySelector(".bca-popup")) closePopup();
    else showAdminPanel();
  }

  function navGroup() {
    const nav = document.querySelector(".navbar.fixed-top");
    return nav
      ? nav.querySelector(":scope > .me-2") || nav.querySelector(".icon-button")?.parentElement
      : null;
  }

  /** keep the copy + admin icons in the navbar icon group; remove whichever
      the current settings say should not be visible; re-attach whenever
      React re-renders them away */
  function ensureNavButtons() {
    const group = navGroup();
    if (!group) {
      addFab(); // fallback while the chat navbar isn't mounted yet
      return;
    }
    // navbar is available — the floating fallback is no longer needed
    root().querySelectorAll(".bca-fab").forEach((x) => x.remove());

    const canCopy = loggedIn && copyAllowed();
    const canDel = loggedIn && !!meUser && features.supported && features.canDeleteAllChat;
    const canAdmin = loggedIn && !!meUser?.isAdmin && features.supported;
    const canAtt = loggedIn && features.supported && features.canViewAttendance;
    const wantMenu = loggedIn && (canCopy || canDel || canAtt || canAdmin);

    if (wantMenu && !menuBtn) {
      menuBtn = document.createElement("button");
      menuBtn.type = "button";
      menuBtn.className = "btn btn-outline-secondary btn-sm icon-button bca-navmenu";
      menuBtn.innerHTML = MORE_SVG;
      menuBtn.setAttribute("aria-haspopup", "true");
      menuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleMenuDropdown();
      });
    }
    if (!wantMenu && menuBtn) { menuBtn.remove(); menuBtn = null; removeMenuDropdown(); }
    if (wantMenu && menuBtn && menuBtn.parentElement !== group) group.appendChild(menuBtn);
    // permission flips while the dropdown is open → rebuild it
    if (!wantMenu || root().querySelector(".bca-navmenu-drop")) toggleMenuDropdown.refresh;
    refreshMenuLabels();
  }

  /** the ⋯ dropdown — one item per feature the current user may use */
  function toggleMenuDropdown() {
    if (root().querySelector(".bca-navmenu-drop")) { removeMenuDropdown(); return; }
    closePopup();
    removeAttLinks();
    const s = S();
    const group = navGroup();
    if (!group || !menuBtn) return;
    const canCopy = loggedIn && copyAllowed();
    const canDel = loggedIn && !!meUser && features.supported && features.canDeleteAllChat;
    const canAdmin = loggedIn && !!meUser?.isAdmin && features.supported;
    const canAtt = loggedIn && features.supported && features.canViewAttendance;
    const pop = document.createElement("div");
    pop.className = "bca-popup bca-navmenu-drop";
    let items = "";
    if (canCopy) items += '<button class="bca-navmenu-item" data-mi="copy" type="button">' + CLIPBOARD_SVG + "<span>" + s.menuCopy + "</span></button>";
    if (canAtt) items += '<button class="bca-navmenu-item" data-mi="att" type="button">' + ATTENDANCE_SVG + "<span>" + s.attOpenPage + "</span></button>";
    if (canAdmin) items += '<button class="bca-navmenu-item" data-mi="admin" type="button">' + SHIELD_SVG + "<span>" + s.adminMenu + "</span></button>";
    if (canDel) items += '<button class="bca-navmenu-item bca-danger-item" data-mi="del" type="button">' + TRASH_SVG + "<span>" + s.delMenu + "</span></button>";
    if (!items) return; // nothing permitted — never draw an empty menu
    pop.innerHTML = items;
    group.appendChild(pop);
    menuOutside = (e) => {
      if (!pop.contains(e.target) && !e.target.closest(".bca-navmenu")) removeMenuDropdown();
    };
    menuEscape = (e) => { if (e.key === "Escape") removeMenuDropdown(); };
    document.addEventListener("click", menuOutside, true);
    document.addEventListener("keydown", menuEscape, true);
    pop.querySelectorAll(".bca-navmenu-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        removeMenuDropdown();
        const which = item.dataset.mi;
        if (which === "copy") showExportPopup();
        else if (which === "att") toggleAttLinks();
        else if (which === "admin") showAdminPanel();
        else if (which === "del") showDeletePopup();
      });
    });
  }

  function refreshMenuLabels() {
    if (!menuBtn) return;
    const s = S();
    menuBtn.title = s.menuMore;
    menuBtn.setAttribute("aria-label", s.menuMore);
  }

  /** attendance hub: a small dropdown under the icon —
      1) হাজিরা কাউন্টার (/attendance)  2) নোটপ্যাড (/notepad) — both in a new tab */
  let attLinksOutside = null;
  let attLinksEscape = null;
  function removeAttLinks() {
    root().querySelectorAll(".bca-attlinks").forEach((p) => p.remove());
    if (attLinksOutside) { document.removeEventListener("click", attLinksOutside, true); attLinksOutside = null; }
    if (attLinksEscape) { document.removeEventListener("keydown", attLinksEscape, true); attLinksEscape = null; }
  }
  function toggleAttLinks() {
    const existing = root().querySelector(".bca-attlinks");
    closePopup();
    if (existing) return; // icon toggles the dropdown
    const pop = document.createElement("div");
    pop.className = "bca-popup bca-attlinks";
    pop.innerHTML =
      '<a class="bca-attlinks-item" href="/attendance" target="_blank" rel="noopener"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 2a.5.5 0 0 0-.5.5v12a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5v-12a.5.5 0 0 0-.5-.5H12a.5.5 0 0 1 0-1h.5A1.5 1.5 0 0 1 14 2.5v12a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 14.5v-12A1.5 1.5 0 0 1 3.5 1H4a.5.5 0 0 1 0 1z"/><path d="M10 .5a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5.5.5 0 0 1-.5.5.5.5 0 0 0-.5.5V2a.5.5 0 0 0 .5.5h5A.5.5 0 0 0 11 2v-.5a.5.5 0 0 0-.5-.5.5.5 0 0 1-.5-.5"/></svg><span>হাজিরা কাউন্টার</span></a>' +
      '<a class="bca-attlinks-item" href="/notepad" target="_blank" rel="noopener"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 10.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5m0-2a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5m0-2a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5m0-2a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5"/><path d="M3 0h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-1h1v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v1H1V2a2 2 0 0 1 2-2"/><path d="M1 5v-.5a.5.5 0 0 1 1 0V5h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1zm0 3v-.5a.5.5 0 0 1 1 0V8h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1zm0 3v-.5a.5.5 0 0 1 1 0v.5h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1z"/></svg><span>নোটপ্যাড</span></a>';
    root().appendChild(pop);
    attLinksOutside = (e) => {
      if (!pop.contains(e.target) && !e.target.closest(".bca-navatt")) removeAttLinks();
    };
    attLinksEscape = (e) => { if (e.key === "Escape") removeAttLinks(); };
    document.addEventListener("click", attLinksOutside, true);
    document.addEventListener("keydown", attLinksEscape, true);
  }
  const teardownHooks = [];
  teardownHooks.push(removeAttLinks);

  /** when the admin hides the online-users list, regular users shouldn't even
      see the users tab / side panel — hide the React-rendered surfaces
      (mobile nav link, desktop column, reopen button); admins keep everything */
  function applyUsersPanelVisibility() {
    const hide =
      loggedIn && features.supported && !meUser?.isAdmin && features.canSeeOnlineUsers === false;
    document.querySelectorAll(".mobile-nav").forEach((nav) => {
      const usersLink = nav.children[1]; // nav is exactly [Chat, Users]
      if (usersLink) usersLink.style.display = hide ? "none" : "";
    });
    document.querySelectorAll(".special-column").forEach((col) => {
      if (!col.querySelector(".peoples-head, .search-box")) return;
      col.style.display = hide ? "none" : "";
    });
    document.querySelectorAll(".people-max").forEach((b) => {
      b.style.display = hide ? "none" : "";
    });
  }

  /** fallback when the navbar isn't available: floating button */
  function addFab() {
    // chat page only: never on /login, /register, /admin (owner screenshot —
    // the FAB floated over the bare login form; the navbar isn't there yet
    // but the page is clearly not the chat)
    if (!document.querySelector('div[id^="message-"]')) return;
    if (root().querySelector(".bca-fab")) return;
    const s = S();
    const fab = document.createElement("button");
    fab.className = "bca-fab";
    fab.type = "button";
    fab.title = s.menuCopy;
    fab.setAttribute("aria-label", s.menuCopy);
    fab.innerHTML = `📋 <span>${s.fabLabel}</span>`;
    fab.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleCopyPopup();
    });
    root().appendChild(fab);
  }

  // ==================================================================
  // 3) notice marquee fix — duration from the real text width
  //    (the app hard-codes `40s` with %-based offsets, so long notices
  //     restart before their tail has ever been visible)
  // ==================================================================
  const MARQUEE_SPEED = 50; // px per second
  function fixMarquee(el) {
    const container = el.parentElement;
    if (!container) return;
    const cw = container.clientWidth;
    const tw = el.scrollWidth;
    if (!cw || !tw) return;
    if (el.__bcaW === tw && el.__bcaC === cw && el.__bcaDone) return;
    el.__bcaDone = true;
    el.__bcaW = tw;
    el.__bcaC = cw;
    el.style.animation = "none";
    el.style.setProperty("--bca-from", cw + "px");
    el.style.setProperty("--bca-to", -tw + "px");
    void el.offsetWidth; // reflow so the animation restarts cleanly
    const duration = Math.max((cw + tw) / MARQUEE_SPEED, 8);
    el.style.animation = `bca-marquee ${duration}s linear infinite`;
  }

  let scanPending = false;
  function scanUi() {
    if (scanPending) return;
    scanPending = true;
    t(120, () => {
      scanPending = false;
      document.querySelectorAll(".marquee-content").forEach(fixMarquee);
      if (loggedIn) ensureNavButtons();
      applyUsersPanelVisibility();
      if (loggedIn) ensureReactionPlus();
    });
  }

  // ---------- boot ----------
  // marquee fix + button re-attachment run on every page, immediately
  const uiObserver = new MutationObserver(scanUi);
  uiObserver.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("resize", scanUi);
  scanUi();

  let loggedIn = false;
  function teardown() {
    loggedIn = false;
    meUser = null;
    if (menuBtn) { menuBtn.remove(); menuBtn = null; }
    removeMenuDropdown();
    if (typeof removeAttLinks === "function") removeAttLinks();
    root().querySelectorAll(".bca-fab").forEach((x) => x.remove());
    closePopup();
    for (const hook of teardownHooks) { try { hook(); } catch { /* noop */ } }
  }

  async function evaluateSession() {
    const me = await fetchMe();
    if (!me) {
      if (loggedIn) teardown();
      return; // logged out — nothing to do
    }
    loggedIn = true;
    meUser = me;
    await refreshFeatures();
    if (me.mustChangePassword) showForceChangeModal();
    else ensureNavButtons();
    applyUsersPanelVisibility();
  }
  // the hub (ui-fixes.js) fires "bca:session" on every logged-out→logged-in
  // flip — the SPA login navigates without a reload, so without this the
  // buttons stayed hidden until the next manual reload (owner report 2026-11-07)
  window.addEventListener("bca:session", (e) => {
    if (e.detail?.loggedIn) evaluateSession();
    else if (loggedIn) teardown();
  });
  // missed-flip self-healing (owner task 2026-11-07: "make me online"-এর পরের
  // আইকনদুটো লগইনের পরে অটো আসে না, রিফ্রেশে আসে): the flip event can be
  // missed (tab throttled in the background during login, listener-wiring
  // race on a slow first paint) — the 1.2 s loop cross-checks the hub:
  // hub says logged-in but this module is still torn down → evaluate now.
  // Cheap: no HTTP, just an object read; the .bca-overlay check keeps the
  // forced-password modal the sole owner of the screen.
  setInterval(() => {
    const sess = window.__bcaSession;
    if (sess?.loggedIn && sess.me && !loggedIn && !document.querySelector(".bca-overlay")) {
      evaluateSession();
    }
  }, 1200);
  // the React app navigates without reloading, so re-check on every route
  // change, re-attach the buttons if React wiped them, follow language flips,
  // and pick up admin setting changes within ~15 seconds
  let lastUrl = location.href;
  let lastLang = curLang();
  let visibilityTick = 0;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      evaluateSession(); // hub-driven (fetchMe reads __bcaSession — no HTTP)
    }
    if (curLang() !== lastLang) {
      lastLang = curLang();
      refreshCopyUi();
    }
    if (loggedIn) {
      ensureNavButtons();
      ensureReactionPlus();
      if (++visibilityTick % 12 === 0) {
        (async () => {
          await refreshFeatures();
          ensureNavButtons();
          applyUsersPanelVisibility();
        })();
      }
    }
  }, 1200);
  // first evaluation once the hub has produced its first reading
  const waitForHub = setInterval(() => {
    if (window.__bcaSession) {
      clearInterval(waitForHub);
      evaluateSession();
    }
  }, 300);
  setTimeout(() => clearInterval(waitForHub), 10000);
})();

/* ===== bundle source: addons/no-emoji-tab.js ===== */
// Hides the "Emoji set" (ইমোজি সেট) tab + panel in the main addon's admin
// panel, per owner request. Runs once on every app page load, follows the
// SPA around (React may re-render the panel), and is safe on any page.
// The real code in public/addons/addon.js is intentionally untouched.
(() => {
  "use strict";
  if (window.__bcaNoEmojiTab) return;
  window.__bcaNoEmojiTab = true;

  const hide = () => {
    document.querySelectorAll('.bca-tab[data-tab="symbols"]').forEach((el) => {
      el.style.display = "none";
    });
    document.querySelectorAll('.bca-tabpanel[data-panel="symbols"]').forEach((el) => {
      el.hidden = true;
      el.style.display = "none";
    });
  };

  const mo = new MutationObserver(() => hide());
  const start = () => mo.observe(document.documentElement, { childList: true, subtree: true });
  if (document.documentElement) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
  document.addEventListener("DOMContentLoaded", hide, { once: true });
  hide();
})();

/* ===== bundle source: addons/quiet-vitals.js ===== */
/* Console silencer for the minified app bundle's web-vitals debug output
   (FCP/TTFB/LCP/FID/CLS/INP objects printed by the CRA build — harmless but
   noisy; owner request 2026-11-08: none of it should show).
   The addon layer must NOT touch the bundle, so we filter the console
   methods: any call whose FIRST argument looks like a web-vitals metric
   object (name/value/delta/entries/id) is dropped across log/info/debug;
   everything else passes through untouched. error/warn stay open — real
   problems must still surface.
*/
(() => {
  "use strict";
  if (window.__bcaQuietVitals) return;
  window.__bcaQuietVitals = true;

  const VITAL_NAMES = ["FCP", "TTFB", "LCP", "FID", "CLS", "INP", "Next.js-hydration", "Navigation"];
  const isVitalDump = (args) => {
    if (!args.length || !args[0] || typeof args[0] !== "object") return false;
    const o = args[0];
    return typeof o.name === "string"
      && VITAL_NAMES.includes(o.name)
      && "value" in o
      && "delta" in o
      && "id" in o
      && "entries" in o;
  };

  const quiet = (level) => {
    const orig = console[level].bind(console);
    console[level] = (...args) => { if (!isVitalDump(args)) orig(...args); };
  };
  quiet("log");
  quiet("info");
  quiet("debug");
})();

/* ===== bundle source: addons/login-autopilot.js ===== */
/* Login autopilot — standalone addon for "Our Discussion Room".
   v7 (owner request: "লগআউটে কল করবা কেন? এক কল, সবাই শোনে"): NO own poll at
   all — ui-fixes.js owns the single /api/users/me request and broadcasts
   window.__bcaSession. We only watch for the logged-out→logged-in
   transition and, if the app still shows the login form after a short
   beat, reload ONCE per browser (localStorage counter). Completely silent.
*/
(() => {
  "use strict";
  if (window.__bcaLoginAutopilot) return;
  window.__bcaLoginAutopilot = true;
  // silent (owner request 2026-11-08: no console noise)

  function visiblePassword() {
    for (const el of document.querySelectorAll('input[type="password"]')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && el.offsetParent !== null) return true;
    }
    return false;
  }

  let hubState;
  setInterval(() => {
    const sess = window.__bcaSession;
    if (!sess) return; // hub (ui-fixes.js) not mounted yet
    if (sess.loggedIn) {
      if (sess.me?.mustChangePassword) return; // forced modal owns the screen
      if (hubState !== true) {
        hubState = true; // fresh 401→200 = login just landed
        // one silent reload per browser if the app missed the login
        setTimeout(() => {
          let reloads = 0;
          try { reloads = Number(localStorage.getItem("bcaAutoRelN") || 0); } catch { /* private mode */ }
          if (visiblePassword() && !document.querySelector(".bca-overlay") && reloads < 1) {
            try { localStorage.setItem("bcaAutoRelN", String(reloads + 1)); } catch { /* private mode */ }
            location.reload();
          }
        }, 1500);
      }
    } else if (hubState !== false) {
      hubState = false;
    }
  }, 1200);
})();

/* ===== bundle source: addons/ui-fixes.js ===== */
/* UI fixes — standalone addon for "Our Discussion Room" (owner requests 2+3):
   #2: when the online-users list is hidden for regular users, the app still
       renders an EMPTY right-hand column (d-none class flips per screen
       size) and a "maximize" button — hide both completely.
   #3: while a slow login is still in progress (the main addon's navbar
       buttons aren't ready yet), a floating copy button (bca-fab) from the
       main addon may flash in the bottom-right corner. The main addon
       removes the FAB itself once the navbar mounts; we only make sure it
       never appears for logged-out/anonymous visitors and never stays
       without a navbar group — purely visual, no behavior changes.
   #4 (owner request): the bundled app renders the admin-panel link as
       <a href="/admin" target="_blank"> — it sometimes opens a NEW TAB.
       The minified bundle must not be edited (project rule), so the fix
       lives in the EXISTING loop below (no new file/page variation needed).
*/
(() => {
  "use strict";
  if (window.__bcaUiFixes) return;
  window.__bcaUiFixes = true;

  let isAdmin = null; // null = unknown yet
  // ---------- shared session hub (owner request: এক কল, সবাই শোনে) ----------
  // ui-fixes owns THE single /api/users/me poll. The other addons read
  // window.__bcaSession instead of polling themselves — logged-out pages
  // fire ~10 requests/min instead of ~200.
  let sessionPollDelay = 6000; // logged out: 6 s; logged in: 1.2 s
  function broadcastSession(loggedIn, me) {
    const prev = window.__bcaSession;
    const wasIn = !!(prev && prev.loggedIn);
    const nowIn = !!loggedIn;
    window.__bcaSession = { loggedIn: nowIn, me: me || null, at: Date.now() };
    // transition event: the SPA login navigates WITHOUT a reload, and the
    // consumers (addon buttons, picker, fsnotice, autopilot) only re-read the
    // hub on their own timers — a 401→200 flip must wake them immediately
    // (owner report 2026-11-07: admin icons missing until a manual reload)
    if (wasIn !== nowIn) {
      window.dispatchEvent(new CustomEvent("bca:session", { detail: { loggedIn: nowIn, me: me || null } }));
    }
  }
  async function probe() {
    try {
      const res = await fetch("/api/users/me", { credentials: "same-origin" });
      if (!res.ok) {
        isAdmin = null;
        broadcastSession(false, null);
        sessionPollDelay = 6000; // logged out: sparse probing
        return;
      }
      const me = await res.json().catch(() => null);
      isAdmin = !!me?.isAdmin;
      broadcastSession(true, me);
      sessionPollDelay = 1200; // logged in: dense (buttons/marquee react fast)
    } catch { /* keep last */ }
  }

  function apply() {
    const styleEl = document.getElementById("bca-uifixes-style") || (() => {
      const el = document.createElement("style");
      el.id = "bca-uifixes-style";
      document.head.appendChild(el);
      return el;
    })();
    // #2: non-admin + hidden list → the right column keeps only empty shells;
    //     admins always see everything
    const hideRightBox = isAdmin === false && localStorage.getItem("bcaUsersPanelHidden") === "1";
    styleEl.textContent = hideRightBox
      ? `
      /* empty online-users column: only the one that contains no real content */
      .special-column:not(:has(.peoples-head .bca-user, .bca-userlist .bca-user)):has(.peoples-head) { display: none !important; }`
      : "";
  }

  // the main addon marks the hidden state on <body> via its own logic; to
  // avoid coupling, we detect it the same way it does: a non-admin visitor
  // with the users-panel elements currently display:none
  function detectHiddenPanel() {
    const col = [...document.querySelectorAll(".special-column")].find((c) => c.querySelector(".peoples-head, .search-box"));
    if (col) {
      localStorage.setItem("bcaUsersPanelHidden", col.style.display === "none" ? "1" : "0");
    }
  }

  let fabFixed = false;
  function fixFab() {
    if (fabFixed) return;
    // #3: never show the fallback FAB to anonymous visitors; the main addon
    // removes it as soon as the navbar group exists — we only police the
    // logged-out window (probe result) and let everything else alone
    if (isAdmin === false || isAdmin === null) {
      document.querySelectorAll(".bca-fab").forEach((fab) => {
        if (!document.querySelector(".navbar.fixed-top .bca-navcopy")) {
          if (isAdmin === null) return; // unknown yet — don't touch
          fab.remove();
        }
      });
    }
  }

  // #4: the app's own admin link must open in the SAME tab (owner request).
  // Runs inside the existing 1.2 s loop — no separate file/wiring needed.
  function fixAdminLinks() {
    document.querySelectorAll('a[href="/admin"][target="_blank"]').forEach((a) => {
      a.target = "_self";
      a.removeAttribute("rel"); // noopener is only meaningful for _blank
    });
  }

  // #5: the bundled app hardcodes "Our Discussion Room 2.4" in document.title
  // (minified Jl() helper, set on every route render). The version lives in
  // package.json (now 4.0.0) — so we rewrite the stale suffix in the DOM
  // title; the loop re-applies it whenever React resets it.
  function fixTitle() {
    const t = document.title;
    if (t.includes("Our Discussion Room 2.4")) {
      document.title = t.split("Our Discussion Room 2.4").join("Our Discussion Room 4.0");
    } else if (t.includes(" 2.4")) {
      document.title = t.replace(/ 2\.4(\b|$)/, " 4.0");
    }
  }

  // probe pacing (owner report): every 1.2 s while logged in, 6 s while
  // logged out — but a VISIBLE LOGIN FORM means the user is typing right
  // now (owner task 2026-11-07: the post-login icons appeared only after a
  // manual refresh) — probe densely so the 401→200 flip is caught within
  // ~2 s and the bca:session event fires while the chat is mounting.
  const loginFormVisible = () =>
    [...document.querySelectorAll('input[type="password"]')].some((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && el.offsetParent !== null;
    });
  let uiTick = 0;
  async function uiLoop() {
    uiTick++;
    // single /api/users/me poll (the session hub); DOM fixes run every tick
    await probe();
    detectHiddenPanel();
    apply();
    fixFab();
    fixAdminLinks();
    fixTitle();
    // dense while logged in (1.2 s), while the login form is on screen
    // (1.2 s), otherwise sparse (6 s) — anonymous visitors still stay light
    const dense = sessionPollDelay === 1200 || loginFormVisible();
    setTimeout(uiLoop, dense ? 1200 : 6000);
  }
  uiLoop();
  fixAdminLinks();
  fixTitle();
})();

/* ===== bundle source: addons/tray-picker.js ===== */
/* Plus-reaction picker upgrade — standalone addon for "Our Discussion Room".
   Owner request #5: the "+" custom-reaction picker gets the FULL emoji
   catalogue used by the app's chat-box tray (1,849 emojis, 8 categories —
   extracted from the bundle into tray-emoji.json next to this file).
   Owner request #4: custom reactions sometimes failed with
   "রিয়েকশন দেওয়া যায়নি — আবার চেষ্টা করুন" on Render. Root causes fixed here:
     a) the addon used its own second socket for reactions; on slow networks
        (Render cold start) that extra handshake often wasn't ready, and
        timeouts showed the error. The picker now drives the APP'S OWN
        quick-reaction buttons (synthetic click), so the app's own socket —
        the exact path that already works — does the sending.
     b) the virtualized list reuses DOM ids; an id read from a stale bubble
        could miss on the server → invalid_error. We only act on bubbles that
        are actually in the DOM right now, and verify the message id matches
        the newest render by re-reading it at click time.
   Owner request (v13, one-surface rule): reactions go through the SAME http
   path as every other addon call (POST /api/chat/react — REST twin of the
   socket event); the UI updates via the APP'S OWN socket broadcast, exactly
   like the default-emoji buttons. NO background addon websocket is opened
   any more; the legacy socket path below exists only as a fallback for very
   old backends without the REST twin, and connects lazily on first use.
   Pre-warmed in the background: the emoji catalogue only (one static JSON).
   This file is standalone and does not edit the minified app or addon.js.

   v20 (owner task 2026-11-07, "২ নং ১ নং-এর একই প্রসেসে, একই সকেটে পাঠাবে"):
   the addon's SECOND socket is GONE entirely. 1 sends on the app's socket
   (same server process, same handler, same broadcast room); 2 now sends on
   the REST twin in that SAME server process — same handleReactMessage, same
   io.emit reactedMessage room — and, like 1's ack, the server's reply is the
   authoritative merged reactions, applied to the DOM immediately (no wait
   for the broadcast frame; 1's socket applies its ack the same way). Failed
   sends hold silently in the v16 queue (2.5 s retry, max 2 min) instead of
   erroring. No socket.io script load, no handshake, no warm loop, no
   /socket.io/socket.io.js dependency — one HTTP POST per click, like 1.
*/
(() => {
  "use strict";
  if (window.__bcaTrayPicker) return;
  window.__bcaTrayPicker = true;
  // silent (owner request 2026-11-08: no console noise; version in the file header)

  let catalogue = null; // { categories: [{id, emojis:[{n, e}]}] }
  let catalogueLoading = null;

  function loadCatalogue() {
    if (catalogue) return Promise.resolve(catalogue);
    if (catalogueLoading) return catalogueLoading;
    catalogueLoading = fetch("/addons/tray-emoji.json", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || !Array.isArray(data.categories) || !data.emojis) return null;
        const categories = data.categories
          .map((c) => ({
            id: c.id,
            emojis: (c.emojis || [])
              .map((id) => data.emojis[id])
              .filter(Boolean)
              .map((e) => ({ n: e.name || e.id, e: e.skins?.[0]?.native || e.native || "" }))
              .filter((x) => x.e),
          }))
          .filter((c) => c.emojis.length);
        catalogue = { categories };
        return catalogue;
      })
      .catch(() => null)
      .finally(() => {
        // a failed fetch (502 while the Render server wakes) must not stay
        // cached forever — the next call retries
        if (!catalogue) catalogueLoading = null;
      });
    return catalogueLoading;
  }

  const T = {
    en: {
      search: "Search…", noRes: "No emoji matched", recent: "Frequently used", more: "More reactions",
    },
    bn: {
      search: "খুঁজুন…", noRes: "কোনো ইমোজি মেলেনি", recent: "ঘনঘন ব্যবহৃত", more: "আরও রিয়্যাকশন",
    },
  };

  // ---------- click queue (the "1"-parity buffer — v16) ----------
  // The app's own socket client buffers emits while the link is down and
  // flushes them on reconnect — that's why the default-emoji buttons seem
  // to "always apply by themselves" during server sleep. The REST path now
  // mirrors that: a click made while the server is asleep/waking is HELD
  // here and retried until it lands (max 2 min), instead of giving up with
  // an error. SILENT by design (owner request): no chips, no explanations —
  // the reaction just appears when it lands.
  const reactQueue = []; // { id, emoji, username, reactions, firstAt }
  let reactBusy = false;
  const REACT_QUEUE_MAX_MS = 120000;

  function queueReact(item) {
    if (reactQueue.some((q) => q.id === item.id && q.emoji === item.emoji)) return; // already pending
    reactQueue.push(item);
  }

  async function processReactQueue() {
    if (reactBusy || !reactQueue.length) return;
    reactBusy = true;
    const item = reactQueue[0];
    try {
      // fresh payload from the current DOM (covers toggles while pending);
      // captured payload only if the bubble is gone (e.g. deleted message)
      const bubble = document.getElementById("message-" + item.id);
      const reactions = (bubble && document.contains(bubble))
        ? togglePayload(readReactionsFromDom(bubble), item.emoji, item.username)
        : item.reactions;
      if (reactions[item.emoji] && !reactions[item.emoji].usernames.some((u) => u === item.username))
        reactions[item.emoji].usernames.push(item.username);
      item.reactions = reactions;
      // v20: REST only — the same server-side handler + broadcast room as the
      // app's own socket path ("1"). There is no addon socket any more.
      const ctrl = new AbortController();
      const abortT = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch("/api/chat/react", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, reactions }),
        signal: ctrl.signal,
      });
      clearTimeout(abortT);
      if (!res.ok) {
        if (res.status === 401) throw { drop: true }; // logged out — drop silently
        throw { retryable: true };
      }
      const merged = await res.json().catch(() => null);
      if (merged && merged.reactions) {} // v21: React paints via broadcast — no hand-paint
      reactQueue.shift();
    } catch (err) {
      const expired = Date.now() - item.firstAt > REACT_QUEUE_MAX_MS;
      if (err?.drop) {
        reactQueue.shift(); // logged out — silent
      } else if (!(err?.retryable && !expired)) {
        reactQueue.shift(); // truly failed after the hold window — silent
      }
      // retryable & not expired → stay queued; nothing is shown
    } finally {
      reactBusy = false;
    }
  }
  setInterval(processReactQueue, 2500);
  const curLang = () => (localStorage.getItem("langPref") === "en" ? "en" : "bn");

  // ---------- drive the app's own quick-reaction chips ----------
  function quickChipFor(bubble, emoji) {
    // only a chip that ALREADY shows this exact emoji may be clicked —
    // clicking a different emoji's chip would toggle THAT emoji instead
    const chips = [...bubble.querySelectorAll(".reaction-emoji")];
    return chips.find((chip) => (chip.textContent || "").trim().startsWith(emoji)) || null;
  }

  function appReactionClick(bubble, emoji) {
    if (!bubble || !document.contains(bubble)) return false;
    // the app's own quick-reaction row (only ~6 fixed emojis — a custom
    // emoji will never match, which is correct) or an existing chip that
    // already shows this exact emoji; anything else → let the socket path run
    const rowBtns = [...bubble.querySelectorAll("button, .quick-reaction, .reaction-option")]
      .map((el) => ({ el, text: (el.textContent || "").trim() }))
      .filter((x) => x.text === emoji);
    if (rowBtns[0]?.el) { rowBtns[0].el.click(); return true; }
    const chip = quickChipFor(bubble, emoji);
    if (chip) {
      const inner = chip.querySelector("div[onclick], div");
      (inner || chip).click();
      return true;
    }
    return false;
  }

  // ---------- v21: instant visibility WITHOUT double painting ----------
  // v20 painted the ack payload into the DOM by hand. But this server
  // broadcasts reactedMessage to the SENDER too (io.emit, sender included),
  // so React re-rendered the same reaction from its own state a moment
  // later — and a hand-appended node is invisible to React's reconciliation,
  // so BOTH stayed: the reaction showed twice until a reload (owner report).
  // 1 never paints by hand either — its ack updates app state and React
  // renders it. v21 does the same: the ONLY real painter is React via the
  // broadcast. For instant feedback a marked temporary chip is shown, and a
  // MutationObserver removes it the moment React's own chip for the same
  // emoji appears (before paint, so no double is ever visible); a stale
  // sweep covers the case where the broadcast never arrives.
  const mineWatch = new MutationObserver((muts) => {
    for (const m of muts) {
      const wrap = m.target;
      wrap.querySelectorAll(".reaction-emoji[data-bca-mine]").forEach((tmp) => {
        const first = tmp.querySelector("div > div");
        const mm = first && (first.textContent || "").match(/^([\s\S]+?)\s+\d+$/);
        const emoji = mm ? mm[1] : null;
        if (!emoji) return;
        const real = [...wrap.querySelectorAll(".reaction-emoji")].find((c) => {
          if (c === tmp || c.dataset.bcaMine) return false;
          const f = c.querySelector("div > div");
          const t = f ? f.textContent || "" : "";
          return t === emoji || t.startsWith(emoji + " ");
        });
        if (real) tmp.remove(); // React painted the real one — ours steps aside
      });
    }
  });
  const watchedWraps = new WeakSet();
  function ensureWatched(wrap) {
    if (watchedWraps.has(wrap)) return;
    watchedWraps.add(wrap);
    mineWatch.observe(wrap, { childList: true });
  }
  function markChipAsOurs(bubble, emoji) {
    const wrap = bubble.querySelector(".reactions");
    if (!wrap) return;
    ensureWatched(wrap);
    // if a real chip for this emoji already exists, nothing to preview
    for (const chip of wrap.querySelectorAll(".reaction-emoji")) {
      const first = chip.querySelector("div > div");
      const m = first && (first.textContent || "").match(/^([\s\S]+?)\s+(\d+)$/);
      if (m && m[1] === emoji && !chip.dataset.bcaMine) return;
    }
    const chip = document.createElement("div");
    chip.className = "reaction-emoji";
    chip.dataset.bcaMine = "1";
    chip.__bcaMineAt = Date.now();
    const outer = document.createElement("div");
    const inner = document.createElement("div");
    inner.textContent = emoji + " 1";
    inner.addEventListener("click", () => { chip.remove(); window.__bcaRestReact?.(bubble, emoji); });
    const list = document.createElement("div");
    list.className = "reaction-username-list";
    outer.appendChild(inner);
    chip.appendChild(outer);
    chip.appendChild(list);
    wrap.appendChild(chip);
  }
  setInterval(() => {
    // a marked chip older than 6 s means the broadcast never replaced it
    // (message scrolled away / queue still pending) — drop the preview
    document.querySelectorAll(".reaction-emoji[data-bca-mine]").forEach((chip) => {
      if (!chip.__bcaMineAt) chip.__bcaMineAt = Date.now();
      else if (Date.now() - chip.__bcaMineAt > 6000) chip.remove();
    });
  }, 2000);
  function readReactionsFromDom(bubble) {
    const reactions = {};
    bubble.querySelectorAll(".reaction-emoji").forEach((chip) => {
      const first = chip.querySelector("div > div");
      if (!first) return;
      const text = first.textContent || "";
      const m = text.match(/^([\s\S]+?)\s+(\d+)$/);
      if (!m) return;
      const userNames = [...chip.querySelectorAll(".reaction-username")].map((p) => p.textContent.trim());
      reactions[m[1]] = { usernames: userNames };
    });
    return reactions;
  }
  function togglePayload(msgReactions, emoji, username) {
    const reactions = {};
    for (const key of Object.keys(msgReactions || {})) {
      reactions[key] = { usernames: [...(msgReactions[key]?.usernames || [])] };
    }
    const list = reactions[emoji]?.usernames || [];
    reactions[emoji] = { usernames: list.includes(username) ? list.filter((u) => u !== username) : [...list, username] };
    return reactions;
  }
  let meUser = null;
  async function fetchMeOnce() {
    // session from the shared hub (window.__bcaSession) — no extra HTTP call
    if (meUser) return meUser;
    const sess = window.__bcaSession;
    if (sess?.loggedIn && sess.me) meUser = sess.me;
    return meUser;
  }
  // expose the REST-reaction helper for other addons — the addon layer's
  // single shared surface (no per-addon sockets anywhere; owner request)
  window.__bcaRestReact = socketReact;

  async function socketReact(bubble, emoji) {
    if (!bubble || !document.contains(bubble)) return false;
    const me = await fetchMeOnce();
    if (!me?.username) return false;
    const id = parseInt(String(bubble.id || "").replace("message-", ""), 10);
    if (!Number.isFinite(id)) return false;
    const reactions = togglePayload(readReactionsFromDom(bubble), emoji, me.username);
    // ensure the target emoji's entry exists with MY username toggled —
    // for a brand-new custom emoji readReactionsFromDom knows nothing, so
    // the toggle must add the user explicitly
    if (!reactions[emoji] || !Array.isArray(reactions[emoji].usernames))
      reactions[emoji] = { usernames: [] };
    if (!reactions[emoji].usernames.some((u) => u === me.username))
      reactions[emoji].usernames.push(me.username);
    // PRIMARY + ONLY PATH (v20/v21, owner task "same socket as 1"): POST
    // /api/chat/react — the REST twin INSIDE the app's own server process.
    // Same handleReactMessage as the socket event; the reactedMessage
    // broadcast (sender included) makes React paint the real chip. v21:
    // while the POST is in flight, a marked preview chip gives the instant
    // feedback — it steps aside the moment React's own chip appears.
    markChipAsOurs(bubble, emoji);
    try {
      const ctrl = new AbortController();
      const abortT = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch("/api/chat/react", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, reactions }),
        signal: ctrl.signal,
      });
      clearTimeout(abortT);
      if (res.ok) {
        // v21: NO hand-paint. The server broadcasts reactedMessage to the
        // sender too; React renders from its own state — same as 1's ack
        // path. Our preview chip (markChipAsOurs) covers the visual gap
        // until the broadcast lands, then steps aside automatically.
        return true;
      }
      if (res.status === 401) return false; // logged out — nothing to hold
      console.warn("[bca] reaction REST rejected:", res.status);
      return false;
    } catch (err) {
      // unreachable = server asleep/waking — silent buffer (v16), never an error
      console.warn("[bca] reaction REST unreachable — queued:", err?.message || err);
      queueReact({ id, emoji, username: me.username, reactions, firstAt: Date.now() });
      return true;
    }
  }

  // ---------- the picker UI ----------
  let pop = null;
  let currentBubble = null;

  function closePop() {
    if (pop) { pop.remove(); pop = null; currentBubble = null; }
    document.removeEventListener("mousedown", outside, true);
    document.removeEventListener("keydown", esc, true);
  }
  function outside(e) {
    if (pop && !pop.contains(e.target) && !e.target.closest?.(".bca-react-plus")) closePop();
  }
  function esc(e) { if (e.key === "Escape") closePop(); }

  function renderGrid(q) {
    if (!pop || !catalogue) return;
    const grid = pop.querySelector(".bca-tgrid");
    const catsBar = pop.querySelector(".bca-tcats");
    const lang = T[curLang()];
    grid.textContent = "";
    if (!q) {
      const recent = [...(JSON.parse(localStorage.getItem("bcaRecentEmoji") || "[]"))].slice(0, 24);
      if (recent.length) {
        const head = document.createElement("div");
        head.className = "bca-tcat-head";
        head.textContent = lang.recent;
        grid.appendChild(head);
        for (const e of recent) {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "bca-temoji";
          b.textContent = e;
          b.addEventListener("click", () => pick(e));
          grid.appendChild(b);
        }
      }
    }
    const scan = catalogue.categories;
    let shown = 0;
    for (const cat of scan) {
      const items = q
        ? cat.emojis.filter((x) => x.n.toLowerCase().includes(q) || x.e === q)
        : cat.emojis;
      if (!items.length) continue;
      const head = document.createElement("div");
      head.className = "bca-tcat-head";
      head.textContent = cat.id;
      grid.appendChild(head);
      for (const { n, e } of items) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "bca-temoji";
        b.textContent = e;
        b.title = n;
        b.addEventListener("click", () => pick(e));
        grid.appendChild(b);
        shown++;
      }
    }
    if (!shown) {
      const none = document.createElement("div");
      none.className = "bca-tnone";
      none.textContent = lang.noRes;
      grid.appendChild(none);
    }
    // category chips (jump links)
    catsBar.textContent = "";
    for (const cat of scan) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "bca-tcat";
      chip.textContent = cat.id;
      chip.addEventListener("click", () => {
        const heads = [...grid.querySelectorAll(".bca-tcat-head")];
        const target = heads.find((h) => h.textContent === cat.id);
        target?.scrollIntoView({ block: "start" });
      });
      catsBar.appendChild(chip);
    }
  }

  async function pick(emoji) {
    // capture the bubble BEFORE closePop() — closePop nulls currentBubble,
    // and the bubble element must survive the popup closing (owner-reported
    // TypeError: bubble is null)
    const bubble = currentBubble;
    if (!bubble) { closePop(); return; }
    if (!document.contains(bubble)) { closePop(); return; } // stale render
    // remember recents
    try {
      const rec = JSON.parse(localStorage.getItem("bcaRecentEmoji") || "[]");
      const next = [emoji, ...rec.filter((x) => x !== emoji)].slice(0, 24);
      localStorage.setItem("bcaRecentEmoji", JSON.stringify(next));
    } catch { /* ignore */ }
    closePop();
    // v20: same-send-path rule (owner task) — the app's quick-reaction row
    // clicks go through the app's own socket (that IS "1"); everything else
    // goes through the REST twin inside the SAME server process/socket room,
    // with the ack-style reply applied to the DOM instantly.
    if (appReactionClick(bubble, emoji)) return;
    const ok = await socketReact(bubble, emoji);
    if (!ok) {
      console.warn("[bca] reaction not sent — emoji:", emoji, "bubble id:", bubble.id);
    }
  }

  function openPop(anchor, bubble) {
    closePop();
    currentBubble = bubble;
    pop = document.createElement("div");
    pop.className = "bca-tpop";
    pop.innerHTML = `
      <input type="text" class="bca-tsearch" />
      <div class="bca-tcats"></div>
      <div class="bca-tgrid"></div>`;
    document.body.appendChild(pop);
    const search = pop.querySelector(".bca-tsearch");
    search.placeholder = T[curLang()].search;
    search.addEventListener("input", () => renderGrid(search.value.trim().toLowerCase()));
    renderGrid("");
    const r = anchor.getBoundingClientRect();
    const w = Math.min(340, innerWidth - 16);
    pop.style.width = w + "px";
    pop.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + "px";
    const below = r.bottom + 8 + pop.offsetHeight < innerHeight;
    pop.style.top = (below ? r.bottom + 8 : Math.max(8, r.top - pop.offsetHeight - 8)) + "px";
    t0Focus();
    function t0Focus() { setTimeout(() => search.focus(), 30); }
    setTimeout(() => {
      document.addEventListener("mousedown", outside, true);
      document.addEventListener("keydown", esc, true);
    }, 0);
  }

  // ---------- the "+" button: tray-picker is the SOLE owner ----------
  // It both CREATES the button (far right of the app's quick-reaction row in
  // the message context-menu) and HOOKS it. The main addon's creation is
  // disabled (v12) — without this the picker would have no door (the v12
  // regression: custom emojis seemed "off" entirely).
  function ensurePlusButtons() {
    if (pop) return; // picker already open
    document.querySelectorAll(".dropdown-menu.context-menu.show").forEach((menu) => {
      if (menu.querySelector(".bca-react-plus")) return;
      const msgRoot = menu.closest('[id^="message-"]');
      if (!msgRoot || !document.contains(msgRoot)) return;
      for (const row of menu.querySelectorAll(".dropdown-item, .menu-button")) {
        const emojiBtns = [...row.querySelectorAll(".btn")].filter(
          (b) => (b.textContent || "").trim().length <= 4
        );
        if (emojiBtns.length < 6) continue; // that's the reactions row, not others
        const plus = document.createElement("button");
        plus.type = "button";
        plus.className = "btn btn-outline-secondary btn-sm icon-button bca-react-plus";
        plus.textContent = "＋";
        plus.title = T[curLang()].more;
        plus.setAttribute("aria-label", T[curLang()].more);
        row.appendChild(plus); // far right of the emoji row
        break;
      }
    });
  }

  // ---------- hook the "+" buttons ----------
  function wire() {
    ensurePlusButtons();
    document.querySelectorAll(".bca-react-plus").forEach((btn) => {
      if (btn.__bcaWired) return;
      btn.__bcaWired = true;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const bubble = btn.closest('div[id^="message-"]');
        if (!bubble || !document.contains(bubble)) return;
        if (pop) { closePop(); return; }
        loadCatalogue().then((cat) => {
          if (!cat) return;
          openPop(btn, bubble);
        });
      }, true);
    });
  }

  const mo = new MutationObserver(() => wire());
  mo.observe(document.documentElement, { childList: true, subtree: true });
  wire();

  // ---------- login watcher + catalogue warm (v20) ----------
  // v20 removed the addon socket — nothing to keep warm any more. The hub
  // (window.__bcaSession) still gates the emoji-catalogue pre-fetch: one
  // static JSON, retried ~every 10 s while it is missing, zero after that.
  // Reactions themselves are a single POST per click (like 1) — no
  // handshake, no reconnection, no warm loop, no /socket.io dependency.
  let catalogueTriedAt = 0;
  // session hub subscriber — no own poll (owner request: এক কল, সবাই শোনে)
  function onSessionChange(loggedIn) {
    if (loggedIn && !catalogue && Date.now() - catalogueTriedAt >= 10000) {
      catalogueTriedAt = Date.now();
      loadCatalogue();
    }
  }
  let hubState = undefined;
  setInterval(() => {
    const sess = window.__bcaSession;
    if (!sess || sess.at === undefined) return;
    const st = sess.loggedIn;
    if (hubState !== st) { hubState = st; onSessionChange(st); }
    if (st && !catalogue && Date.now() - catalogueTriedAt >= 10000) {
      catalogueTriedAt = Date.now();
      loadCatalogue();
    }
  }, 1500);
})();

/* ===== bundle source: addons/fsnotice.js ===== */
/* Fullscreen login notice — standalone addon for "Our Discussion Room".
   Self-contained on purpose: it never touches public/addons/addon.js.
   Features:
   1) After every LOGIN (not on plain reloads) a black fullscreen DIV — no
      iframe, mobile-friendly — shows the admin's raw HTML/CSS/JS notice;
      the OK button ("বুঝেছি") hands the user back to the app. A TALL notice
      starts at the TOP; a SHORT one is centered vertically inside the div.
   2) The editor lives ONLY in the /admin page — a card right next to the
      app's own notice card, following the app's light/dark theme.
   3) While the overlay is open a socket event (updateFsNotice) refreshes it
      live when the admin saves a new version.
   4) Chat scroll guard: the bundled app force-jumps to the very bottom on
      every new message. This addon stops that jump while the user is reading
      mid-history, and keeps following the tail ONLY while the user is already
      at the bottom.
   Backend endpoints: GET/PUT /api/chat/getFsNotice|updateFsNotice
   (older backends answer 404 → the feature silently stays off).
*/
(() => {
  "use strict";
  if (window.__bcaFsNotice) return;
  window.__bcaFsNotice = true;

  // ---------- tiny shared bits ----------
  const FS_SEEN_KEY = "bcaFsNoticeSeenLoginAt";
  let fsNoticeCache = null; // { notice, updatedAt } — null = not fetched yet
  let fsSupported = true;   // flips false on a 404 (older backend)
  let loggedIn = false;
  let me = null;
  let shownFor = null;      // loginAt already shown during this page-load
  let fsNoticeWatchHooked = false; // set once hookSocket() runs (polling mode)

  const curLang = () => (localStorage.getItem("langPref") === "en" ? "en" : "bn");
  /** tiny setTimeout helper used for retries/toasts */
  const t = (ms, fn) => setTimeout(fn, ms);
  const STRINGS = {
    en: {
      ok: "Understood",
      editorTitle: "Fullscreen notice",
      editorLabel: "HTML / CSS / JS code (one line)",
      editorHint: "A black fullscreen page showing this HTML/CSS/JS — every user sees it right after login and presses the button to enter the chat. Write it as ONE line; use <br> for line breaks. Tall notices start at the top, short ones are centered. It loads only for logged-in users, once per login.",
      save: "Save notice",
      saving: "Saving…",
      preview: "Preview",
      clear: "Clear",
      clearConfirm: "Clear the fullscreen notice? It saves empty immediately — nobody will see it on the next login.",
      savedMsg: "✓ Fullscreen notice saved",
      tooLarge: "The code is too large — shorten it a little",
      sessionExpired: "Session expired — reload the page and log in again",
      noServer: "Can't reach the server",
      saved: "✓ Saved",
      fetchFail: "Couldn't load data",
      chars: "chars",
      cardBadge: "addon",
      okLabelLabel: "Button text (empty = \"Understood\")",
      btnAlignLabel: "Button position",
      btnAlignLeft: "Left", btnAlignCenter: "Center", btnAlignRight: "Right",
      modeLabel: "Message storage (server speed)",
      modeGist: "GitHub Gist — durable (slower)",
      modeMemory: "RAM — fast (messages lost on redeploy)",
      modeHint: "Users & settings always stay on the Gist in both modes.",
      modeSaved: "✓ Storage mode saved",
    },
    bn: {
      ok: "বুঝেছি",
      editorTitle: "ফুল স্ক্রিন নোটিশ",
      editorLabel: "HTML / CSS / JS কোড (এক লাইন)",
      editorHint: "কালো ফুল-স্ক্রিন পেজে এই HTML/CSS/JS-ই দেখাবে — প্রত্যেক ইউজার লগইনের পরপরই এটা দেখবে, বাটন চাপলে চ্যাটে ঢুকবে। এক লাইনে লিখুন; লাইন ভাঙতে <br> দিন। বড় নোটিশ উপর থেকে শুরু হয়, ছোটটা মাঝখানে দেখায়। লোড হয় শুধু লগইন-করা ইউজারের জন্য, লগইনে একবার।",
      save: "নোটিশ সেভ করুন",
      saving: "সেভ হচ্ছে…",
      preview: "প্রিভিউ",
      clear: "মুছে ফেলুন",
      clearConfirm: "ফুল স্ক্রিন নোটিশ মুছে ফেলব? সাথে সাথে খালি সেভ হবে — পরের লগইনে আর কেউ দেখবে না।",
      savedMsg: "✓ ফুল স্ক্রিন নোটিশ সেভ হয়েছে",
      tooLarge: "কোডটা অনেক বড় — একটু ছোট করুন",
      sessionExpired: "সেশন শেষ — পেজ রিলোড করে আবার লগইন করুন",
      noServer: "সার্ভারে পৌঁছানো যাচ্ছে না",
      saved: "✓ সেভ হয়েছে",
      fetchFail: "তথ্য আনা যায়নি",
      chars: "অক্ষর",
      cardBadge: "অ্যাড-অন",
      okLabelLabel: "বাটনের লেখা (খালি = “বুঝেছি”)",
      btnAlignLabel: "বাটনের অবস্থান",
      btnAlignLeft: "বামে", btnAlignCenter: "মাঝে", btnAlignRight: "ডানে",
      modeLabel: "মেসেজ স্টোরেজ (সার্ভার গতি)",
      modeGist: "GitHub Gist — স্থায়ী (ধীর)",
      modeMemory: "RAM — দ্রুত (রিডিপ্লয়ে মেসেজ মুছে যাবে)",
      modeHint: "দুই অবস্থাতেই ইউজার ও সেটিংস Gist-এই থাকবে।",
      modeSaved: "✓ স্টোরেজ মোড সেভ হয়েছে",
    },
  };
  const S = () => STRINGS[curLang()];
  const appIsDark = () => !!document.querySelector(".navbar.bg-dark");

  function host() {
    let el = document.getElementById("bca-fs-root");
    if (!el) {
      el = document.createElement("div");
      el.id = "bca-fs-root";
      document.body.appendChild(el);
    }
    return el;
  }

  async function fetchJson(path, opts) {
    const res = await fetch(path, { credentials: "same-origin", ...(opts || {}) });
    if (!res.ok) return { status: res.status, body: null };
    return { status: res.status, body: await res.json().catch(() => null) };
  }

  // ---------- fullscreen overlay ----------
  function fsSeenLoginAt() {
    try { return localStorage.getItem(FS_SEEN_KEY) || ""; } catch { return ""; }
  }
  function markFsSeen(loginAt) {
    try { localStorage.setItem(FS_SEEN_KEY, loginAt || "?"); } catch { /* private mode */ }
  }

  /** innerHTML leaves <script> nodes inert — recreate them so admin JS runs */
  function activateScripts(container) {
    container.querySelectorAll("script").forEach((old) => {
      const s = document.createElement("script");
      if (old.src) s.src = old.src;
      s.type = old.type || "text/javascript";
      s.text = old.textContent || "";
      old.parentNode.replaceChild(s, old);
    });
  }

  function closeOverlay() {
    host().querySelectorAll(".bca-fsoverlay").forEach((x) => x.remove());
    document.body.classList.remove("bca-fslock");
  }

  function showOverlay(html, okLabel, align) {
    closeOverlay();
    const overlay = document.createElement("div");
    overlay.className = "bca-fsoverlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML = `
      <div class="bca-fscontent"><div class="bca-fsinner"></div></div>
      <div class="bca-fsbar" hidden>
        <button type="button" class="bca-fsok"></button>
      </div>`;
    const okBtn = overlay.querySelector(".bca-fsok");
    okBtn.textContent = okLabel || S().ok;
    if (okLabel) okBtn.dataset.custom = okLabel; // survives live language flips
    // owner request: the button may sit left/center/right (default left —
    // the historical inline flow)
    overlay.classList.add("bca-fsok-align-" + (align === "center" || align === "right" ? align : "left"));
    okBtn.addEventListener("click", closeOverlay);
    const inner = overlay.querySelector(".bca-fsinner");
    // admin-authored raw html/css/js — the SAME trust decision as the
    // attendance counter page (server stores it raw, only admins write)
    inner.innerHTML = html;
    activateScripts(inner);
    // the button lives INSIDE the scrolling content, right after the notice
    // (not pinned to the screen bottom); the fixed bar only appears for
    // very long notices so a button is always reachable
    const content = overlay.querySelector(".bca-fscontent");
    const bar = overlay.querySelector(".bca-fsbar");
    const tail = document.createElement("div");
    tail.className = "bca-fstail";
    // inline (owner request): the button flows on the SAME line where the
    // notice text ends — not on its own line below. Works because the
    // notice is authored as inline text + <br> lines; if the notice ends
    // with a block element (div/p), the button naturally starts after it.
    tail.style.display = "inline";
    tail.style.marginLeft = "10px";
    tail.appendChild(okBtn);
    inner.appendChild(tail);
    host().appendChild(overlay);
    document.body.classList.add("bca-fslock");
    hookSocket(); // polling-mode notice watch (no websocket — one shared addon surface)
    requestAnimationFrame(() => {
      if (content.scrollHeight > content.clientHeight + 40) bar.hidden = false;
    });
    // tall notice → starts at the TOP and scrolls down to the button; short
    // notice → the CSS auto-margins center it vertically inside the div
  }

  async function refetchNotice() {
    const got = await fetchJson("/api/chat/getFsNotice");
    if (got.status === 404) { fsSupported = false; return null; }
    if (got.status !== 200 || !got.body) return null; // transient
    fsNoticeCache = {
      notice: typeof got.body.notice === "string" ? got.body.notice : "",
      updatedAt: got.body.updatedAt || "",
      okLabel: typeof got.body.okLabel === "string" ? got.body.okLabel.slice(0, 60) : "",
      btnAlign: got.body.btnAlign === "center" || got.body.btnAlign === "right" ? got.body.btnAlign : "left",
      messageStoreMode: got.body.messageStoreMode === "gist" ? "gist" : "memory",
    };
    return fsNoticeCache;
  }

  /** show the notice when this is a NEW login (loginAt changed); plain
      reloads keep the same loginAt, so they never re-show it */
  async function maybeShow() {
    if (!loggedIn || !me || !fsSupported) return;
    // the addon's forced-credentials modal has priority — never stack on it
    if (document.querySelector(".bca-overlay")) return;
    if (host().querySelector(".bca-fsoverlay")) return;
    const html = (fsNoticeCache && fsNoticeCache.notice) || "";
    if (!html.trim()) return;
    const loginAt = String((me && me.loginAt) || "");
    if (shownFor !== null && shownFor === loginAt) return;
    if (loginAt && fsSeenLoginAt() === loginAt) return;
    shownFor = loginAt;
    markFsSeen(loginAt);
    showOverlay(fsNoticeCache.notice, fsNoticeCache.okLabel, fsNoticeCache.btnAlign);
  }

  // ---------- notice change watch (lightweight /users/me loginAt polling) ----------
  // The addon layer now shares ONE connection surface: no per-addon websocket
  // (owner request). A changed loginAt = a new login → refetch the notice and
  // (if an overlay is open) refresh it. For mid-session admin edits the
  // evaluate() loop refetches every ~5s ONLY while an overlay is actually on
  // screen — ~12 tiny JSON calls/min on one page per admin-edit session,
  // zero when nobody is reading the notice.
  function loadSocketClient() { return Promise.resolve(null); } // legacy hook — sockets retired
  async function hookSocket() {
    // The addon layer shares ONE connection surface now (owner request:
    // no per-addon websocket). Notice refresh = lightweight /users/me
    // loginAt-polling (see evaluate below); mid-session admin edits are
    // picked up by the overlay-open refetch loop.
    fsNoticeWatchHooked = true;
  }

  // ---------- tiny local toast (same look as the main addon's .bca-toast,
  // which lives in addon.js and must not be reached from here) ----------
  function showToast(message, isErr = false) {
    const el = document.createElement("div");
    el.className = "bca-toast" + (isErr ? " err" : "");
    el.textContent = message;
    host().appendChild(el);
    t(3200, () => el.remove());
  }

  // ---------- editor (the /admin card) ----------
  function makeEditor(box) {
    const s = S();
    box.classList.add("bca-fssetting");
    box.innerHTML = `
      <div class="bca-fslabel"></div>
      <div class="bca-fshint2"></div>
      <textarea class="bca-fseditor" spellcheck="false" wrap="off"></textarea>
      <div class="bca-fslabel bca-fsoklabel-label"></div>
      <input type="text" class="bca-fsoklabel" maxlength="60" />
      <div class="bca-fslabel bca-fsalignlabel"></div>
      <select class="bca-fsalign">
        <option value="left"></option>
        <option value="center"></option>
        <option value="right"></option>
      </select>
      <div class="bca-fslabel bca-fsmodelabel"></div>
      <div class="bca-fsmodeswitch">
        <label class="bca-fsmodeopt"><input type="radio" name="bca-fs-storemode" value="gist" /><span class="bca-fsmodegist"></span></label>
        <label class="bca-fsmodeopt"><input type="radio" name="bca-fs-storemode" value="memory" /><span class="bca-fsmodememory"></span></label>
      </div>
      <div class="bca-fshint2 bca-fsmodehint"></div>
      <div class="bca-fsbar2">
        <span class="bca-fscount"></span>
        <span class="bca-fsmsg"></span>
        <button type="button" class="bca-fsmini bca-fspreview"></button>
        <button type="button" class="bca-fssave"></button>
        <button type="button" class="bca-fsmini bca-fsclear"></button>
      </div>`;
    box.querySelector(".bca-fslabel").textContent = s.editorLabel;
    box.querySelector(".bca-fshint2").textContent = s.editorHint;
    const okLabelInput = box.querySelector(".bca-fsoklabel");
    box.querySelector(".bca-fsoklabel-label").textContent = s.okLabelLabel;
    okLabelInput.placeholder = s.ok;
    const alignSel = box.querySelector(".bca-fsalign");
    box.querySelector(".bca-fsalignlabel").textContent = s.btnAlignLabel;
    const alignOpts = { left: s.btnAlignLeft, center: s.btnAlignCenter, right: s.btnAlignRight };
    alignSel.querySelectorAll("option").forEach((o) => { o.textContent = alignOpts[o.value] || o.value; });
    box.querySelector(".bca-fsmodelabel").textContent = s.modeLabel;
    box.querySelector(".bca-fsmodegist").textContent = s.modeGist;
    box.querySelector(".bca-fsmodememory").textContent = s.modeMemory;
    box.querySelector(".bca-fsmodehint").textContent = s.modeHint;
    const modeRadios = () => [...box.querySelectorAll('input[name="bca-fs-storemode"]')];
    const editor = box.querySelector(".bca-fseditor");
    const count = box.querySelector(".bca-fscount");
    const msg = box.querySelector(".bca-fsmsg");
    const saveBtn = box.querySelector(".bca-fssave");
    const previewBtn = box.querySelector(".bca-fspreview");
    const clearBtn = box.querySelector(".bca-fsclear");
    saveBtn.textContent = s.save;
    previewBtn.textContent = s.preview;
    clearBtn.textContent = s.clear;
    const LIMIT = 100000;
    const paintCount = () => {
      count.textContent = `${editor.value.length.toLocaleString()} / ${LIMIT.toLocaleString()} ${s.chars}`;
      count.classList.toggle("over", editor.value.length > LIMIT);
    };
    editor.addEventListener("input", () => { paintCount(); msg.textContent = ""; });

    const saveNow = async (overrideHtml, overrideOkLabel, overrideMode, overrideAlign) => {
      const html = typeof overrideHtml === "string" ? overrideHtml : editor.value;
      const okLabel = typeof overrideOkLabel === "string" ? overrideOkLabel : okLabelInput.value.trim();
      const mode = typeof overrideMode === "string" ? overrideMode : (modeRadios().find((r) => r.checked)?.value || null);
      const align = typeof overrideAlign === "string" ? overrideAlign : (alignSel.value || "left");
      if (html.length > LIMIT) { msg.textContent = s.tooLarge; return false; }
      saveBtn.disabled = true;
      const label = saveBtn.textContent;
      saveBtn.textContent = s.saving;
      msg.textContent = "";
      try {
        const res = await fetch("/api/chat/updateFsNotice", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notice: html, okLabel, btnAlign: align, ...(mode ? { messageStoreMode: mode } : {}) }),
        });
        if (res.status === 401) { msg.textContent = s.sessionExpired; return false; }
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          msg.textContent = body && body.errorMessage ? body.errorMessage : s.fetchFail;
          return false;
        }
        editor.value = html;
        paintCount();
        msg.textContent = s.saved;
        fsNoticeCache = { notice: html, updatedAt: new Date().toISOString(), okLabel, btnAlign: align };
        return true;
      } catch {
        msg.textContent = s.noServer;
        return false;
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = label;
      }
    };

    saveBtn.addEventListener("click", () => saveNow());
    previewBtn.addEventListener("click", () => { if (editor.value.trim()) showOverlay(editor.value, okLabelInput.value.trim(), alignSel.value); });
    // button-position select saves immediately (same pattern as the storage mode)
    alignSel.addEventListener("change", async () => {
      const okNow = await saveNow(undefined, undefined, undefined, alignSel.value);
      if (okNow) showToast(s.saved);
    });
    modeRadios().forEach((radio) =>
      radio.addEventListener("change", async () => {
        const okNow = await saveNow(undefined, undefined, radio.value);
        if (okNow) showToast(s.modeSaved);
      })
    );

    clearBtn.addEventListener("click", async () => {
      if (!window.confirm(s.clearConfirm)) return;
      editor.value = "";
      okLabelInput.value = "";
      paintCount();
      await saveNow("", "");
    });

    refetchNotice().then(() => {
      if (fsNoticeCache) {
        editor.value = fsNoticeCache.notice;
        okLabelInput.value = fsNoticeCache.okLabel || "";
        alignSel.value = fsNoticeCache.btnAlign || "left";
        const mode = fsNoticeCache.messageStoreMode || "memory";
        modeRadios().forEach((r) => { r.checked = r.value === mode; });
        paintCount();
      }
    });
  }

  // ---------- /admin page: a card next to the app's own notice card ----------
  let adminCard = null;
  function removeAdminCard() {
    if (adminCard) { adminCard.remove(); adminCard = null; }
  }
  function ensureAdminCard() {
    if (!loggedIn || !me || !me.isAdmin || !fsSupported) { removeAdminCard(); return; }
    if (!/\/admin\b/.test(location.pathname)) { removeAdminCard(); return; }
    const noticeTextarea = document.getElementById("notice-body");
    if (!noticeTextarea) return; // admin page not rendered (yet)
    if (adminCard && document.contains(adminCard)) return;
    const s = S();
    const noticeCol = noticeTextarea.closest('[class*="col-"]') || noticeTextarea.closest(".card")?.parentElement;
    if (!noticeCol || !noticeCol.parentElement) return;
    const col = document.createElement("div");
    col.className = noticeCol.className.replace(/mb-\d+/, "mb-3"); // same grid column as the notice card
    col.innerHTML = `
      <div class="card bca-fsadmincard">
        <div class="card-body">
          <h5 class="card-title"><span class="bca-fsbadge"></span> <span class="bca-fscardtitle"></span></h5>
          <div class="bca-fscardmount"></div>
        </div>
      </div>`;
    col.querySelector(".bca-fsbadge").textContent = s.cardBadge;
    col.querySelector(".bca-fscardtitle").textContent = s.editorTitle;
    makeEditor(col.querySelector(".bca-fscardmount"));
    noticeCol.parentElement.insertBefore(col, noticeCol.nextSibling); // right beside the notice card
    adminCard = col;
  }

  // ---------- chat scroll guard ----------
  // The bundled app does `scroller.scrollTop = scroller.scrollHeight` on every
  // new message, which yanks a reader from mid-history. We remember whether
  // the user was at the bottom: if yes, keep following the tail (new messages
  // slide in and we stay pinned to the newest); if not, undo the yank by
  // restoring the reader's position.
  const scrollerState = new WeakMap(); // el -> { sticky, savedTop, hooked, observer }

  function findChatScroller() {
    const node = document.querySelector('div[id^="message-"]');
    let el = node?.parentElement;
    while (el && el !== document.body) {
      const cs = getComputedStyle(el);
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 50) return el;
      el = el.parentElement;
    }
    return null;
  }

  function hookScroller(sc) {
    let st = scrollerState.get(sc);
    if (!st) {
      st = { sticky: false, savedTop: null, hooked: false, observer: null };
      scrollerState.set(sc, st);
    }
    if (!st.hooked) {
      st.hooked = true;
      sc.addEventListener("scroll", () => {
        const atBottom = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 80;
        if (atBottom) {
          st.sticky = true;
        } else {
          st.sticky = false;
          st.savedTop = sc.scrollTop;
        }
      }, { passive: true });
      st.observer = new MutationObserver((muts) => {
        // only react when actual message nodes were added/removed
        let relevant = false;
        for (const m of muts) {
          for (const n of m.addedNodes) {
            if (n.nodeType === 1 && (n.matches?.('div[id^="message-"]') || n.querySelector?.('div[id^="message-"]'))) { relevant = true; break; }
          }
          if (relevant) break;
        }
        if (!relevant) return;
        setTimeout(() => {
          if (st.sticky) {
            sc.scrollTop = sc.scrollHeight; // keep pinned to the newest message
          } else if (st.savedTop !== null && Math.abs(sc.scrollTop - st.savedTop) > 4) {
            sc.scrollTop = st.savedTop; // undo the app's forced jump
          }
        }, 30);
      });
      st.observer.observe(sc, { childList: true, subtree: true });
    }
  }

  function ensureScrollGuard() {
    const sc = findChatScroller();
    if (sc) hookScroller(sc);
  }

  // ---------- session poller (1.2 s — mirrors the main addon) ----------
  let lastLang = curLang();
  let lastLoginAt = null;
  let lastOverlayFetch = 0; // throttle for the overlay-open notice refetch
  async function evaluate() {
    try {
      // session state comes from the shared hub (window.__bcaSession) — no own
      // /api/users/me call (owner request: এক কল, সবাই শোনে)
      const sess = window.__bcaSession;
      const next = sess?.loggedIn ? sess.me : null;
      if (!next) {
        if (loggedIn) {
          loggedIn = false; me = null; fsNoticeCache = null; shownFor = null; lastLoginAt = null;
          closeOverlay(); removeAdminCard();
        }
        return;
      }
      loggedIn = true;
      me = next;
      // a changed loginAt = a fresh login (also catches in-app logout→login
      // without a page reload) — refetch and show once per login
      const loginAt = String(next.loginAt || "");
      if (loginAt !== lastLoginAt) {
        lastLoginAt = loginAt;
        if (fsSupported) await refetchNotice();
        maybeShow();
      }
      // follow the app's light/dark theme for the /admin card + overlay bits
      document.body.classList.toggle("bca-fs-dark", appIsDark());
      ensureAdminCard();
      ensureScrollGuard();
      // mid-session admin edits: while an overlay is on screen, refetch the
      // notice every ~5s (lightweight JSON; zero cost when nothing is shown)
      if (fsSupported && host().querySelector(".bca-fsoverlay")) {
        if (lastOverlayFetch === 0 || Date.now() - lastOverlayFetch >= 5000) {
          lastOverlayFetch = Date.now();
          const had = fsNoticeCache;
          await refetchNotice();
          if (fsNoticeCache && fsNoticeCache.updatedAt !== (had && had.updatedAt)) {
            // always carry the cached okLabel/align — the refetch above just
            // refreshed them; dropping them reset the custom button text
            // (owner bug: edited label flipped back to "বুঝেছি")
            showOverlay(fsNoticeCache.notice, fsNoticeCache.okLabel, fsNoticeCache.btnAlign);
          }
        }
      } else {
        lastOverlayFetch = 0;
      }
      if (curLang() !== lastLang) {
        lastLang = curLang();
        const okBtn = host().querySelector(".bca-fsok");
        if (okBtn) okBtn.textContent = okBtn.dataset.custom || S().ok; // keep the admin's custom label
        const title = document.querySelector(".bca-fscardtitle");
        if (title) title.textContent = S().editorTitle;
        const badge = document.querySelector(".bca-fsbadge");
        if (badge) badge.textContent = S().cardBadge;
        // editor-card labels live-update too (align selector options included)
        const alignLabel = document.querySelector(".bca-fsalignlabel");
        if (alignLabel) alignLabel.textContent = S().btnAlignLabel;
        const alignSel = document.querySelector(".bca-fsalign");
        if (alignSel) {
          const alignOpts = { left: S().btnAlignLeft, center: S().btnAlignCenter, right: S().btnAlignRight };
          alignSel.querySelectorAll("option").forEach((o) => { o.textContent = alignOpts[o.value] || o.value; });
        }
        const okLabelLabel = document.querySelector(".bca-fsoklabel-label");
        if (okLabelLabel) okLabelLabel.textContent = S().okLabelLabel;
      }
    } catch { /* transient network hiccup */ }
  }

  // session hub subscriber (owner request): no own poll — ui-fixes.js owns
  // the single /api/users/me request; we react to state transitions and
  // keep the 5 s overlay-open refetch for mid-session admin edits.
  let hubState;
  setInterval(async () => {
    const sess = window.__bcaSession;
    if (!sess) return;
    await evaluate(); // hub-fed (no HTTP inside) — admin-card/scroll-guard/overlay-refetch
    if (hubState !== undefined && hubState === sess.loggedIn) return; // no transition
    hubState = sess.loggedIn;
    if (sess.loggedIn) {
      loggedIn = true;
      me = sess.me;
      if (fsSupported) await refetchNotice();
      maybeShow();
      ensureAdminCard();
      ensureScrollGuard();
    } else {
      if (loggedIn) {
        loggedIn = false; me = null; fsNoticeCache = null; shownFor = null;
        closeOverlay(); removeAdminCard();
      }
    }
  }, 1500);
})();

/* ===== bundle source: addons/media.js ===== */
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
