const hre = require("hardhat");

async function main() {
  const CertificateRegistry = await hre.ethers.getContractFactory("CertificateRegistry");
  const registry = await CertificateRegistry.deploy();
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log("CertificateRegistry deployed to Polygon Amoy at:", address);
  console.log("Set this as CONTRACT_ADDRESS in backend/.env");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
