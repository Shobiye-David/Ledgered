# Ledgered — Blockchain-Based Academic Certificate Verification Platform

Ledgered is an institution-agnostic platform for issuing, holding, and verifying
academic certificates. Certificate hashes and transaction references are
anchored on the Polygon Amoy testnet; full certificate metadata lives off-chain
in MongoDB. Any accredited institution can be onboarded — nothing in the
product is designed around, or branded for, a single school or university.

## Architecture

```
contracts/   Solidity smart contract (CertificateRegistry) + Hardhat deployment
backend/     Node.js/Express API, MongoDB models, ethers.js blockchain service
frontend/    React + Tailwind SPA: landing/verify (public), institution
             dashboard, student portal, platform-admin console
```

### Why this split

- **On-chain**: only a `certificateId`, a `certificateHash` (keccak256 of the
  canonical record), issuer, timestamps, and status (`Active` / `Revoked`).
  No personally identifiable data ever touches the chain.
- **Off-chain (MongoDB)**: the full human-readable record — student name,
  program, award date, classification, document links — keyed by the same
  `certificateId`.
- **Verification** independently recomputes the hash and reads the contract
  directly (`GET /api/verify/:certificateId`), so a verifier is never asked to
  trust Ledgered's database alone — only the chain.

### Roles

| Role | Access |
|---|---|
| `platform_admin` | Onboards institutions, suspends/reactivates them |
| `institution_staff` | Issues and revokes certificates for their own institution |
| `student` | Views certificates issued to them |
| Public (no account) | Looks up any certificate by ID on `/verify` |

## Getting started

### 1. Smart contract

```bash
cd contracts
npm install
cp ../backend/.env.example .env   # fill in AMOY_RPC_URL, DEPLOYER_PRIVATE_KEY
npm run compile
npm run deploy:amoy
```

Copy the deployed address into `backend/.env` as `CONTRACT_ADDRESS`. You'll
need Amoy testnet MATIC in the deployer wallet (available from public Amoy
faucets).

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# fill in MONGO_URI, JWT_SECRET, AMOY_RPC_URL, PLATFORM_ADMIN_PRIVATE_KEY,
# CONTRACT_ADDRESS, and a WALLET_ENCRYPTION_KEY (32+ random characters)
npm run dev
```

Optionally seed a demo dataset (a platform admin, one sample institution
"Riverside University", one staff account, one student account):

```bash
node seed.js
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173`. The public verification page works without
signing in; institution/student/admin dashboards require the accounts above.

## Design system

The frontend intentionally avoids default "AI app" visual tropes (neon
gradients on dark backgrounds, nested bordered cards, Inter/system-ui type).
Tokens live in `frontend/tailwind.config.js`:

- **Color** — a 60/30/10 balance: warm paper base, deep pine for structural
  surfaces, burnt amber reserved for primary actions and the verification
  "seal" moment. Status colors are desaturated rather than traffic-light
  bright.
- **Type** — Fraunces (display) + Source Sans 3 (body/UI), loaded via Google
  Fonts in `index.html`.
- **Layout** — regions are separated by background tint shifts, not nested
  card borders. The public verify page's result state is the one deliberately
  bold visual moment in the product.

## Extending to a new institution

No code changes are required. A platform admin submits the onboarding form
(`/admin/onboard`), which:

1. Generates a platform-custodied wallet for the institution (or an
   institution can supply its own wallet address instead)
2. Registers that wallet on-chain via `CertificateRegistry.registerInstitution`
3. Creates the institution's first staff account

The new institution then issues certificates from its own dashboard,
independent of any other institution on the platform.

Password for all seeded account is ChangeMe123!
