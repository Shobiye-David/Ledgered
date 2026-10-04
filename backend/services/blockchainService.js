const { ethers } = require("ethers");
const abi = require("./CertificateRegistryAbi.json");
const { decryptPrivateKey } = require("../utils/walletCrypto");

let provider;

function getProvider() {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(process.env.AMOY_RPC_URL);
  }
  return provider;
}

/** Platform admin signer: onboards institutions, can arbitrate revocations. */
function getAdminSigner() {
  if (!process.env.PLATFORM_ADMIN_PRIVATE_KEY) {
    throw new Error("PLATFORM_ADMIN_PRIVATE_KEY is not configured");
  }
  return new ethers.Wallet(process.env.PLATFORM_ADMIN_PRIVATE_KEY, getProvider());
}

function getContract(signerOrProvider) {
  if (!process.env.CONTRACT_ADDRESS) {
    throw new Error("CONTRACT_ADDRESS is not configured");
  }
  return new ethers.Contract(process.env.CONTRACT_ADDRESS, abi, signerOrProvider);
}

/** Read-only contract instance, safe for the public verification endpoint. */
function getReadOnlyContract() {
  return getContract(getProvider());
}

/** Generates a new platform-custodied wallet for an institution at onboarding time. */
function generateInstitutionWallet() {
  const wallet = ethers.Wallet.createRandom();
  return { address: wallet.address, privateKey: wallet.privateKey };
}

/** Funds an institution wallet with native gas from the platform admin wallet. */
async function fundInstitutionWallet(walletAddress) {
  try {
    const amount = process.env.INSTITUTION_WALLET_TOPUP_AMOUNT || "0.05";
    const tx = await getAdminSigner().sendTransaction({
      to: walletAddress,
      value: ethers.parseEther(amount),
    });
    const receipt = await tx.wait();
    return receipt.hash;
  } catch (err) {
    console.warn("[fundInstitutionWallet] institution wallet top-up failed:", err.message);
    return null;
  }
}

/** Returns the current native-token balance for a wallet. */
async function getWalletBalance(walletAddress) {
  return getProvider().getBalance(walletAddress);
}

/** Ensures a wallet has at least the requested native-token balance. */
async function ensureInstitutionFunded(walletAddress, minimumThreshold) {
  try {
    const balance = await getWalletBalance(walletAddress);
    const threshold = ethers.parseEther(String(minimumThreshold));
    if (balance < threshold) {
      await fundInstitutionWallet(walletAddress);
    }
  } catch (err) {
    console.warn("[ensureInstitutionFunded] institution wallet funding check failed:", err.message);
  }
}

/** Ensures a wallet has at least the requested native-token balance, failing loudly if platform funds are insufficient. */
async function ensureWalletHasAtLeast(walletAddress, requiredAmountWei) {
  const required = BigInt(requiredAmountWei);
  const balance = await getWalletBalance(walletAddress);
  if (balance >= required) {
    return { funded: true, balance, topUpPerformed: false };
  }

  const shortfall = required - balance;
  const topUpAmount = shortfall + shortfall / 5n;
  const adminSigner = getAdminSigner();
  const adminBalance = await getWalletBalance(adminSigner.address);

  if (adminBalance < topUpAmount) {
    throw new Error(
      `Platform admin wallet has insufficient funds to cover this institution's gas needs. Required: ${ethers.formatEther(
        required
      )} POL, available to send: ${ethers.formatEther(adminBalance)} POL.`
    );
  }

  const tx = await adminSigner.sendTransaction({
    to: walletAddress,
    value: topUpAmount,
  });
  await tx.wait();

  const newBalance = await getWalletBalance(walletAddress);
  if (newBalance < required) {
    throw new Error(
      `Platform admin wallet has insufficient funds to cover this institution's gas needs. Required: ${ethers.formatEther(
        required
      )} POL, available to send: ${ethers.formatEther(adminBalance)} POL.`
    );
  }

  return { funded: true, balance: newBalance, topUpPerformed: true };
}

/** Registers an institution's wallet on-chain (platform admin transaction). */
async function registerInstitutionOnChain(walletAddress, name) {
  const contract = getContract(getAdminSigner());
  const tx = await contract.registerInstitution(walletAddress, name);
  const receipt = await tx.wait();
  return receipt.hash;
}

async function setInstitutionActiveOnChain(walletAddress, isActive) {
  const contract = getContract(getAdminSigner());
  const tx = await contract.setInstitutionActive(walletAddress, isActive);
  const receipt = await tx.wait();
  return receipt.hash;
}

/** Signs and sends the issuance transaction using the institution's own custodied key. */
async function issueCertificateOnChain({ encryptedPrivateKey, certificateId, certificateHash, metadataURI }) {
  const privateKey = decryptPrivateKey(encryptedPrivateKey);
  const institutionSigner = new ethers.Wallet(privateKey, getProvider());
  const contract = getContract(institutionSigner);

  const tx = await contract.issueCertificate(certificateId, certificateHash, metadataURI);
  const receipt = await tx.wait();
  return receipt.hash;
}

async function revokeCertificateOnChain({ encryptedPrivateKey, certificateId, reason }) {
  const privateKey = decryptPrivateKey(encryptedPrivateKey);
  const institutionSigner = new ethers.Wallet(privateKey, getProvider());
  const contract = getContract(institutionSigner);

  const tx = await contract.revokeCertificate(certificateId, reason);
  const receipt = await tx.wait();
  return receipt.hash;
}

const STATUS_LABELS = ["none", "active", "revoked"];

/** Public, permissionless read used by the verification page. */
async function verifyCertificateOnChain(certificateId, certificateHash) {
  const contract = getReadOnlyContract();
  const result = await contract.verifyCertificate(certificateId, certificateHash);

  return {
    exists: result.exists,
    hashMatches: result.hashMatches,
    status: STATUS_LABELS[Number(result.status)],
    issuerWallet: result.issuer,
    issuerName: result.issuerName,
    issuedAt: Number(result.issuedAt) ? new Date(Number(result.issuedAt) * 1000).toISOString() : null,
    revokedAt: Number(result.revokedAt) ? new Date(Number(result.revokedAt) * 1000).toISOString() : null,
    metadataURI: result.metadataURI,
  };
}

module.exports = {
  getProvider,
  getReadOnlyContract,
  generateInstitutionWallet,
  fundInstitutionWallet,
  getWalletBalance,
  ensureInstitutionFunded,
  ensureWalletHasAtLeast,
  registerInstitutionOnChain,
  setInstitutionActiveOnChain,
  issueCertificateOnChain,
  revokeCertificateOnChain,
  verifyCertificateOnChain,
};
