// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IVerifier} from "./interfaces/IVerifier.sol";

import {PoseidonIMT} from "./utils/PoseidonIMT.sol";

contract Voting is PoseidonIMT, Ownable {
    enum VotingStatus {
        NOT_STARTED,
        REGISTRATION,
        VOTING,
        ENDED
    }

    /// Address of the verifier contract for the anonymous inclusion proof (zk-SNARK)
    address public verifier;

    mapping(uint256 => uint256) public votesPerCandidate;

    /// Commitments to ensure that no registration with the same identifier occurs
    mapping(bytes32 => bool) public commitments;

    /// Nullifiers to prevent double voting
    mapping(bytes32 => bool) public nullifies;

    /// Roots for zk proof anchoring to some existed MT root
    mapping(bytes32 => bool) public rootsHistory;

    event VotingRegistration(
        uint256 indexed identifierPosition,
        bytes32 identifier,
        uint256 blockNumber
    );

    constructor(
        address verifier_,
        uint256 treeHeight_
    ) PoseidonIMT(treeHeight_) Ownable(msg.sender) {
        verifier = verifier_;
    }

    function vote(
        uint[2] calldata pA_,
        uint[2][2] calldata pB_,
        uint[2] calldata pC_,
        uint[3] calldata pubSignals_
    ) external {
        bytes32 root_ = bytes32(pubSignals_[0]);
        bytes32 nullifier_ = bytes32(pubSignals_[1]);
        uint256 vote_ = pubSignals_[2];

        require(!nullifies[nullifier_], "Double voting: nullifier already exists");
        require(rootsHistory[root_], "Root does not exist");

        bool success_ = IVerifier(verifier).verifyProof(pA_, pB_, pC_, pubSignals_);

        require(success_, "Proof verification failed");

        nullifies[nullifier_] = true;

        votesPerCandidate[vote_]++;
    }

    function addRoot(bytes32 root_) external onlyOwner {
        rootsHistory[root_] = true;
    }
}
