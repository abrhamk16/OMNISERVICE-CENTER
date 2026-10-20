# E-Delala (ኢ-ደላላ) — Frontend

This is the **frontend** for E-Delala: three role-based portals (Customer,
Delala/Agent, Admin) built with plain HTML5, CSS3, and vanilla JavaScript,
fully bilingual in **English** and **Amharic (አማርኛ)**.

## What's in this build

This scope covers the **front end only** — the three portals, all their
pages, the full English/Amharic translation system, and a working data
layer. There is no Node/Express/Prisma server yet.

To make every workflow in the spec actually *work* in the browser (posting
a listing, sending a request, approving a verification, favoriting a
listing, etc.) without a real backend, `js/store.js` implements a small
mock database backed by `localStorage`. It starts **completely empty** — there are no built-in
demo accounts, listings, requests, tasks, reports, or favorites. Every
account is created through the Sign up forms, and every listing customers
and admins see must be posted by a logged-in Delala through the Add Listing
wizard, exactly as the spec requires.

When the real Node.js + Express + Prisma/SQLite backend described in the
full spec is built, `js/store.js`'s functions are designed to be swapped
one-for-one for `fetch('/api/...')` calls — the rest of the frontend
(`app.js`, all the page scripts) calls `DB.xxx()` methods, not
`localStorage` directly, so the swap is isolated to one file.

## Running it locally

No build step, no npm install needed for the frontend itself — it's static
HTML/CSS/JS. Any static file server works. From this folder:

```bash
# Option 1: Node's http-server (if you have Node installed)
npx http-server public -p 3000

# Option 2: Python
cd public
python3 -m http.server 3000
```

Then open **http://localhost:3000** in your browser.

> Opening `index.html` directly via `file://` mostly works too, but some
> browsers restrict `localStorage` differently across `file://` origins —
> serving over `http://localhost` is recommended.

## What's new in this update

- **New logo** — a violet gradient lowercase e that doubles as a house roof, with an agent silhouette inside and a location pin on the right. Used in the header and as the favicon; full logo files are in `public/img/` (`logo.svg`, `logo.png`, `logo-icon.svg`, `logo-icon-1024.png`).
- **Paid verification flow** — Delalas pay a fee (default 500 ETB) via Telebirr or CBE Bank, upload a payment screenshot + ID photo, and admin reviews both before approving. The bank details and fee are editable from Admin Settings.
- **Full names everywhere** — login greetings and the header now show full names; Delala accounts show their real profile photo instead of initials.
- **In-app Back button** — every page (except the homepage) has a visible Back control, and pages force-refresh if restored from the browser's back/forward cache, so the UI never shows a stale logged-out state.
- **Fixed posting for Vehicle/Machinery/Service listings** — photos are now automatically compressed before saving (this is what was silently hitting the browser's storage limit), and errors now show a clear message instead of failing silently. House, Vehicle, Machinery listings require **at least 3 photos**; Service/Maid listings require **at least 1 photo** (no name required — the photo is the identifier).
- **Contact Admin** — customers can message admin about any problem from Customer → Contact Admin; admin sees them under Admin → Support Messages.
- **Reviews & ratings** — customers can leave a star rating + comment on any listing; Delalas can see all comments on their listings from My Listings → 💬.

## Accounts: sign up first, then log in

There are no demo accounts. Each portal works the same way:

1. **Sign up** with your full name, **email**, phone and a password (6+ characters).
   - Customers: `customer/register.html`
   - Delalas: `agent/register.html`
2. You are sent to that portal's **Log in** page with your email filled in.
3. **Log in with the same email + password.** An account can only enter its own
   portal (a Delala email is rejected on the Customer login, and vice versa).

**Admin:** the first time you open `admin/login.html` (no admin exists yet) it shows a
one-time **Set up the admin account** form. Create the admin there, then log in with it.
After that the setup form is closed and only the login form is shown.

Accounts live in this browser's `localStorage`, which is separate for each address:
`http://localhost:3000` and `http://127.0.0.1:3000` are **different** as far as
storage is concerned. Sign up and log in on the same address. Accounts left over from
older builds (the old `*@edelala.demo` ones) are removed automatically on first load.

## Folder structure

```
public/
  index.html              customer home page
  customer/               customer portal pages
  agent/                  Delala/agent portal pages
  admin/                  admin portal pages
  css/
    tokens.css            design tokens (color, type, spacing)
    base.css              shared components (nav, cards, forms, tables…)
  js/
    i18n/en.js             English strings
    i18n/am.js             Amharic strings
    i18n.js                translation engine (data-i18n attributes)
    store.js                mock database (localStorage) + seed data
    app.js                  shared header/footer rendering, toasts, helpers
```

## Language switching

Every page has an **EN | አማ** toggle in the header. The chosen language is
saved and reapplied on every page load; the whole UI — nav, forms, buttons,
statuses, empty states — is translated, not just the homepage.

## Resetting the data

Open the browser console on any page and run:

```js
DB.reset();
```

This wipes the saved accounts and data and starts empty again.
