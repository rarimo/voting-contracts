// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import {PoseidonIMT} from "./utils/PoseidonIMT.sol";
import {Groth16Verifier} from "./Verifier.sol";
import {IVerifier} from "./IVerifier.sol";

contract Voting is PoseidonIMT {

    mapping(uint256 => uint256) public votesPerCandidate;
    
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
        uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[3] calldata _pubSignals
    ) external {
        bytes32 _root = bytes32(_pubSignals[0]);
        bytes32 _nullifier = bytes32(_pubSignals[1]);
        uint256 _vote = _pubSignals[2];
        
        require(!nullifies[_nullifier], "Double voting: nullifier already exists");
        require(rootsHistory[_root], "Root does not exist");

        bool isOk = IVerifier(verifier).verifyProof(_pA, _pB, _pC, _pubSignals);

        require(isOk == true, "Proof verification failed");

        votesPerCandidate[_vote]++;
    }

    // Unsafe, for testing purposes only
    function addRoot(bytes32 _root) public {
        rootsHistory[_root] = true;
    }

}