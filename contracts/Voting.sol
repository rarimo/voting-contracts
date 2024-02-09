// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {TypeCaster} from "@solarity/solidity-lib/libs/utils/TypeCaster.sol";
import {VerifierHelper} from "@solarity/solidity-lib/libs/zkp/snarkjs/VerifierHelper.sol";

import {IVerifier} from "./interfaces/IVerifier.sol";
import {IBaseVerifier} from "./interfaces/verifiers/IBaseVerifier.sol";
import {IRegisterVerifier} from "./interfaces/verifiers/IRegisterVerifier.sol";

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
    IRegisterVerifier public registerVerifier;

    /// Address of the verifier contract for the anonymous inclusion proof (zk-SNARK)
    address public voteVerifier;

    mapping(uint256 => uint256) public votesPerCandidate;

    /// Commitments to ensure that no registration with the same identifier occurs
    mapping(bytes32 => bool) public commitments;

    /// Nullifiers to prevent double voting
    mapping(bytes32 => bool) public nullifies;

    /// Roots for zk proof anchoring to some existed MT root
    mapping(bytes32 => bool) public rootsHistory;

    event UserRegistered(
        IBaseVerifier.ProveIdentityParams proveIdentityParams,
        IRegisterVerifier.RegisterProofParams registerProofParams,
        uint256 blockNumber
    );
    event UserVoted(bytes32 root, bytes32 nullifierHash, uint256 voteId, uint256 blockNumber);

    constructor(
        address voteVerifier_,
        address registerVerifier_,
        uint256 treeHeight_
    ) PoseidonIMT(treeHeight_) {
        voteVerifier = voteVerifier_;
        registerVerifier = IRegisterVerifier(registerVerifier_);
    }

    function registerForVoting(
        IBaseVerifier.ProveIdentityParams memory proveIdentityParams_,
        IRegisterVerifier.RegisterProofParams memory registerProofParams_,
        IBaseVerifier.TransitStateParams memory transitStateParams_,
        bool isTransitState_
    ) external {
        bytes32 commitment_ = registerProofParams_.commitment;

        require(!commitments[commitment_], "Voting: commitment already exists");

        IRegisterVerifier.RegisterProofInfo memory registerProofInfo_ = IRegisterVerifier
            .RegisterProofInfo({registerProofParams: registerProofParams_, votingId: 0});

        if (isTransitState_) {
            registerVerifier.transitStateAndProveRegistration(
                proveIdentityParams_,
                registerProofInfo_,
                transitStateParams_
            );
        } else {
            registerVerifier.proveRegistration(proveIdentityParams_, registerProofInfo_);
        }

        _add(commitment_);
        commitments[commitment_] = true;
        rootsHistory[getRoot()] = true;

        emit UserRegistered(proveIdentityParams_, registerProofParams_, block.number);
    }

    function vote(
        bytes32 root_,
        bytes32 nullifierHash_,
        uint256 voteId_,
        VerifierHelper.ProofPoints memory proof_
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
