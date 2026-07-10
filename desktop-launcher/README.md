# Ecommerce Calude — Desktop Launcher

Wraps your existing `backend/` (FastAPI) and `frontend/` (Next.js) folders
into one Windows app that auto-starts on login, sits in the system tray,
and opens a window pointed at your local app. PostgreSQL is NOT touched by
this — install and run it manually as you already planned; it just needs
to be up before the backend starts.

## 0. Where this goes

Copy this whole `desktop-launcher` folder into your repo root, so you have:

```
ecommerce_calude/
├── backend/
├── frontend/
└── desktop-launcher/   <- this folder
```

## 1. Try it in DEV mode first (no packaging yet)

This just proves the launcher can start both servers and show a window.

```powershell
cd ecommerce_calude/desktop-launcher
npm install
npm start
```

Requirements for dev mode to work:
- Python + your backend's dependencies already installed, `uvicorn` available,
  and your FastAPI app importable as `app.main:app` — if your entry point is
  different, edit the `spawn('python', ...)` line in `main.js`.
- `frontend/` already has a production build: `cd frontend && npm run build`
- PostgreSQL running locally with the DB your backend expects.

If a window opens showing your app, dev mode works.

## 2. Prep for a real Windows build

**Next.js — switch to standalone output** (much smaller, no need to ship
node_modules). In `frontend/next.config.js`:

```js
module.exports = {
  output: 'standalone',
  // ...your existing config
};
```

Then rebuild: `cd frontend && npm run build`. This produces
`frontend/.next/standalone/server.js` plus a `.next/standalone` folder
containing a minimal server — that's what gets shipped.

**FastAPI — package with PyInstaller**:

```powershell
cd backend
pip install pyinstaller
pyinstaller --onefile --name backend app/main.py
```

Adjust the entry script path to match your actual FastAPI entry point.
This produces `backend/dist/backend.exe`.

**Portable Node.js** — download the "Windows Binary (.zip)" from
nodejs.org, unzip it, you just need `node.exe` from inside it.

## 3. Assemble the resources folder

Before running `electron-builder`, populate `desktop-launcher/resources/`:

```
desktop-launcher/resources/
├── backend/
│   └── backend.exe          <- from PyInstaller dist/
├── frontend/
│   ├── server.js            <- from frontend/.next/standalone/
│   ├── .next/                <- static + server chunks from standalone build
│   └── public/               <- your public/ folder, copied in manually
└── node/
    └── node.exe              <- from the portable Node zip
```

(Note: Next.js standalone output doesn't auto-copy `public/` and
`.next/static/` — copy those in manually or add a small `postbuild` script.)

## 4. Add an icon

Put a `.ico` file at `desktop-launcher/build/icon.ico` (used for both the
window and the tray icon).

## 5. Build the installer

```powershell
cd desktop-launcher
npm run dist
```

This produces an NSIS installer in `desktop-launcher/dist/` — e.g.
`Ecommerce Calude Setup 1.0.0.exe`. Running that installer on any Windows
machine installs the app, creates shortcuts, and (thanks to
`setLoginItemSettings` in `main.js`) makes it auto-start on login.

## Notes

- The tray lets users close the window without fully quitting — it keeps
  running in the background so the app stays "always on" the way a real
  service would. Quitting is only via the tray menu → Quit.
- PostgreSQL must be running before backend.exe starts. If you installed it
  as a Windows service (default with the official installer), it's already
  running at boot, so this isn't usually an issue.
- If backend startup depends on env vars (DB connection strings, secrets),
  make sure `backend.exe` has access to them — either bake a `.env` file
  next to `backend.exe` in `resources/backend/`, or set them in `main.js`
  via the `env` option when spawning.
