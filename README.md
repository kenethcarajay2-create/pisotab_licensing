# Piso Tabs License Portal — v0.1 (website foundation)

Private, self-hosted license administration for Piso Tabs.

**Stack:** React 19, Vite 6, Tailwind CSS 3, Node.js 22, Express 4, official MongoDB Node driver 6, MongoDB Atlas, Render Web Service.

## What is ready

- Owner login with scrypt password hashing, database-backed HTTP-only sessions, strict SameSite cookies, origin validation, server-side authorization, and rate limiting.
- Create trial/monthly/annual/lifetime licenses with random 24-character keys; *the full key is shown only once*, with keyed hashes retained in MongoDB.
- License list, search, status computation, explicit expiry, renew, revoke, owner dashboard, audit log.
- MongoDB unique indexes; MongoDB transaction for key issuance plus audit; idempotency request identifier prevents accidental duplicate issuance.
- One Render Web Service serves the compiled React site and `/api` endpoints from the same origin.
- Built-in tests for key generation, password verification, HMAC, and status handling.

**Not ready:** Android device activation, registered device authentication, signature-based offline entitlements, MFA, self-service password recovery, multiple users/roles, billing, or automatic license enforcement. **Do not sell these codes as working Android activations yet.** The device page clearly shows these features are pending. `maxDevices` is reserved metadata until the activation service is developed.

## 1. Requirements

- Node.js 22+ and npm
- MongoDB Atlas project and database credentials
- Private GitHub repository (for Render to deploy)

## 2. Atlas setup

1. Create an Atlas cluster (replica set / supported tier for multi-document transactions).
2. Create a **database user** with read/write permission for the `piso_tabs_licensing` database; do not use your Atlas account credentials. Limit database user's privileges to this database.
3. Configure Atlas Network Access. For production, prefer Render outbound IP ranges where your plan supplies stable egress; if broad network access is unavoidable, use a strong long random database user password, TLS, least-privileged database access, and review network rules. Never put a connection string in client JavaScript or Git.
4. Copy Atlas `mongodb+srv://...` URI into `MONGODB_URI`, URL-encoding special characters in the database user's password.

## 3. Local setup (Windows PowerShell)

```powershell
cd "path\to\piso-tabs-license-portal"
Copy-Item .env.example .env
# Edit .env and fill in MONGODB_URI, MONGODB_DB and two independent random peppers.
# Generate strong random peppers:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Keep them secret and NEVER rotate casually: changing them invalidates sessions / license verification.
npm install
npm test
```

Use Node's env-file flag to launch locally:

```powershell
$env:NODE_OPTIONS = '--env-file=.env'
# ONE-TIME BOOTSTRAP (only before any other admin exists)
# Set BOOTSTRAP_EMAIL and BOOTSTRAP_PASSWORD in .env, run bootstrap, then remove them from .env
npm run bootstrap
# Runs Vite + Express in parallel
npm run dev
```

For local development **`APP_ORIGIN` must be `http://localhost:5173`** because Vite serves the frontend from 5173. The Express backend listens on 10000 and Vite proxies `/api`. `http://127.0.0.1:5173` will NOT match the origin rule if `APP_ORIGIN` is localhost. Open http://localhost:5173 in your browser.

## 4. Deploy as ONE Render Web Service

1. Create a **private** GitHub repository, and push the project (never commit `.env`).
2. In Render, choose **New → Web Service**, connect your private repo, use Node runtime. You can optionally use `render.yaml` as a Blueprint.
3. Build command: `npm install --no-audit --no-fund && npm run build`
4. Start command: `npm start`
5. Add environment variables in **Render → Environment**:

   - `NODE_ENV=production`
   - `NODE_VERSION=22`
   - `MONGODB_URI=<your Atlas URI>`
   - `MONGODB_DB=piso_tabs_licensing`
   - `APP_ORIGIN=https://<your-service>.onrender.com` (no trailing slash; later use your custom domain if changed)
   - `SESSION_PEPPER=<32+ random characters>`
   - `LICENSE_PEPPER=<DIFFERENT 32+ random characters>`

6. Health check: `/healthz`; use HTTPS Render domain. Set environment variables **before starting**.
7. **Bootstrap the first owner from your own computer, not an unauthenticated public website route.** The `npm run bootstrap` command connects directly to Atlas using your local `.env`. Use the **same** Atlas database as Render. If a user already exists, bootstrap refuses to create another. Remove the bootstrap credentials after using them.
8. Open the Render URL, log in, create a test key, verify it shows once, then test search, renew and revoke.

If the `render.yaml` is used, Render may prompt for the missing `APP_ORIGIN` and Atlas URI. Set `APP_ORIGIN` to the exact final Render hostname, then redeploy.

**Important:** `render.yaml` uses a paid starter service by default; change the plan only after checking Render's current service options. Atlas network access and outbound IPs depend on your Render plan. Never deploy using your local `.env` file.

## 5. Database collections

- `admins`: owner email, scrypt hash, role, disabled state.
- `sessions`: hashed session tokens, account relation, expiry (TTL index).
- `licenses`: keyed-hashed license key, masked hint, subscription details, status, limits, creation request ID.
- `audit_logs`: issuance, renewal, revocation, owner login events.

## 6. Security and operational limitations

- Changing `SESSION_PEPPER` invalidates existing sessions. Changing `LICENSE_PEPPER` permanently prevents matching previously issued codes, so back up both secrets securely.
- A full key can **never be retrieved** from the database. In case of a lost key, revoke that record and issue a replacement. For a network interruption during issuance, the request ID prevents duplicate creation, but the one-time key might be lost; revoke and reissue.
- `POST /api/licenses` requires a client UUID requestId, and issuance plus audit recording use a MongoDB transaction. A retry with the same request ID returns a conflict rather than secretly generating a second key.
- Sessions are HTTP-only Secure SameSite=Strict cookies in production; all mutation requests require the expected Origin plus a non-simple custom header. Browser storage never holds authentication tokens.
- This starter allows only one bootstrapped administrator. Before real commercial release, add MFA, independent rate limiting across replicas (not only in-process), password recovery, alerting/monitoring, dedicated signing keys, device activation and regular security review.
- No Android activation route is exposed. A license code **does not** unlock Piso Tabs yet.
- Production licenses must use a separate dedicated signing private key held server-side; do not reuse license hash peppers for signing.
- Access control and rate limits must be tested behind Render's reverse proxy.
- Never expose `/api` directly from Android until device signature challenges and transactional activation limits are implemented.

## 7. Smoke tests

```powershell
npm test
npm run build
```

Then on a private deployment, test owner login, refresh persistence, key generation, one-time display, search, renew, revoke, and non-owner request denial. Deliberately submit the same create request ID twice and confirm no duplicate license is created. Check the audit log and MongoDB collections.
