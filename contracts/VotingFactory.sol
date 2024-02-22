// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {IVoting} from "./interfaces/IVoting.sol";
import {IVotingFactory} from "./interfaces/IVotingFactory.sol";

import {VotingRegistry} from "./VotingRegistry.sol";

/**
 * @title VotingFactory contract
 */
contract VotingFactory is IVotingFactory, Initializable, UUPSUpgradeable {
    VotingRegistry public votingRegistry;

    modifier onlyExistingVotingType(string memory votingType_) {
        _requireExistingVotingType(votingType_);
        _;
    }

    constructor() {
        _disableInitializers();
    }

    /**
     * @notice The function to initialize the VotingFactory.
     * @param votingRegistry_ The address of the VotingRegistry contract.
     *
     * It binds the VotingRegistry contract to the VotingFactory.
     */
    function __VotingFactory_init(address votingRegistry_) external initializer {
        votingRegistry = VotingRegistry(votingRegistry_);
    }

    /**
     * @inheritdoc IVotingFactory
     */
    function createVoting(
        string memory votingType_,
        IVoting.VotingParams calldata votingParams_
    ) external onlyExistingVotingType(votingType_) {
        address voting_ = _deploy(
            votingType_,
            abi.encodeWithSelector(IVoting.__Voting_init.selector, votingParams_)
        );

        _register(votingType_, msg.sender, voting_);

        emit VotingCreated(votingType_, msg.sender, voting_);
    }

    /**
     * @inheritdoc IVotingFactory
     */
    function createVotingWithSalt(
        string memory votingType_,
        IVoting.VotingParams calldata votingParams_,
        bytes32 salt_
    ) external onlyExistingVotingType(votingType_) {
        bytes32 combinedSalt_ = keccak256(abi.encodePacked(msg.sender, salt_));

        address voting_ = _deploy2(votingType_, new bytes(0), combinedSalt_);

        IVoting(voting_).__Voting_init(votingParams_);

        _register(votingType_, msg.sender, voting_);

        emit VotingCreated(votingType_, msg.sender, voting_);
    }

    /**
     * @inheritdoc IVotingFactory
     */
    function predictVotingAddress(
        string memory poolType_,
        address proposer_,
        bytes32 salt_
    ) external view returns (address) {
        bytes32 combinedSalt_ = keccak256(abi.encodePacked(proposer_, salt_));

        return _predictPoolAddress(poolType_, new bytes(0), combinedSalt_);
    }

    function _deploy(string memory poolType_, bytes memory data_) private returns (address) {
        return address(new ERC1967Proxy(votingRegistry.getVotingImplementation(poolType_), data_));
    }

    function _deploy2(
        string memory poolType_,
        bytes memory data_,
        bytes32 salt_
    ) private returns (address) {
        return
            address(
                new ERC1967Proxy{salt: salt_}(
                    votingRegistry.getVotingImplementation(poolType_),
                    data_
                )
            );
    }

    function _register(string memory poolType_, address proposer_, address poolProxy_) private {
        votingRegistry.addProxyPool(poolType_, proposer_, poolProxy_);
    }

    function _predictPoolAddress(
        string memory poolType_,
        bytes memory data_,
        bytes32 salt_
    ) private view returns (address) {
        bytes32 bytecodeHash = keccak256(
            abi.encodePacked(
                type(ERC1967Proxy).creationCode,
                abi.encode(votingRegistry.getVotingImplementation(poolType_), data_)
            )
        );

        return Create2.computeAddress(salt_, bytecodeHash);
    }

    function _requireExistingVotingType(string memory votingType_) private view {
        require(
            votingRegistry.getVotingImplementation(votingType_) != address(0),
            "VotingFactory: voting type does not exist"
        );
    }

    function _authorizeUpgrade(address) internal view override {
        require(
            msg.sender == OwnableUpgradeable(address(votingRegistry)).owner(),
            "VotingFactory: only registry owner can upgrade"
        );
    }
}
