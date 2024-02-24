// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

/**
 * @title IVotingPool Interface
 * @dev Interface for the VotingPool contract.
 */
interface IVotingPool {
    /**
     * @notice Getter for the address of the Registration contract.
     * Must be inherited by the Voting contract that should be deployed through the VotingFactory.
     */
    function getRegistrationAddress() external view returns (address);
}
