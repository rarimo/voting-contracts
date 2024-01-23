// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {TypeCaster} from "@solarity/solidity-lib/libs/utils/TypeCaster.sol";

import {VerifierHelper} from "@solarity/solidity-lib/libs/zkp/snarkjs/VerifierHelper.sol";

import {PoseidonIMT} from "./utils/PoseidonIMT.sol";

contract Registration {
    
    enum VotingStatus {
        NOT_STARTED,
        REGISTRATION,
        VOTING,
        ENDED
    }

    /// Address of the verifier contract for the anonymous inclusion proof (zk-SNARK)
    address public verifier;

    // Commitments to ensure that no registration with the same identifier occurs
    mapping(bytes32 => bool) public commitments;

    /// Nullifiers to prevent double voting
    mapping(bytes32 => bool) public nullifies;

    /// Roots for zk proof anchoring to some existed MT root
    mapping(bytes32 => bool) public rootsHistory;

    event VotingRegistration(uint256 indexed identifierPosition, bytes32 identifier, uint256 blockNumber);

    constructor(uint256 treeHeight_, address verifier_) PoseidonIMT(treeHeight_){
        verifier = verifier_;
    }

    function vote(
        bytes32 nullifierHash_,
        bytes32 root_,
        VerifierHelper.ProofPoints calldata proof_,
        VotingOption votingOption_
    ) {

    }
}