# Ledgered

Ledgered is a blockchain-based academic certificate platform. Institutions can issue and revoke certificates, students can view their certificates, and anyone can check whether a certificate is valid.

The app stores certificate records in MongoDB and anchors certificate hashes on the Polygon Amoy testnet. Verification compares the stored record with the hash recorded on-chain.

## Features

- Public certificate verification by certificate ID
- Institution staff dashboard for issuing and revoking certificates
- Student portal for viewing certificates
- Platform admin tools for managing institutions
- Optional Google sign-in and Cloudinary document storage

## Project structure

- `frontend/` — React and Vite web app
- `backend/` — Node.js and Express API
- `contracts/` — Solidity smart contract and Hardhat deployment scripts

## Technology

- React, Vite, and Tailwind CSS
- Node.js and Express
- MongoDB and Mongoose
- Solidity, Hardhat, and ethers.js
- Polygon Amoy testnet

## Requirements

- Node.js and npm
- MongoDB, either a local installation or a MongoDB Atlas database
- A Polygon Amoy RPC endpoint and a deployed `CertificateRegistry` contract for blockchain features

Google OAuth and Cloudinary are optional. Configure them only if you want to use Google sign-in or certificate document uploads.

## Run locally

Clone or download this repository, then configure the environment files. Do not commit real `.env` files or secrets.

### 1. Configure the backend

Copy `backend/.env.example` to `backend/.env` and fill in the values for your environment.

At minimum, configure:

- `MONGO_URI` — MongoDB connection string
- `JWT_SECRET` — a long, randomly generated secret
- `ADMIN_ACCESS_PATH` — a private path for platform admin access
- `ADMIN_SEED_PASSWORD` — a password to use if creating the demo admin account
- `WALLET_ENCRYPTION_KEY` — a randomly generated secret of at least 32 characters
- `AMOY_RPC_URL` — Polygon Amoy RPC endpoint
- `PLATFORM_ADMIN_PRIVATE_KEY` — private key for the platform wallet
- `CONTRACT_ADDRESS` — address of the deployed `CertificateRegistry` contract
- `CLIENT_ORIGIN` — frontend origin, usually `http://localhost:5173` for local development

Set `GOOGLE_CLIENT_ID` and the `CLOUDINARY_*` values only if using those services.

Then install dependencies and start the API:

```bash
cd backend
npm install
npm run dev
```

The backend runs locally on port `4000` by default.

### 2. Configure the frontend

Copy `frontend/.env.example` to `frontend/.env`. Set:

- `VITE_API_URL` — backend API URL, usually `http://localhost:4000/api`
- `VITE_ADMIN_ACCESS_PATH` — must match the backend's `ADMIN_ACCESS_PATH`
- `VITE_GOOGLE_CLIENT_ID` — the same Google OAuth client ID configured for the backend, if using Google sign-in

Install dependencies and start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

### 3. Optional: deploy the smart contract

If you need a new contract deployment, configure `contracts/.env` with an Amoy RPC URL and a dedicated test wallet private key. Then run:

```bash
cd contracts
npm install
npm run compile
npm run deploy:amoy
```

Use the resulting contract address as the backend's `CONTRACT_ADDRESS`. The deployment wallet needs test MATIC on Polygon Amoy. Never use a wallet containing valuable funds or publish its private key.

### 4. Optional: seed demo data

To create demo accounts and records, configure the backend settings required by the seed script, including `ADMIN_SEED_PASSWORD`, then run:

```bash
cd backend
node seed.js
```

## Deploy

The frontend and backend can be deployed as separate services from this repository. For example, on Render:

- Create a **Web Service** with root directory `backend`, build command `npm install`, and start command `npm start`.
- Create a **Static Site** with root directory `frontend`, build command `npm install && npm run build`, and publish directory `dist`.
- Use MongoDB Atlas or another hosted MongoDB database.
- Set environment variables in the hosting provider's dashboard. Do not put production secrets in the repository.
- Set backend `CLIENT_ORIGIN` to the deployed frontend URL.
- Set frontend `VITE_API_URL` to the deployed backend URL followed by `/api`.

For MongoDB Atlas, create a database user and configure network access so the deployed backend can connect.

## Security

- Never commit `.env` files, private keys, passwords, API secrets, or encryption keys.
- Use dedicated test wallets for testnet deployments.
- Generate unique secrets for each deployment.
- If a secret is accidentally published, consider it compromised and replace it.

## License

No license has been specified for this repository. Contact the repository owner before reusing or redistributing the code.
