// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {TypeCaster} from "@solarity/solidity-lib/libs/utils/TypeCaster.sol";
import {VerifierHelper} from "@solarity/solidity-lib/libs/zkp/snarkjs/VerifierHelper.sol";

import {IVerifier} from "./interfaces/IVerifier.sol";

import {PoseidonIMT} from "./utils/PoseidonIMT.sol";

contract Voting is PoseidonIMT, Ownable {
    using TypeCaster for *; // TypeCaster library for type conversions.
    using VerifierHelper for address; // VerifierHelper library for zk-SNARK proof verification.

    enum VotingStatus {
        NOT_STARTED,
        REGISTRATION,
        VOTING,
        ENDED
    }

    /// Address of the verifier contract for the registration proof (zk-SNARK)
    address public registerVerifier;

    /// Address of the verifier contract for the anonymous inclusion proof (zk-SNARK)
    address public voteVerifier;

    mapping(uint256 => uint256) public votesPerCandidate;

    /// Commitments to ensure that no registration with the same identifier occurs
    mapping(bytes32 => bool) public commitments;

    /// Nullifiers to prevent double voting
    mapping(bytes32 => bool) public nullifies;

    /// Roots for zk proof anchoring to some existed MT root
    mapping(bytes32 => bool) public rootsHistory;

    event UserRegistered(bytes32 commitment, uint256 blockNumber);
    event UserVoted(bytes32 root, bytes32 nullifierHash, uint256 voteId, uint256 blockNumber);

    constructor(
        address voteVerifier_,
        address registerVerifier_,
        uint256 treeHeight_
    ) PoseidonIMT(treeHeight_) Ownable(msg.sender) {
        voteVerifier = voteVerifier_;
        registerVerifier = registerVerifier_;
    }

    function registerForVoting(
        bytes32 commitment_,
        VerifierHelper.ProofPoints calldata proof_
    ) external {
        require(!commitments[commitment_], "Voting: commitment already exists");

        require(
            registerVerifier.verifyProofSafe([uint256(commitment_)].asDynamic(), proof_, 1),
            "Voting: Invalid vote proof"
        );

        _add(commitment_);
        commitments[commitment_] = true;
        rootsHistory[getRoot()] = true;

        emit UserRegistered(commitment_, block.number);
    }

    function vote(
        bytes32 root_,
        bytes32 nullifierHash_,
        uint256 voteId_,
        VerifierHelper.ProofPoints calldata proof_
    ) external {
        require(!nullifies[nullifierHash_], "Voting: nullifier already used");
        require(rootsHistory[root_], "Vote: root doesn't exist");

        require(
            voteVerifier.verifyProofSafe(
                [uint256(root_), uint256(nullifierHash_), voteId_].asDynamic(),
                proof_,
                3
            ),
            "Voting: Invalid vote proof"
        );

        nullifies[nullifierHash_] = true;

        votesPerCandidate[voteId_]++;

        emit UserVoted(root_, nullifierHash_, voteId_, block.number);
    }

    function addRoot(bytes32 root_) external onlyOwner {
        rootsHistory[root_] = true;
    }
}
