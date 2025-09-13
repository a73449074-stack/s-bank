# Deploying to GitHub + Vercel

This project is a static frontend (HTML/CSS/JS) plus a Node/Express + MongoDB backend. To run cross-device (admin approvals), deploy both and point the frontend to the backend.

## 1) Push the frontend to GitHub
1. Create a new GitHub repo.
2. From this folder, initialize and push:

```powershell
git init
git add .
git commit -m "Initial deploy"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

## 2) Deploy the frontend on Vercel
1. Import the GitHub repo in Vercel (New Project).
2. Framework Preset: "Other" (static). Build command: none. Output directory: root.
3. Ensure `config.js` is committed. It defaults to an empty base in production (so code calls `/api/...`) and `http://localhost:4000` locally.
4. Update `vercel.json` rewrite to your backend domain:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "https://YOUR-BACKEND-DOMAIN/api/$1" }
  ]
}
```

Alternatively, use a Vercel Environment Variable `API_BASE_URL` and read it in `config.js` (not added here to keep it simple).

## 3) Deploy the backend
You have a Node/Express server in `server/`. Options:
- Vercel Serverless: extract API routes into `api/` functions (more work).
- Render / Railway / Fly.io / Heroku: easiest to host the entire Express server.

Quick steps (Render example):
- Create a new Web Service from your GitHub repo, root `server/` path.
- Set build/run:
  - Build Command: `npm install`
  - Start Command: `node index.js`
- Env vars:
  - `MONGO_URI` = your MongoDB connection string
  - `DB_NAME` = your db name
  - `PORT` = 4000
- After deploy, copy the public URL, e.g. `https://bank-backend.onrender.com`. Update `vercel.json` accordingly.

## 4) Test the integration
- Visit your Vercel frontend URL.
- The app will call relative `/api/...`. Vercel proxies to your backend per `vercel.json`.
- Sign in as admin on the admin page and approve/reject to confirm cross-device behavior.

## 5) Optional: override at runtime
- Locally or for staging, you can override the API base without redeploying: open devtools and run:

```js
localStorage.setItem('apiBaseUrl', 'https://staging-backend.example.com'); location.reload();
```

Remove it to go back to defaults:

```js
localStorage.removeItem('apiBaseUrl'); location.reload();
```

## Notes
- CORS: If you are not using rewrites, enable CORS on the backend for your Vercel domain.
- TLS: Use HTTPS for the backend.
- Health: Test `GET /api/health` on the backend.
