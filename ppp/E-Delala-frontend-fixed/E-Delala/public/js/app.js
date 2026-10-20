/* ============================================
   E-DELALA SHARED APP UTILITIES
   Header/footer rendering, toasts, modals, formatting.
   ============================================ */
(function () {
  function basePath() {
    // pages live at /, /customer/, /agent/, /admin/
    const parts = window.location.pathname.split("/").filter(Boolean);
    const inSubfolder = ["customer", "agent", "admin"].includes(parts[parts.length - 2]) ||
      ["customer", "agent", "admin"].includes(parts[0]) && parts.length > 1;
    return inSubfolder ? "../" : "./";
  }
  window.EDELALA_BASE = basePath();

  /* ---------------- Favicon / app icon ---------------- */
  (function addIcons() {
    const head = document.head || document.getElementsByTagName("head")[0];
    if (!head || head.querySelector('link[rel="icon"]')) return;
    const base = window.EDELALA_BASE;
    [["icon", "image/svg+xml", "img/logo-icon.svg"], ["apple-touch-icon", "", "img/logo-icon-180.png"]].forEach(([rel, type, href]) => {
      const l = document.createElement("link");
      l.rel = rel; if (type) l.type = type; l.href = base + href;
      head.appendChild(l);
    });
  })();

  /* ---------------- Back/forward cache safety ----------------
     If the browser restores this page from bfcache (e.g. after
     pressing the native Back button), force a fresh load so the
     header, nav and any auth-gated content reflect the current
     login state instead of a stale snapshot. This is what most
     often makes people think Back "logged them out". */
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) window.location.reload();
  });

  /* ---------------- Toasts ---------------- */
  function ensureToastRegion() {
    let region = document.querySelector(".toast-region");
    if (!region) {
      region = document.createElement("div");
      region.className = "toast-region";
      region.setAttribute("aria-live", "polite");
      document.body.appendChild(region);
    }
    return region;
  }
  function toast(message, type) {
    const region = ensureToastRegion();
    const el = document.createElement("div");
    el.className = "toast" + (type ? " " + type : "");
    el.textContent = message;
    region.appendChild(el);
    setTimeout(() => {
      el.style.transition = "opacity .25s ease";
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 250);
    }, 2600);
  }

  /* ---------------- Confirm modal ---------------- */
  function confirmDialog(message) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.innerHTML = `
        <div class="modal" role="alertdialog" aria-modal="true">
          <p style="margin:0 0 .5rem;font-weight:600;">${message}</p>
          <div class="modal-actions">
            <button class="btn btn-ghost" data-act="cancel">${I18N.t("common.cancel")}</button>
            <button class="btn btn-danger" data-act="confirm">${I18N.t("common.confirm")}</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) { overlay.remove(); resolve(false); }
        const act = e.target.getAttribute && e.target.getAttribute("data-act");
        if (act === "cancel") { overlay.remove(); resolve(false); }
        if (act === "confirm") { overlay.remove(); resolve(true); }
      });
    });
  }

  /* ---------------- Formatting ---------------- */
  function formatETB(n) {
    if (n === undefined || n === null || n === "") return "";
    return Number(n).toLocaleString("en-US") + " " + I18N.t("common.etb");
  }
  function initials(name) {
    if (!name) return "?";
    return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  }
  function timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const day = 86400000;
    const days = Math.floor(diff / day);
    if (days <= 0) return I18N.getLang() === "am" ? "ዛሬ" : "Today";
    if (days === 1) return I18N.getLang() === "am" ? "ትናንት" : "Yesterday";
    if (days < 30) return I18N.getLang() === "am" ? `${days} ቀናት በፊት` : `${days} days ago`;
    const months = Math.floor(days / 30);
    return I18N.getLang() === "am" ? `${months} ወራት በፊት` : `${months} months ago`;
  }
  function categoryLabel(cat) {
    return I18N.t({ HOUSE: "home.cat.houses", VEHICLE: "home.cat.vehicles", MACHINERY: "home.cat.machinery", SERVICE: "home.cat.services" }[cat] || "home.cat.houses");
  }
  function categoryIcon(cat) {
    return { HOUSE: "🏠", VEHICLE: "🚗", MACHINERY: "🚜", SERVICE: "🧹" }[cat] || "📦";
  }
  function cityLabel(city) {
    const map = { "Gondar": "common.city.gondar", "Addis Ababa": "common.city.addisAbaba", "Bahir Dar": "common.city.bahirDar", "Hawassa": "common.city.hawassa", "Mekelle": "common.city.mekelle", "Dire Dawa": "common.city.direDawa", "Dessie": "common.city.dessie" };
    return map[city] ? I18N.t(map[city]) : city;
  }
  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  }
  function verifiedStampHtml(size) {
    const cls = size === "sm" ? "stamp stamp-sm" : "stamp";
    return `<span class="${cls}" title="${escapeHtml(I18N.t("agentProfile.verified"))}">✓<br>${escapeHtml(I18N.t("agentProfile.verified"))}</span>`;
  }

  /* ---------------- Image compression ----------------
     Photos straight from a phone camera can be several MB each.
     Storing several of those as base64 in localStorage can blow
     past the browser's storage quota and make saving silently
     fail. Every photo upload in the app should go through this
     first: it resizes to a sane max dimension and re-encodes as
     a JPEG, which keeps each photo well under ~250KB in most
     cases while still looking sharp. Always resolves — falls
     back to the original file if anything goes wrong.
     ---------------------------------------------------- */
  function readImageCompressed(file, maxDim, quality) {
    maxDim = maxDim || 1280;
    quality = quality || 0.72;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onerror = () => resolve(null);
      reader.onload = () => {
        const original = reader.result;
        try {
          const img = new Image();
          img.onerror = () => resolve(original);
          img.onload = () => {
            try {
              let { width, height } = img;
              if (width > maxDim || height > maxDim) {
                if (width >= height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
                else { width = Math.round(width * (maxDim / height)); height = maxDim; }
              }
              const canvas = document.createElement("canvas");
              canvas.width = width; canvas.height = height;
              const ctx = canvas.getContext("2d");
              ctx.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL("image/jpeg", quality));
            } catch (e) {
              resolve(original);
            }
          };
          img.src = original;
        } catch (e) {
          resolve(original);
        }
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------------- In-app Back button ----------------
     A visible "Back" affordance so people don't have to rely on
     the browser's own Back button (which, on a static multi-page
     app, can land on a login page from history and make it look
     like they were signed out). Injected under the header on
     every page except the true homepage. */
  function renderBackBar() {
    const base = window.EDELALA_BASE;
    const path = window.location.pathname.split("/").pop() || "index.html";
    const isHome = base === "./" && path === "index.html";
    if (isHome) return;
    let bar = document.getElementById("back-bar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "back-bar";
      bar.className = "back-bar";
      const headerMount = document.getElementById("site-header");
      if (headerMount && headerMount.parentNode) {
        headerMount.parentNode.insertBefore(bar, headerMount.nextSibling);
      } else {
        document.body.insertBefore(bar, document.body.firstChild);
      }
    }
    bar.innerHTML = `<button type="button" class="back-bar-btn wrap" id="back-bar-btn">← <span data-i18n="common.back"></span></button>`;
    I18N.applyTranslations(bar);
    document.getElementById("back-bar-btn").addEventListener("click", () => {
      if (window.history.length > 1) window.history.back();
      else window.location.href = base + "index.html";
    });
  }

  /* ---------------- Header / Footer ---------------- */
  const NAV_CONFIG = {
    customer: [
      { key: "nav.home", href: "index.html" },
      { key: "nav.browse", href: "customer/browse.html" },
      { key: "nav.findDelala", href: "customer/find-delala.html" },
      { key: "nav.favorites", href: "customer/favorites.html", auth: true },
      { key: "nav.myRequests", href: "customer/requests.html", auth: true },
      { key: "nav.contactAdmin", href: "customer/contact.html" }
    ],
    agent: [
      { key: "nav.dashboard", href: "agent/dashboard.html" },
      { key: "nav.myListings", href: "agent/listings.html" },
      { key: "nav.addListing", href: "agent/add-listing.html" },
      { key: "nav.requests", href: "agent/requests.html" },
      { key: "nav.tasks", href: "agent/tasks.html" },
      { key: "nav.verification", href: "agent/verification.html" }
    ],
    admin: [
      { key: "nav.dashboard", href: "admin/dashboard.html" },
      { key: "nav.delalas", href: "admin/delalas.html" },
      { key: "nav.verification", href: "admin/verification.html" },
      { key: "nav.listings", href: "admin/listings.html" },
      { key: "nav.reports", href: "admin/reports.html" },
      { key: "nav.support", href: "admin/support.html" },
      { key: "nav.trust", href: "admin/trust.html" },
      { key: "nav.customers", href: "admin/customers.html" },
      { key: "nav.requests", href: "admin/requests.html" },
      { key: "nav.settings", href: "admin/settings.html" }
    ]
  };

  function currentPage() {
    return window.location.pathname.split("/").pop();
  }

  function renderHeader(portal) {
    const mount = document.getElementById("site-header");
    if (!mount) return;
    const base = window.EDELALA_BASE;
    const user = window.DB ? DB.currentUser() : null;
    const items = NAV_CONFIG[portal] || [];
    const page = currentPage();

    const navHtml = items
      .filter((it) => !it.auth || user)
      .map((it) => {
        const href = base + it.href;
        const isActive = page === it.href.split("/").pop();
        return `<a href="${href}" data-i18n="${it.key}" class="${isActive ? "active" : ""}"></a>`;
      })
      .join("");

    const portalLabel = { customer: "nav.portal.customer", agent: "nav.portal.agent", admin: "nav.portal.admin" }[portal];

    let actionsHtml = "";
    if (user && user.role.toLowerCase() === portal) {
      const profileHref = portal === "customer" ? base + "customer/profile.html" : (portal === "agent" ? base + "agent/profile.html" : base + "admin/settings.html");
      let avatarHtml = `<span class="avatar">${initials(user.fullName)}</span>`;
      if (user.role === "AGENT" && window.DB) {
        const ap = DB.getAgentProfile(user.id);
        if (ap && ap.photo) avatarHtml = `<img class="avatar avatar-img" src="${ap.photo}" alt="">`;
      }
      actionsHtml = `
        <a class="user-chip" href="${profileHref}" title="${escapeHtml(user.fullName)}">
          ${avatarHtml}
          <span class="user-chip-name">${escapeHtml(user.fullName)}</span>
        </a>
        <button class="btn btn-ghost btn-sm" id="logout-btn" data-i18n="nav.logout"></button>`;
    } else {
      const loginHref = portal === "customer" ? base + "customer/login.html" : (portal === "agent" ? base + "agent/login.html" : base + "admin/login.html");
      const registerHref = portal === "customer" ? base + "customer/register.html" : (portal === "agent" ? base + "agent/register.html" : "#");
      actionsHtml = `
        <a class="btn btn-ghost btn-sm" href="${loginHref}" data-i18n="nav.login"></a>
        ${portal !== "admin" ? `<a class="btn btn-primary btn-sm" href="${registerHref}" data-i18n="nav.register"></a>` : ""}`;
    }

    mount.innerHTML = `
      <header class="site-header">
        <div class="wrap">
          <a class="brand" href="${base}index.html">
            <span class="brand-mark" aria-hidden="true">
              <img src="${base}img/logo-icon.svg" width="38" height="38" alt="" style="display:block;border-radius:9px;">
            </span>
            <span class="brand-name">
              <span data-i18n="brand.name"></span>
              <small data-i18n="${portalLabel}"></small>
            </span>
          </a>
          <nav class="main-nav" id="main-nav">${navHtml}</nav>
          <div class="header-actions">
            <div class="lang-toggle" role="group" aria-label="Language">
              <button data-lang="en">EN</button>
              <button data-lang="am">አማ</button>
            </div>
            ${actionsHtml}
            <button class="hamburger" id="hamburger" aria-label="Menu" aria-expanded="false">
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>
      </header>`;

    I18N.applyTranslations(mount);

    mount.querySelectorAll(".lang-toggle button").forEach((btn) => {
      btn.addEventListener("click", () => I18N.setLang(btn.getAttribute("data-lang")));
    });
    const hamburger = mount.querySelector("#hamburger");
    const nav = mount.querySelector("#main-nav");
    hamburger.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      hamburger.setAttribute("aria-expanded", String(open));
    });
    const logoutBtn = mount.querySelector("#logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        DB.logout();
        window.location.href = base + (portal === "admin" ? "admin/login.html" : portal + "/login.html");
      });
    }
    renderBackBar();
  }

  function renderFooter() {
    const mount = document.getElementById("site-footer");
    if (!mount) return;
    const base = window.EDELALA_BASE;
    mount.innerHTML = `
      <footer class="site-footer">
        <div class="wrap foot-grid">
          <div>
            <h3 style="color:#fff;font-size:1.3rem;" data-i18n="brand.name"></h3>
            <p style="color:#d9c9ef;max-width:32ch;" data-i18n="brand.tagline"></p>
          </div>
          <div>
            <h4 data-i18n="nav.browse"></h4>
            <p><a href="${base}customer/browse.html?category=HOUSE" data-i18n="home.cat.houses"></a></p>
            <p><a href="${base}customer/browse.html?category=VEHICLE" data-i18n="home.cat.vehicles"></a></p>
            <p><a href="${base}customer/browse.html?category=MACHINERY" data-i18n="home.cat.machinery"></a></p>
            <p><a href="${base}customer/browse.html?category=SERVICE" data-i18n="home.cat.services"></a></p>
          </div>
          <div>
            <h4 data-i18n="nav.portal.customer"></h4>
            <p><a href="${base}customer/login.html" data-i18n="nav.login"></a></p>
            <p><a href="${base}customer/find-delala.html" data-i18n="nav.findDelala"></a></p>
          </div>
          <div>
            <h4 data-i18n="nav.portal.agent"></h4>
            <p><a href="${base}agent/register.html" data-i18n="home.cta.button"></a></p>
            <p><a href="${base}admin/login.html" data-i18n="nav.portal.admin"></a></p>
          </div>
        </div>
        <p class="foot-bottom">© 2026 E-Delala · ኢ-ደላላ. Built for demonstration purposes.</p>
      </footer>`;
    I18N.applyTranslations(mount);
  }

  /* ---------------- Auth form helpers ---------------- */
  // Translated message for a failed DB.login / DB.register result.
  function authError(res) {
    const key = "auth.err." + (res && res.code ? res.code : "GENERIC");
    const msg = I18N.t(key);
    return msg === key ? ((res && res.error) || I18N.t("auth.err.GENERIC")) : msg;
  }
  // Show / clear the inline error under a form field (uses .field.has-error).
  function setFieldError(inputId, message) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const field = input.closest(".field") || input.closest(".checkbox-row");
    if (!field) return;
    let err = field.querySelector(".error");
    if (!err) { err = document.createElement("div"); err.className = "error"; field.appendChild(err); }
    if (message) { err.removeAttribute("data-i18n"); err.textContent = message; field.classList.add("has-error"); }
    else { field.classList.remove("has-error"); }
  }

  // Wires up a Sign-up form (#register-form). Creates the account, then sends
  // the person to the login page with their email filled in — they must log in
  // with the email + password they just chose.
  function setupRegister(role, loginUrl) {
    const form = document.getElementById("register-form");
    if (!form) return;
    const val = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };
    form.querySelectorAll("input").forEach((el) => {
      el.addEventListener("input", () => setFieldError(el.id, ""));
      el.addEventListener("change", () => setFieldError(el.id, ""));
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const fullName = val("fullName").trim();
      const email = val("email").trim();
      const phone = val("phone").trim();
      const password = val("password");
      const confirmPassword = val("confirmPassword");
      const hasPhone = !!document.getElementById("phone");
      const hasAgree = !!document.getElementById("agree");
      let ok = true;
      const bad = (id, msg) => { setFieldError(id, msg); if (ok) { const el = document.getElementById(id); if (el) el.focus(); } ok = false; };

      if (fullName.length < 2) bad("fullName", I18N.t("common.required"));
      if (!DB.isValidEmail(email)) bad("email", I18N.t("common.invalidEmail"));
      if (hasPhone && !DB.isValidPhone(phone)) bad("phone", I18N.t("common.invalidPhone"));
      if (password.length < 6) bad("password", I18N.t("auth.err.WEAK_PASSWORD"));
      if (confirmPassword !== password) bad("confirmPassword", I18N.t("common.passwordMismatch"));
      if (hasAgree && !document.getElementById("agree").checked) bad("agree", I18N.t("auth.mustAgree"));
      if (!ok) return;

      const res = DB.register(role, { fullName, email, phone, password });
      if (!res.ok) {
        toast(authError(res), "error");
        if (res.code === "EMAIL_EXISTS" || res.code === "INVALID_EMAIL") setFieldError("email", authError(res));
        return;
      }
      window.location.href = loginUrl + "?registered=1&email=" + encodeURIComponent(res.user.email);
    });
  }

  // Wires up a Log-in form (#login-form) for one portal.
  // opts: { redirect: url, welcome: (user) => string }
  function setupLogin(role, opts) {
    const form = document.getElementById("login-form");
    if (!form) return;
    const emailEl = document.getElementById("email");
    const passEl = document.getElementById("password");
    [emailEl, passEl].forEach((el) => el.addEventListener("input", () => setFieldError(el.id, "")));

    const params = new URLSearchParams(window.location.search);
    if (params.get("registered") === "1") {
      const banner = document.getElementById("signup-success");
      if (banner) banner.style.display = "block";
      if (params.get("email")) { emailEl.value = params.get("email"); passEl.focus(); }
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const email = emailEl.value.trim();
      const password = passEl.value;
      setFieldError("email", ""); setFieldError("password", "");
      if (!DB.isValidEmail(email)) { setFieldError("email", I18N.t("common.invalidEmail")); emailEl.focus(); return; }
      if (!password) { setFieldError("password", I18N.t("common.required")); passEl.focus(); return; }

      const res = DB.login(email, password, role);
      if (!res.ok) {
        const msg = authError(res);
        toast(msg, "error");
        if (res.code === "WRONG_PASSWORD") { setFieldError("password", msg); passEl.focus(); }
        else { setFieldError("email", msg); emailEl.focus(); }
        return;
      }
      toast(opts.welcome ? opts.welcome(res.user) : "Welcome back!", "success");
      window.location.href = opts.redirect;
    });
  }

  function guardRole(role) {
    const base = window.EDELALA_BASE;
    const user = DB.currentUser();
    if (!user || user.role !== role) {
      const loginPage = role === "ADMIN" ? "admin/login.html" : role === "AGENT" ? "agent/login.html" : "customer/login.html";
      window.location.href = base + loginPage;
      return null;
    }
    return user;
  }

  const SIDEBAR_ICONS = {
    "nav.dashboard": "📊", "nav.myListings": "🏷️", "nav.addListing": "➕", "nav.requests": "📨",
    "nav.tasks": "📋", "nav.verification": "🛡️", "nav.delalas": "🤝", "nav.listings": "🏷️",
    "nav.reports": "🚩", "nav.trust": "⭐", "nav.customers": "👥", "nav.settings": "⚙️", "nav.support": "💬"
  };

  function renderDashSidebar(portal, activeHref) {
    const mount = document.getElementById("dash-sidebar");
    if (!mount) return;
    const base = window.EDELALA_BASE;
    const items = NAV_CONFIG[portal] || [];
    mount.innerHTML = `<nav>${items.map((it) => {
      const isActive = it.href.split("/").pop() === activeHref;
      const icon = SIDEBAR_ICONS[it.key] || "•";
      return `<a href="${base}${it.href}" class="${isActive ? "active" : ""}"><span>${icon}</span><span data-i18n="${it.key}"></span></a>`;
    }).join("")}</nav>`;
    I18N.applyTranslations(mount);
  }

  window.EDELALA = {
    toast, confirmDialog, formatETB, initials, timeAgo, categoryLabel, categoryIcon, cityLabel,
    escapeHtml, qs, verifiedStampHtml, renderHeader, renderFooter, guardRole, renderDashSidebar,
    readImageCompressed, renderBackBar, authError, setFieldError, setupRegister, setupLogin
  };
})();
