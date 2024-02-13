// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {IRegisterVerifier} from "../interfaces/verifiers/IRegisterVerifier.sol";

import {Voting} from "../Voting.sol";

contract VotingMock is Voting {
    constructor(
        address voteVerifier_,
        address registerVerifier_,
        uint256 treeHeight_
    ) Voting(voteVerifier_, registerVerifier_, treeHeight_) {}

    function registerForVotingMock(
        IRegisterVerifier.RegisterProofParams memory registerProofParams_
    ) external {
        require(
            getProposalStatus() == VotingStatus.COMMITMENT,
            "Voting: the voting must be in the commitment state to register"
        );

        bytes32 commitment_ = registerProofParams_.commitment;

        require(!commitments[commitment_], "Voting: commitment already exists");

        _add(commitment_);
        commitments[commitment_] = true;
        rootsHistory[getRoot()] = true;
    }
}
