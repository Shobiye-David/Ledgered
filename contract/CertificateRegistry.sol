// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CertificateRegistry
/// @notice On-chain anchor for academic certificate hashes issued by verified
///         institutions. The contract stores only a hash + status per
///         certificate; all human-readable metadata (student name, course,
///         grades, PDF, etc.) lives off-chain in MongoDB and is referenced by
///         the same certificateId. This keeps gas costs low and keeps
///         personally identifiable data off a public chain.
/// @dev Designed to be institution-agnostic: any wallet can be onboarded as
///      an issuing institution by the platform owner (admin). No institution
///      identity is hard-coded.
contract CertificateRegistry {
    address public owner;

    enum CertificateStatus {
        NonExistent,
        Active,
        Revoked
    }

    struct Institution {
        bool isRegistered;
        bool isActive;
        string name;      // display name, set by admin at onboarding
        uint64 registeredAt;
    }

    struct Certificate {
        bytes32 certificateHash;   // keccak256 hash of canonical certificate payload
        address issuer;            // institution wallet that issued it
        uint64 issuedAt;
        uint64 revokedAt;
        CertificateStatus status;
        string metadataURI;        // pointer to off-chain record (e.g. ipfs:// or api:// id)
    }

    // certificateId => Certificate (certificateId is keccak256 of institution + student ref + nonce, generated off-chain)
    mapping(bytes32 => Certificate) private certificates;

    // institution wallet address => Institution
    mapping(address => Institution) public institutions;

    address[] private institutionList;

    event InstitutionRegistered(address indexed institutionWallet, string name);
    event InstitutionStatusChanged(address indexed institutionWallet, bool isActive);
    event CertificateIssued(
        bytes32 indexed certificateId,
        address indexed issuer,
        bytes32 certificateHash,
        string metadataURI
    );
    event CertificateRevoked(bytes32 indexed certificateId, address indexed issuer, string reason);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "CertificateRegistry: caller is not the platform owner");
        _;
    }

    modifier onlyActiveInstitution() {
        require(institutions[msg.sender].isRegistered, "CertificateRegistry: not a registered institution");
        require(institutions[msg.sender].isActive, "CertificateRegistry: institution is suspended");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // ---------------------------------------------------------------------
    // Platform administration
    // ---------------------------------------------------------------------

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "CertificateRegistry: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Onboard a new institution onto the platform. Any accredited
    ///         institution can be added here -- nothing about this contract
    ///         favors a specific school or university.
    function registerInstitution(address institutionWallet, string calldata name) external onlyOwner {
        require(institutionWallet != address(0), "CertificateRegistry: zero address");
        require(!institutions[institutionWallet].isRegistered, "CertificateRegistry: already registered");

        institutions[institutionWallet] = Institution({
            isRegistered: true,
            isActive: true,
            name: name,
            registeredAt: uint64(block.timestamp)
        });
        institutionList.push(institutionWallet);

        emit InstitutionRegistered(institutionWallet, name);
    }

    function setInstitutionActive(address institutionWallet, bool isActive) external onlyOwner {
        require(institutions[institutionWallet].isRegistered, "CertificateRegistry: unknown institution");
        institutions[institutionWallet].isActive = isActive;
        emit InstitutionStatusChanged(institutionWallet, isActive);
    }

    function getInstitutionCount() external view returns (uint256) {
        return institutionList.length;
    }

    function getInstitutionAt(uint256 index) external view returns (address) {
        return institutionList[index];
    }

    // ---------------------------------------------------------------------
    // Certificate lifecycle
    // ---------------------------------------------------------------------

    /// @notice Issue a certificate. certificateId and certificateHash are
    ///         computed off-chain by the backend from the canonical record
    ///         (student, institution, program, award date, credential body)
    ///         so the same input always reproduces the same hash for
    ///         verification.
    function issueCertificate(
        bytes32 certificateId,
        bytes32 certificateHash,
        string calldata metadataURI
    ) external onlyActiveInstitution {
        require(certificates[certificateId].status == CertificateStatus.NonExistent, "CertificateRegistry: certificate already exists");
        require(certificateHash != bytes32(0), "CertificateRegistry: empty hash");

        certificates[certificateId] = Certificate({
            certificateHash: certificateHash,
            issuer: msg.sender,
            issuedAt: uint64(block.timestamp),
            revokedAt: 0,
            status: CertificateStatus.Active,
            metadataURI: metadataURI
        });

        emit CertificateIssued(certificateId, msg.sender, certificateHash, metadataURI);
    }

    /// @notice Revoke a previously issued certificate. Only the issuing
    ///         institution (or the platform owner, for dispute resolution)
    ///         may revoke it.
    function revokeCertificate(bytes32 certificateId, string calldata reason) external {
        Certificate storage cert = certificates[certificateId];
        require(cert.status == CertificateStatus.Active, "CertificateRegistry: certificate not active");
        require(
            msg.sender == cert.issuer || msg.sender == owner,
            "CertificateRegistry: not authorized to revoke this certificate"
        );

        cert.status = CertificateStatus.Revoked;
        cert.revokedAt = uint64(block.timestamp);

        emit CertificateRevoked(certificateId, cert.issuer, reason);
    }

    /// @notice Public, permissionless read used by the verification page.
    ///         Given a certificateId and the recomputed hash of the record a
    ///         verifier has in hand, this confirms authenticity + status in
    ///         one call.
    function verifyCertificate(bytes32 certificateId, bytes32 hashToCheck)
        external
        view
        returns (
            bool exists,
            bool hashMatches,
            CertificateStatus status,
            address issuer,
            string memory issuerName,
            uint64 issuedAt,
            uint64 revokedAt,
            string memory metadataURI
        )
    {
        Certificate storage cert = certificates[certificateId];
        exists = cert.status != CertificateStatus.NonExistent;
        hashMatches = exists && cert.certificateHash == hashToCheck;
        status = cert.status;
        issuer = cert.issuer;
        issuerName = institutions[cert.issuer].name;
        issuedAt = cert.issuedAt;
        revokedAt = cert.revokedAt;
        metadataURI = cert.metadataURI;
    }

    function getCertificate(bytes32 certificateId) external view returns (Certificate memory) {
        return certificates[certificateId];
    }
}
