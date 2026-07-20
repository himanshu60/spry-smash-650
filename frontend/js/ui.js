/* =====================================================================
   HangOut — shared UI helpers
   Theme management, toasts, avatars, icons. Framework-free.
   ===================================================================== */
(function () {
  "use strict";

  /* ---------------- Theme ---------------- */
  const STORAGE_KEY = "hangout-theme";

  function systemTheme() {
    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function currentTheme() {
    return (
      document.documentElement.getAttribute("data-theme") ||
      localStorage.getItem(STORAGE_KEY) ||
      systemTheme()
    );
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }

  function toggleTheme() {
    applyTheme(currentTheme() === "dark" ? "light" : "dark");
  }

  const SUN_ICON =
    '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const MOON_ICON =
    '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

  /** Create (or upgrade) a theme toggle button. Returns the element. */
  function mountThemeToggle(target) {
    const el =
      typeof target === "string" ? document.querySelector(target) : target;
    if (!el) return null;
    el.classList.add("theme-toggle");
    el.setAttribute("type", "button");
    el.setAttribute("aria-label", "Toggle color theme");
    el.setAttribute("title", "Toggle theme");
    el.innerHTML = SUN_ICON + MOON_ICON;
    el.addEventListener("click", toggleTheme);
    return el;
  }

  /* ---------------- Toasts ---------------- */
  function ensureToastRoot() {
    let root = document.getElementById("toast-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "toast-root";
      document.body.appendChild(root);
    }
    return root;
  }

  function toast(message, opts) {
    opts = opts || {};
    const root = ensureToastRoot();
    const el = document.createElement("div");
    el.className = "toast " + (opts.type || "");
    el.setAttribute("role", "status");
    el.innerHTML =
      '<span class="dot"></span><span>' + escapeHtml(message) + "</span>";
    root.appendChild(el);
    const ttl = opts.duration || 3200;
    setTimeout(() => {
      el.classList.add("leaving");
      el.addEventListener("animationend", () => el.remove(), { once: true });
    }, ttl);
    return el;
  }

  /* ---------------- Avatars ---------------- */
  /** Initials from a name: "John Doe" -> "JD", "cher" -> "CH" */
  function initials(name) {
    if (!name) return "?";
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /** Deterministic hue from a string (stable per user). */
  function hueFor(str) {
    let h = 0;
    const s = String(str || "");
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return h;
  }

  /** Build an avatar element for a user. */
  function avatar(name, opts) {
    opts = opts || {};
    const el = document.createElement("span");
    el.className = "avatar" + (opts.size ? " " + opts.size : "");
    const h = hueFor(opts.seed || name);
    el.setAttribute("data-hue", "1");
    el.style.setProperty("--h", h);
    el.style.setProperty("--h2", (h + 40) % 360);
    el.textContent = initials(name);
    if (opts.presence) {
      const dot = document.createElement("span");
      dot.className = "presence" + (opts.presence === "online" ? " online" : "");
      el.appendChild(dot);
    }
    return el;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }

  /* ---------------- Expose ---------------- */
  window.UI = {
    currentTheme,
    applyTheme,
    toggleTheme,
    mountThemeToggle,
    toast,
    initials,
    hueFor,
    avatar,
    escapeHtml,
  };
})();
