/* Bird-chat addon layer.
   Runs alongside the bundled React app without touching it:
   1) forced password-change modal for the seeded default admin
   2) "copy all messages" button — lives in the navbar icon group
      (falls back to a floating button if the navbar isn't there)
   3) notice marquee fix — duration computed from the real text width
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
      },
      copyTitle: "Copy all messages",
      copySub: "The whole conversation — names, times and replies included",
      fmtTxt: "📝 Clean note (TXT)",
      fmtTxtDesc: "HTML stripped, ready for a notebook",
      fmtJson: "🧾 Raw data (JSON)",
      fmtJsonDesc: "Full details incl. reactions and edits",
      copyBtn: "📋 Copy",
      dlBtn: "⬇ Download",
      copied: (f) => `✓ Copied (${f})`,
      copyFail: "Couldn't copy — try again",
      dlStarted: "✓ Download started",
      dlFail: "Couldn't download",
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
      },
      copyTitle: "সব মেসেজ কপি করুন",
      copySub: "পুরো কথোপকথন — নাম, সময় ও উত্তরসহ",
      fmtTxt: "📝 সুন্দর নোট (TXT)",
      fmtTxtDesc: "HTML বাদ, নোট-বুকে রাখার উপযোগী",
      fmtJson: "🧾 কাঁচা ডেটা (JSON)",
      fmtJsonDesc: "রিঅ্যাকশন, সম্পাদনাসহ পূর্ণ তথ্য",
      copyBtn: "📋 কপি",
      dlBtn: "⬇ ডাউনলোড",
      copied: (f) => `✓ কপি হয়েছে (${f})`,
      copyFail: "কপি করা যায়নি — আবার চেষ্টা করুন",
      dlStarted: "✓ ডাউনলোড শুরু হয়েছে",
      dlFail: "ডাউনলোড করা যায়নি",
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
    try {
      const res = await fetch("/api/users/me", { credentials: "same-origin" });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

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
    pop.querySelector(".bca-sub").textContent = s.copySub;
    const titles = pop.querySelectorAll(".bca-fmt-title");
    const descs = pop.querySelectorAll(".bca-fmt-desc");
    titles[0].textContent = s.fmtTxt;
    descs[0].textContent = s.fmtTxtDesc;
    titles[1].textContent = s.fmtJson;
    descs[1].textContent = s.fmtJsonDesc;
    const closeBtn = pop.querySelector(".bca-close");
    closeBtn.title = s.close;
    closeBtn.setAttribute("aria-label", s.close);
    const buttons = pop.querySelectorAll(".bca-actions .bca-btn");
    buttons[0].textContent = s.copyBtn;
    buttons[1].textContent = s.dlBtn;
    host.appendChild(pop);

    closeBtn.addEventListener("click", closePopup);
    outsideHandler = (e) => {
      if (!pop.contains(e.target) && !e.target.closest(".bca-fab, .bca-navcopy")) closePopup();
    };
    escapeHandler = (e) => { if (e.key === "Escape") closePopup(); };
    t(30, () => {
      document.addEventListener("click", outsideHandler);
      document.addEventListener("keydown", escapeHandler);
    });

    const fmt = () => pop.querySelector("input[name=bca-fmt]:checked").value;

    const loadExport = async () => {
      const format = fmt();
      const res = await fetch(`/api/chat/export?format=${format}&lang=${curLang()}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error("export failed");
      const text = await res.text();
      return { format, text };
    };

    const copy = async (btn) => {
      buttons.forEach((b) => (b.disabled = true));
      try {
        const { format, text } = await loadExport();
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          // clipboard API denied — textarea fallback
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        closePopup();
        toast(s.copied(format.toUpperCase()));
      } catch {
        toast(s.copyFail, true);
      } finally {
        buttons.forEach((b) => (b.disabled = false));
      }
    };

    const download = async (btn) => {
      buttons.forEach((b) => (b.disabled = true));
      try {
        const { format, text } = await loadExport();
        const d = new Date();
        const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
        const blob = new Blob([text], { type: format === "json" ? "application/json" : "text/plain;charset=utf-8" });
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
        buttons.forEach((b) => (b.disabled = false));
      }
    };

    buttons[0].addEventListener("click", () => copy(buttons[0]));
    buttons[1].addEventListener("click", () => download(buttons[1]));
  }

  // bootstrap-icons "clipboard" — matches the app's own navbar icons
  const CLIPBOARD_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-clipboard" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zM9.5 0h-3a1.5 1.5 0 0 0-1.5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0z"/></svg>';

  let navBtn = null;

  function refreshCopyUi() {
    const s = S();
    if (navBtn && document.contains(navBtn)) {
      navBtn.title = s.menuCopy;
      navBtn.setAttribute("aria-label", s.menuCopy);
    }
    const fab = root().querySelector(".bca-fab span");
    if (fab) {
      const wrapper = fab.closest(".bca-fab");
      wrapper.title = s.menuCopy;
      wrapper.setAttribute("aria-label", s.menuCopy);
      fab.textContent = s.fabLabel;
    }
  }

  function togglePopup() {
    if (root().querySelector(".bca-popup")) closePopup();
    else showExportPopup();
  }

  /** insert the copy button into the navbar icon group (div.me-2) so it
      looks native; re-attach whenever React re-renders it away */
  function ensureCopyButton() {
    const nav = document.querySelector(".navbar.fixed-top");
    const group = nav
      ? nav.querySelector(":scope > .me-2") || nav.querySelector(".icon-button")?.parentElement
      : null;
    if (!group) {
      addFab(); // fallback while the chat navbar isn't mounted yet
      return;
    }
    // navbar is available — the floating fallback is no longer needed
    root().querySelectorAll(".bca-fab").forEach((x) => x.remove());
    if (navBtn && document.contains(navBtn)) {
      // keep it in place (last position of the icon group)
      if (navBtn.parentElement !== group || group.lastElementChild !== navBtn)
        group.appendChild(navBtn);
      return;
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-outline-secondary btn-sm icon-button bca-navcopy";
    btn.innerHTML = CLIPBOARD_SVG;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePopup(btn);
    });
    group.appendChild(btn);
    navBtn = btn;
    refreshCopyUi();
  }

  /** fallback when the navbar isn't available: floating button */
  function addFab() {
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
      togglePopup(fab);
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
      if (loggedIn) ensureCopyButton();
    });
  }

  // ---------- boot ----------
  // marquee fix + copy-button re-attachment run on every page, immediately
  const uiObserver = new MutationObserver(scanUi);
  uiObserver.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("resize", scanUi);
  scanUi();

  let loggedIn = false;
  function teardown() {
    loggedIn = false;
    if (navBtn) { navBtn.remove(); navBtn = null; }
    root().querySelectorAll(".bca-fab").forEach((x) => x.remove());
    closePopup();
  }

  async function evaluateSession() {
    const me = await fetchMe();
    if (!me) {
      if (loggedIn) teardown();
      return; // logged out — nothing to do
    }
    loggedIn = true;
    if (me.mustChangePassword) showForceChangeModal();
    else ensureCopyButton();
  }
  // the React app navigates without reloading, so re-check on every route
  // change, re-attach the button if React wiped it, and follow language flips
  let lastUrl = location.href;
  let lastLang = curLang();
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      evaluateSession();
    }
    if (curLang() !== lastLang) {
      lastLang = curLang();
      refreshCopyUi();
    }
    if (loggedIn) ensureCopyButton();
  }, 1200);
  evaluateSession();
})();
