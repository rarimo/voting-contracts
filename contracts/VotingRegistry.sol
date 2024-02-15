// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {Paginator} from "@solarity/solidity-lib/libs/arrays/Paginator.sol";

import {IVotingRegistry} from "./interfaces/IVotingRegistry.sol";

/**
 * @title VotingRegistry contract
 */
contract VotingRegistry is IVotingRegistry, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    using EnumerableSet for EnumerableSet.AddressSet;
    using Paginator for EnumerableSet.AddressSet;

    address public votingFactory;

    // votingType => votingPool
    mapping(string => EnumerableSet.AddressSet) private _votingPoolsByType;

    // proposer => votingPool
    mapping(address => EnumerableSet.AddressSet) private _votingPoolsByAddress;

    // votingType => votingImplementation
    mapping(string => address) private _votingImplementations;

    modifier onlyEqualLength(string[] memory names_, address[] memory newImplementations_) {
        _requireEqualLength(names_, newImplementations_);
        _;
    }

    modifier onlyFactory() {
        _requireOnlyFactory();
        _;
    }

    /**
     * @notice The function to initialize the VotingRegistry.
     * @param votingFactory_ The address of the VotingFactory contract.
     *
     * It binds the VotingFactory contract to the VotingRegistry.
     */
    function __VotingRegistry_init(address votingFactory_) external initializer {
        __Ownable_init();

        votingFactory = votingFactory_;
    }

    /**
     * @inheritdoc IVotingRegistry
     */
    function setNewImplementations(
        string[] memory names_,
        address[] memory newImplementations_
    ) external onlyOwner onlyEqualLength(names_, newImplementations_) {
        for (uint256 i = 0; i < names_.length; i++) {
            require(
                Address.isContract(newImplementations_[i]),
                "VotingRegistry: the implementation address is not a contract"
            );

            _votingImplementations[names_[i]] = newImplementations_[i];
        }
    }

    /**
     * @inheritdoc IVotingRegistry
     */
    function addProxyPool(
        string memory name_,
        address proposer_,
        address voting_
    ) external onlyFactory {
        _votingPoolsByType[name_].add(voting_);
        _votingPoolsByAddress[proposer_].add(voting_);
    }

    /**
     * @inheritdoc IVotingRegistry
     */
    function getVotingImplementation(string memory name_) external view returns (address) {
        return _votingImplementations[name_];
    }

    /**
     * @inheritdoc IVotingRegistry
     */
    function isVotingExistByType(
        string memory name_,
        address voting_
    ) external view returns (bool) {
        return _votingPoolsByType[name_].contains(voting_);
    }

    /**
     * @inheritdoc IVotingRegistry
     */
    function isVotingExistByProposer(
        address proposer_,
        address voting_
    ) external view returns (bool) {
        return _votingPoolsByAddress[proposer_].contains(voting_);
    }

    /**
     * @inheritdoc IVotingRegistry
     */
    function votingCountWithinPoolByType(
        string memory votingType_
    ) external view returns (uint256) {
        return _votingPoolsByType[votingType_].length();
    }

    /**
     * @inheritdoc IVotingRegistry
     */
    function votingCountWithinPoolByProposer(address proposer_) external view returns (uint256) {
        return _votingPoolsByAddress[proposer_].length();
    }

    /**
     * @inheritdoc IVotingRegistry
     */
    function listPoolsByType(
        string memory name_,
        uint256 offset_,
        uint256 limit_
    ) external view returns (address[] memory pools_) {
        return _votingPoolsByType[name_].part(offset_, limit_);
    }

    /**
     * @inheritdoc IVotingRegistry
     */
    function listPoolsByProposer(
        address proposer_,
        uint256 offset_,
        uint256 limit_
    ) external view returns (address[] memory pools_) {
        return _votingPoolsByAddress[proposer_].part(offset_, limit_);
    }

    function _requireEqualLength(
        string[] memory names_,
        address[] memory newImplementations_
    ) private pure {
        require(
            names_.length == newImplementations_.length,
            "VotingRegistry: names and implementations length mismatch"
        );
    }

    function _requireOnlyFactory() private view {
        require(
            msg.sender == votingFactory,
            "VotingRegistry: only factory can call this function"
        );
    }

    function _authorizeUpgrade(address) internal view override onlyOwner {}
}
