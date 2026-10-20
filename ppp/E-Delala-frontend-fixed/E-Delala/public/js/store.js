/* ============================================
   E-DELALA STORE
   Frontend-only mock persistence layer.
   Stands in for the Node/Express + Prisma/SQLite backend
   described in the project spec. Every read/write here goes
   through localStorage so that actions (posting a listing,
   sending a request, approving verification, etc.) actually
   persist and flow between the three portals in this browser,
   the same way they would through a real API + database.
   Swap DB.* calls for fetch('/api/...') calls when the real
   backend is wired up — the shape of the data will not change.
   ============================================ */
(function () {
  const KEY = "edelala.db.v1";
  const SESSION_KEY = "edelala.session";

  const CITIES = ["Gondar", "Addis Ababa", "Bahir Dar", "Hawassa", "Mekelle", "Dire Dawa", "Dessie"];

  function uid(prefix) {
    return prefix + "_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
  }

  /* -------- placeholder image (SVG data URI) so the UI shows
     real <img> elements without needing network image assets -------- */
  function placeholderImg(seedText, w, h, bg, fg) {
    w = w || 480; h = h || 360; bg = bg || "5B2A86"; fg = fg || "FFFFFF";
    const label = encodeURIComponent(seedText || "E-Delala");
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>` +
      `<rect width='100%' height='100%' fill='#${bg}'/>` +
      `<text x='50%' y='50%' font-family='sans-serif' font-size='${Math.round(w / 14)}' fill='#${fg}' text-anchor='middle' dominant-baseline='middle'>${label}</text>` +
      `</svg>`;
    return "data:image/svg+xml," + svg.replace(/#/g, "%23");
  }

  /* ============================================
     SEED DATA
     The database starts EMPTY: there are no demo accounts. Every
     account (Customer, Delala, Admin) is created through the Sign up
     forms with a real email + password, and you then log in with
     that same email + password. The very first Admin account is
     created from the Admin login page (one-time setup); after that
     the setup form is closed.
     ============================================ */
  function buildSeed() {
    return {
      users: [], agentProfiles: [],
      listings: [], requests: [], tasks: [], reports: [], favorites: [], comments: [], supportMessages: [],
      settings: {
        siteName: "E-Delala", contactEmail: "support@edelala.demo",
        telebirrNumber: "0985074331", cbeAccount: "1000234567098", verificationFee: 500
      }
    };
  }

  /* ============================================
     PERSISTENCE
     ============================================ */
  // Backfills fields added in later versions so a database already
  // saved in someone's browser from an earlier version doesn't break
  // when newer code (comments, support messages, payment settings...)
  // reads from it.
  function migrate(db) {
    db.users = db.users || [];
    db.agentProfiles = db.agentProfiles || [];
    db.listings = db.listings || [];
    db.requests = db.requests || [];
    db.tasks = db.tasks || [];
    db.reports = db.reports || [];
    db.favorites = db.favorites || [];
    // Older versions shipped built-in demo accounts. They no longer
    // exist: remove them (and anything attached to them) from data
    // that is already saved in this browser.
    const demoIds = db.users.filter((u) => u.isDemo).map((u) => u.id);
    if (demoIds.length) {
      const gone = (id) => demoIds.indexOf(id) !== -1;
      db.users = db.users.filter((u) => !gone(u.id));
      db.agentProfiles = db.agentProfiles.filter((a) => !gone(a.userId));
      db.listings = db.listings.filter((l) => !gone(l.agentId));
      db.requests = db.requests.filter((r) => !gone(r.agentId) && !gone(r.customerId));
      db.tasks = db.tasks.filter((t) => !gone(t.agentId) && !gone(t.customerId));
      db.reports = db.reports.filter((r) => !gone(r.agentId) && !gone(r.reporterId));
      db.favorites = db.favorites.filter((f) => !gone(f.customerId));
      db.comments = (db.comments || []).filter((c) => !gone(c.agentId) && !gone(c.customerId));
      db.supportMessages = (db.supportMessages || []).filter((m) => !gone(m.customerId));
      try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* ignore */ }
    }
    db.comments = db.comments || [];
    db.supportMessages = db.supportMessages || [];
    db.settings = db.settings || {};
    if (!db.settings.telebirrNumber) db.settings.telebirrNumber = "0985074331";
    if (!db.settings.cbeAccount) db.settings.cbeAccount = "1000234567098";
    if (!db.settings.verificationFee) db.settings.verificationFee = 500;
    if (!db.settings.siteName) db.settings.siteName = "E-Delala";
    if (!db.settings.contactEmail) db.settings.contactEmail = "support@edelala.demo";
    return db;
  }

  function load() {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try { return migrate(JSON.parse(raw)); } catch (e) { /* fallthrough to reseed */ }
    }
    const seed = buildSeed();
    try { localStorage.setItem(KEY, JSON.stringify(seed)); } catch (e) { /* storage unavailable — still return in-memory seed */ }
    return seed;
  }

  // Storing photos as base64 can be large; if the browser's storage
  // quota is hit, surface a clear, catchable error instead of failing
  // silently (which is what made posting non-house listings look
  // "broken" — the write threw and nothing downstream ever ran).
  function save(db) {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch (e) {
      const err = new Error("STORAGE_FULL");
      err.cause = e;
      throw err;
    }
  }

  function reset() {
    localStorage.removeItem(KEY);
    return load();
  }

  /* ============================================
     SESSION
     ============================================ */
  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
  }
  function setSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id, role: user.role, fullName: user.fullName }));
  }
  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  /* ============================================
     PUBLIC API
     ============================================ */
  const DB = {
    CITIES, uid, nowISO, placeholderImg,
    all() { return load(); },
    reset,

    // --- auth ---
    normalizeEmail(email) { return String(email == null ? "" : email).trim().toLowerCase(); },
    isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || "").trim()); },
    isValidPhone(phone) {
      const p = String(phone || "").trim();
      return /^[+\d][\d\s\-()]{6,17}$/.test(p) && p.replace(/\D/g, "").length >= 7;
    },
    findUserByEmail(email) {
      const e = this.normalizeEmail(email);
      return load().users.find((u) => String(u.email).toLowerCase() === e);
    },
    hasAdmin() { return load().users.some((u) => u.role === "ADMIN"); },

    // Sign up. Creates the account only — it does NOT log the person in.
    // They must then log in with the same email + password.
    // Returns { ok:true, user } or { ok:false, code, error }.
    register(role, data) {
      data = data || {};
      const fullName = String(data.fullName || "").trim();
      const email = this.normalizeEmail(data.email);
      const phone = String(data.phone || "").trim();
      const password = String(data.password == null ? "" : data.password);
      const fail = (code, error) => ({ ok: false, code, error });

      if (role !== "CUSTOMER" && role !== "AGENT" && role !== "ADMIN") return fail("GENERIC", "Unknown account type.");
      if (fullName.length < 2) return fail("INVALID_NAME", "Please enter your full name.");
      if (!this.isValidEmail(email)) return fail("INVALID_EMAIL", "Please enter a valid email address.");
      if (role !== "ADMIN" || phone) {
        if (!this.isValidPhone(phone)) return fail("INVALID_PHONE", "Please enter a valid phone number.");
      }
      if (password.length < 6) return fail("WEAK_PASSWORD", "Password must be at least 6 characters.");

      const db = load();
      if (role === "ADMIN" && db.users.some((u) => u.role === "ADMIN")) return fail("ADMIN_EXISTS", "An admin account already exists.");
      if (db.users.some((u) => String(u.email).toLowerCase() === email)) return fail("EMAIL_EXISTS", "An account with this email already exists.");

      const id = uid("u");
      const user = { id, role, fullName, email, phone, password, isDemo: false, avatar: null, language: (window.I18N ? I18N.getLang() : "en"), createdAt: nowISO() };
      db.users.push(user);
      if (role === "AGENT") {
        db.agentProfiles.push({
          userId: id, businessName: fullName + "'s Agency", description: "", city: CITIES[0],
          phone: phone, facebook: "", telegram: "", instagram: "", photo: placeholderImg(fullName, 200, 200, "5B2A86"),
          verification: { status: "NONE", idType: "national", idPhoto: null, submittedAt: null, rejectedReason: "" },
          trustRating: 0, recommendation: "", status: "ACTIVE", spam: false, createdAt: nowISO()
        });
      }
      try { save(db); } catch (e) { return fail("STORAGE", "Could not save your account. Please allow browser storage and try again."); }
      return { ok: true, user };
    },

    // Log in with email + password. Pass expectedRole ("CUSTOMER" | "AGENT" | "ADMIN")
    // from the portal's login page so an account can only enter its own portal.
    // The session is only created when every check passes.
    // Returns { ok:true, user } or { ok:false, code, error }.
    login(email, password, expectedRole) {
      const fail = (code, error) => ({ ok: false, code, error });
      const e = this.normalizeEmail(email);
      if (!e || !this.isValidEmail(e)) return fail("INVALID_EMAIL", "Please enter a valid email address.");
      if (!password) return fail("WRONG_PASSWORD", "Incorrect password. Please try again.");
      const u = this.findUserByEmail(e);
      if (!u) return fail("NO_ACCOUNT", "No account found with this email. Please sign up first.");
      if (u.password !== password) return fail("WRONG_PASSWORD", "Incorrect password. Please try again.");
      if (expectedRole && u.role !== expectedRole) return fail("WRONG_ROLE_" + u.role, "This email belongs to a different type of account.");
      try { setSession(u); } catch (err) { return fail("STORAGE", "Could not start your session. Please allow browser storage and try again."); }
      return { ok: true, user: u };
    },
    logout() { clearSession(); },
    currentUser() {
      const s = getSession();
      if (!s) return null;
      return load().users.find((u) => u.id === s.id) || null;
    },
    requireRole(role) {
      const u = this.currentUser();
      if (!u || u.role !== role) {
        window.location.href = "/E-Delala-not-linked"; // replaced per-page, see guard()
        return null;
      }
      return u;
    },

    // --- agent profiles ---
    getAgentProfile(userId) { return load().agentProfiles.find((a) => a.userId === userId); },
    updateAgentProfile(userId, patch) {
      const db = load();
      const p = db.agentProfiles.find((a) => a.userId === userId);
      if (!p) return null;
      Object.assign(p, patch);
      save(db);
      return p;
    },
    listAgents({ query, city, verifiedOnly, minRating } = {}) {
      const db = load();
      return db.agentProfiles
        .filter((a) => a.status === "ACTIVE" && !a.spam)
        .map((a) => ({ ...a, user: db.users.find((u) => u.id === a.userId) }))
        .filter((a) => {
          if (query) {
            const q = query.toLowerCase();
            if (!a.businessName.toLowerCase().includes(q) && !a.user.fullName.toLowerCase().includes(q)) return false;
          }
          if (city && a.city !== city) return false;
          if (verifiedOnly && a.verification.status !== "APPROVED") return false;
          if (minRating && a.trustRating < minRating) return false;
          return true;
        });
    },
    agentStats(agentId) {
      const db = load();
      const listings = db.listings.filter((l) => l.agentId === agentId);
      const requests = db.requests.filter((r) => r.agentId === agentId);
      const tasks = db.tasks.filter((t) => t.agentId === agentId);
      return {
        totalListings: listings.length,
        activeListings: listings.filter((l) => l.status === "ACTIVE").length,
        newRequests: requests.filter((r) => r.status === "NEW").length,
        pendingTasks: tasks.filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED").length,
        completed: requests.filter((r) => r.status === "COMPLETED").length
      };
    },

    // --- listings ---
    listListings(filters = {}) {
      const db = load();
      let items = db.listings.filter((l) => l.status === "ACTIVE").map((l) => this.hydrateListing(l, db));
      const { query, category, city, purpose, minPrice, maxPrice, verifiedOnly, minRating, sort } = filters;
      if (query) {
        const q = query.toLowerCase();
        items = items.filter((l) => l.title.toLowerCase().includes(q) || l.description.toLowerCase().includes(q));
      }
      if (category) items = items.filter((l) => l.category === category);
      if (city) items = items.filter((l) => l.city === city);
      if (purpose) items = items.filter((l) => l.purpose === purpose);
      if (minPrice) items = items.filter((l) => l.price >= Number(minPrice));
      if (maxPrice) items = items.filter((l) => l.price <= Number(maxPrice));
      if (verifiedOnly) items = items.filter((l) => l.agent && l.agent.verification.status === "APPROVED");
      if (minRating) items = items.filter((l) => l.agent && l.agent.trustRating >= Number(minRating));
      switch (sort) {
        case "priceLow": items.sort((a, b) => a.price - b.price); break;
        case "priceHigh": items.sort((a, b) => b.price - a.price); break;
        case "rating": items.sort((a, b) => (b.agent ? b.agent.trustRating : 0) - (a.agent ? a.agent.trustRating : 0)); break;
        default: items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
      return items;
    },
    hydrateListing(l, db) {
      db = db || load();
      const agent = db.agentProfiles.find((a) => a.userId === l.agentId);
      const agentUser = agent ? db.users.find((u) => u.id === agent.userId) : null;
      return { ...l, agent: agent ? { ...agent, user: agentUser } : null };
    },
    getListing(id) {
      const db = load();
      const l = db.listings.find((x) => x.id === id);
      return l ? this.hydrateListing(l, db) : null;
    },
    listingsByAgent(agentId) {
      const db = load();
      return db.listings.filter((l) => l.agentId === agentId).map((l) => this.hydrateListing(l, db)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    createListing(data) {
      const db = load();
      const listing = {
        id: uid("l"), status: "ACTIVE", createdAt: nowISO(),
        images: data.images || [],
        ...data
      };
      db.listings.unshift(listing);
      save(db);
      return listing;
    },
    updateListing(id, patch) {
      const db = load();
      const l = db.listings.find((x) => x.id === id);
      if (!l) return null;
      Object.assign(l, patch);
      save(db);
      return l;
    },
    deleteListing(id) {
      const db = load();
      const l = db.listings.find((x) => x.id === id);
      if (l) { l.status = "REMOVED"; save(db); }
      return l;
    },

    // --- favorites ---
    isFavorite(customerId, listingId) {
      return load().favorites.some((f) => f.customerId === customerId && f.listingId === listingId);
    },
    toggleFavorite(customerId, listingId) {
      const db = load();
      const idx = db.favorites.findIndex((f) => f.customerId === customerId && f.listingId === listingId);
      if (idx >= 0) { db.favorites.splice(idx, 1); save(db); return false; }
      db.favorites.push({ id: uid("f"), customerId, listingId, createdAt: nowISO() });
      save(db);
      return true;
    },
    listFavorites(customerId) {
      const db = load();
      return db.favorites.filter((f) => f.customerId === customerId).map((f) => this.getListing(f.listingId)).filter(Boolean);
    },

    // --- requests ---
    createRequest(data) {
      const db = load();
      const r = { id: uid("r"), status: "NEW", createdAt: nowISO(), ...data };
      db.requests.unshift(r);
      save(db);
      return r;
    },
    requestsByAgent(agentId) {
      const db = load();
      return db.requests.filter((r) => r.agentId === agentId).map((r) => ({ ...r, listing: db.listings.find((l) => l.id === r.listingId) })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    requestsByCustomer(customerId) {
      const db = load();
      return db.requests.filter((r) => r.customerId === customerId).map((r) => ({ ...r, listing: db.listings.find((l) => l.id === r.listingId) })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    updateRequestStatus(id, status) {
      const db = load();
      const r = db.requests.find((x) => x.id === id);
      if (r) { r.status = status; save(db); }
      return r;
    },
    allRequests() {
      const db = load();
      return db.requests.map((r) => ({ ...r, listing: db.listings.find((l) => l.id === r.listingId) })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    // --- tasks ---
    createTask(data) {
      const db = load();
      const t = { id: uid("t"), status: "NEW", createdAt: nowISO(), ...data };
      db.tasks.unshift(t);
      save(db);
      return t;
    },
    tasksByAgent(agentId) {
      const db = load();
      return db.tasks.filter((t) => t.agentId === agentId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    tasksByCustomer(customerId) {
      const db = load();
      return db.tasks.filter((t) => t.customerId === customerId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    // --- verification ---
    submitVerification(agentUserId, data) {
      const db = load();
      const p = db.agentProfiles.find((a) => a.userId === agentUserId);
      if (!p) return null;
      p.verification = {
        status: "PENDING", idType: data.idType, idPhoto: data.idPhoto,
        paymentScreenshot: data.paymentScreenshot, paymentAmount: data.paymentAmount,
        paymentMethod: data.paymentMethod, submittedAt: nowISO(), rejectedReason: ""
      };
      save(db);
      return p;
    },
    pendingVerifications() {
      const db = load();
      return db.agentProfiles.filter((a) => a.verification.status === "PENDING").map((a) => ({ ...a, user: db.users.find((u) => u.id === a.userId) }));
    },
    setVerificationStatus(agentUserId, status, reason) {
      const db = load();
      const p = db.agentProfiles.find((a) => a.userId === agentUserId);
      if (!p) return null;
      p.verification.status = status;
      p.verification.rejectedReason = reason || "";
      save(db);
      return p;
    },

    // --- reports ---
    createReport(data) {
      const db = load();
      const r = { id: uid("rep"), status: "OPEN", createdAt: nowISO(), ...data };
      db.reports.unshift(r);
      save(db);
      return r;
    },
    allReports() {
      const db = load();
      return db.reports.map((r) => ({
        ...r,
        reporter: db.users.find((u) => u.id === r.reporterId),
        listing: db.listings.find((l) => l.id === r.listingId),
        agent: db.agentProfiles.find((a) => a.userId === r.agentId)
      })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    updateReportStatus(id, status) {
      const db = load();
      const r = db.reports.find((x) => x.id === id);
      if (r) { r.status = status; save(db); }
      return r;
    },

    // --- comments & ratings (customer reviews on a Delala's listing) ---
    addComment(data) {
      const db = load();
      const c = { id: uid("cm"), createdAt: nowISO(), ...data };
      db.comments.unshift(c);
      save(db);
      return c;
    },
    commentsForListing(listingId) {
      const db = load();
      return db.comments.filter((c) => c.listingId === listingId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    commentsForAgent(agentId) {
      const db = load();
      return db.comments.filter((c) => c.agentId === agentId).map((c) => ({ ...c, listing: db.listings.find((l) => l.id === c.listingId) })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    listingRatingSummary(listingId) {
      const db = load();
      const items = db.comments.filter((c) => c.listingId === listingId);
      if (!items.length) return { count: 0, average: 0 };
      const sum = items.reduce((acc, c) => acc + Number(c.rating || 0), 0);
      return { count: items.length, average: sum / items.length };
    },

    // --- support messages (customer → admin, general contact) ---
    createSupportMessage(data) {
      const db = load();
      const m = { id: uid("sup"), status: "OPEN", createdAt: nowISO(), ...data };
      db.supportMessages.unshift(m);
      save(db);
      return m;
    },
    allSupportMessages() {
      const db = load();
      return db.supportMessages.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    supportMessagesByCustomer(customerId) {
      const db = load();
      return db.supportMessages.filter((m) => m.customerId === customerId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    updateSupportMessageStatus(id, status) {
      const db = load();
      const m = db.supportMessages.find((x) => x.id === id);
      if (m) { m.status = status; save(db); }
      return m;
    },

    // --- admin ---
    dashboardStats() {
      const db = load();
      return {
        totalCustomers: db.users.filter((u) => u.role === "CUSTOMER").length,
        totalDelalas: db.agentProfiles.length,
        verifiedDelalas: db.agentProfiles.filter((a) => a.verification.status === "APPROVED").length,
        pendingVerification: db.agentProfiles.filter((a) => a.verification.status === "PENDING").length,
        totalListings: db.listings.length,
        activeListings: db.listings.filter((l) => l.status === "ACTIVE").length,
        reports: db.reports.filter((r) => r.status === "OPEN").length,
        requests: db.requests.length,
        openSupportMessages: db.supportMessages.filter((m) => m.status === "OPEN").length
      };
    },
    suspendAgent(userId) { return this.updateAgentProfile(userId, { status: "SUSPENDED" }); },
    reinstateAgent(userId) { return this.updateAgentProfile(userId, { status: "ACTIVE" }); },
    markAgentSpam(userId) { return this.updateAgentProfile(userId, { spam: true, status: "SUSPENDED" }); },
    deleteAgent(userId) {
      const db = load();
      db.users = db.users.filter((u) => u.id !== userId);
      db.agentProfiles = db.agentProfiles.filter((a) => a.userId !== userId);
      db.listings.forEach((l) => { if (l.agentId === userId) l.status = "REMOVED"; });
      save(db);
    },
    setTrust(userId, rating, recommendation) { return this.updateAgentProfile(userId, { trustRating: Number(rating), recommendation }); },
    allCustomers() { return load().users.filter((u) => u.role === "CUSTOMER"); },
    saveSettings(patch) {
      const db = load();
      db.settings = Object.assign(db.settings || {}, patch);
      save(db);
      return db.settings;
    },
    getSettings() { return load().settings || {}; }
  };

  window.DB = DB;
})();
