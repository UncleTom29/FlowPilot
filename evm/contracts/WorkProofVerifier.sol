// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title WorkProofVerifier
/// @notice Verifies employment work proofs via ECDSA signatures.
///         Cadence MilestoneHandler reads verified status via cross-VM bridge.
contract WorkProofVerifier {
    struct Proof {
        bytes32 workHash;
        address employer;
        address worker;
        uint256 timestamp;
        bool verified;
    }

    // milestoneId → Proof
    mapping(bytes32 => Proof) public proofs;

    event ProofSubmitted(
        bytes32 indexed milestoneId,
        address indexed employer,
        address indexed worker,
        bytes32 workHash,
        uint256 timestamp
    );
    event ProofVerified(
        bytes32 indexed milestoneId,
        address indexed worker,
        uint256 timestamp
    );

    /// @notice Submit a work proof for a milestone.
    ///         Called by the employer on completion of the worker's deliverable.
    /// @param milestoneId Unique identifier for the milestone
    /// @param workHash Hash of the work deliverable (IPFS CID, document hash, etc.)
    /// @param worker Address of the worker who completed the milestone
    function submitProof(
        bytes32 milestoneId,
        bytes32 workHash,
        address worker
    ) external {
        require(worker != address(0), "WorkProofVerifier: zero worker address");
        require(workHash != bytes32(0), "WorkProofVerifier: empty work hash");
        require(
            proofs[milestoneId].employer == address(0),
            "WorkProofVerifier: proof already exists"
        );

        proofs[milestoneId] = Proof({
            workHash: workHash,
            employer: msg.sender,
            worker: worker,
            timestamp: block.timestamp,
            verified: false
        });

        emit ProofSubmitted(milestoneId, msg.sender, worker, workHash, block.timestamp);
    }

    /// @notice Verify a work proof by checking the worker's ECDSA signature over workHash.
    ///         The worker signs: keccak256(abi.encodePacked(milestoneId, workHash))
    /// @param milestoneId The milestone to verify
    /// @param signature ECDSA signature from the worker over the milestone + workHash
    function verifyProof(bytes32 milestoneId, bytes calldata signature) external {
        Proof storage proof = proofs[milestoneId];
        require(proof.employer != address(0), "WorkProofVerifier: proof not found");
        require(!proof.verified, "WorkProofVerifier: already verified");

        // Reconstruct the signed message
        bytes32 messageHash = keccak256(
            abi.encodePacked(milestoneId, proof.workHash)
        );
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );

        // Recover signer from signature
        address signer = recoverSigner(ethSignedHash, signature);

        require(signer == proof.worker, "WorkProofVerifier: invalid signature");

        proof.verified = true;
        emit ProofVerified(milestoneId, proof.worker, block.timestamp);
    }

    /// @notice Check if a milestone proof has been verified
    function isVerified(bytes32 milestoneId) external view returns (bool) {
        return proofs[milestoneId].verified;
    }

    /// @notice Get full proof details
    function getProof(bytes32 milestoneId)
        external
        view
        returns (
            bytes32 workHash,
            address employer,
            address worker,
            uint256 timestamp,
            bool verified
        )
    {
        Proof storage p = proofs[milestoneId];
        return (p.workHash, p.employer, p.worker, p.timestamp, p.verified);
    }

    /// @dev Recover signer address from an Ethereum signed message hash and signature
    function recoverSigner(bytes32 ethSignedHash, bytes calldata signature)
        internal
        pure
        returns (address)
    {
        require(signature.length == 65, "WorkProofVerifier: invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }

        if (v < 27) {
            v += 27;
        }

        require(v == 27 || v == 28, "WorkProofVerifier: invalid signature v value");

        return ecrecover(ethSignedHash, v, r, s);
    }
}
