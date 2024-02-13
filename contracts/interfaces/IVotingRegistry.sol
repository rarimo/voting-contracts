// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

interface IVotingRegistry {
    /**
     * @notice The function that sets voting pools' implementations.
     * This function is also used to upgrade voting pools' implementations.
     *
     * Requirements:
     * - The caller must be the owner of the contract.
     * - The length of the names and newImplementations must be equal.
     *
     * @param names_ the names that are associated with the voting pools' implementations
     * @param newImplementations_ the new implementations of the voting pools
     */
    function setNewImplementations(
        string[] memory names_,
        address[] memory newImplementations_
    ) external;

    /**
     * @notice The function to add new voting pools into the registry
     * @param name_ the voting pool's associated name
     * @param voting_ the proxy address of the voting pool
     *
     * Requirements:
     * - The caller must be the VotingFactory contract.
     *
     * It is used only by the VotingFactory to add new voting pools into the registry.
     */
    function addProxyPool(string memory name_, address voting_) external;

    /**
     * @notice The function to get implementation of the specific voting type
     * @param name_ the name of the voting type
     * @return address_ the implementation that will be used to deploy future voting contracts
     */
    function getVotingImplementation(string memory name_) external view returns (address);

    /**
     * @notice The function to check if the address is exists in the provided voting pool.
     * @param name_ the associated voting pool
     * @param voting_ the address to check
     * @return true if voting_ is within the voting pool, false otherwise
     */
    function isVotingExist(string memory name_, address voting_) external view returns (bool);

    /**
     * @notice The function to count voting instances within the provided voting pool.
     * @param votingType_ the associated voting pool name
     * @return the number of voting pools with this name
     */
    function votingCountWithinPool(string memory votingType_) external view returns (uint256);

    /**
     * @notice The paginated function to list pools by their name (call `countPools()` to account for pagination)
     * @param name_ the associated pools name
     * @param offset_ the starting index in the pools array
     * @param limit_ the number of pools
     * @return pools_ the array of pools proxies
     */
    function listPools(
        string memory name_,
        uint256 offset_,
        uint256 limit_
    ) external view returns (address[] memory pools_);
}
