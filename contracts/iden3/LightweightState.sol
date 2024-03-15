// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

import {UUPSSignableUpgradeable} from "@rarimo/evm-bridge-contracts/bridge/proxy/UUPSSignableUpgradeable.sol";
import {Signers} from "@rarimo/evm-bridge-contracts/utils/Signers.sol";

import {ILightweightState} from "../interfaces/iden3/ILightweightState.sol";

/**
 * @dev This contract is a copy of the LightweightState contract from Rarimo [identity-contracts repository](https://github.com/rarimo/identity-contracts/tree/aeb929ccc3fa8ab508fd7576f9fa853a081e5010).
 */
contract LightweightState is ILightweightState, UUPSSignableUpgradeable, Signers {
    address public override sourceStateContract;
    string public override sourceChainName;

    bytes32 public override identitiesStatesRoot;

    uint256 internal _currentGistRoot;

    // gist root => GistRootData
    mapping(uint256 => GistRootData) internal _gistsRootData;

    // identities states root => identities states root data
    mapping(bytes32 => IdentitiesStatesRootData) internal _identitiesStatesRootsData;

    constructor() {
        _disableInitializers();
    }

    function __LightweightState_init(
        address signer_,
        address sourceStateContract_,
        string calldata sourceChainName_,
        string calldata chainName_
    ) external initializer {
        __Signers_init(signer_, address(0), chainName_);

        sourceStateContract = sourceStateContract_;
        sourceChainName = sourceChainName_;
    }

    function changeSigner(
        bytes calldata newSignerPubKey_,
        bytes calldata signature_
    ) external override {
        _checkSignature(keccak256(newSignerPubKey_), signature_);

        signer = _convertPubKeyToAddress(newSignerPubKey_);
    }

    function changeSourceStateContract(
        address newSourceStateContract_,
        bytes calldata signature_
    ) external override {
        require(newSourceStateContract_ != address(0), "LightweightState: Zero address");

        _validateChangeAddressSignature(
            uint8(MethodId.ChangeSourceStateContract),
            address(this),
            newSourceStateContract_,
            signature_
        );

        sourceStateContract = newSourceStateContract_;
    }

    function signedTransitState(
        bytes32 newIdentitiesStatesRoot_,
        GistRootData calldata gistData_,
        bytes calldata proof_
    ) external override {
        _checkMerkleSignature(getSignHash(gistData_, newIdentitiesStatesRoot_), proof_);

        require(
            !isIdentitiesStatesRootExists(newIdentitiesStatesRoot_),
            "LightweightState: Identities states root already exists"
        );
        require(
            _gistsRootData[gistData_.root].root == 0,
            "LightweightState: Gist root already exists"
        );

        _gistsRootData[gistData_.root] = gistData_;

        _identitiesStatesRootsData[newIdentitiesStatesRoot_] = IdentitiesStatesRootData(
            newIdentitiesStatesRoot_,
            block.timestamp
        );

        if (gistData_.createdAtTimestamp > _gistsRootData[_currentGistRoot].createdAtTimestamp) {
            _currentGistRoot = gistData_.root;

            identitiesStatesRoot = newIdentitiesStatesRoot_;
        }

        emit SignedStateTransited(gistData_.root, newIdentitiesStatesRoot_);
    }

    function getSignHash(
        GistRootData calldata gistData_,
        bytes32 identitiesStatesRoot_
    ) public view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    gistData_.root,
                    gistData_.createdAtTimestamp,
                    identitiesStatesRoot_,
                    sourceStateContract,
                    sourceChainName
                )
            );
    }

    function isIdentitiesStatesRootExists(bytes32 root_) public view returns (bool) {
        return _identitiesStatesRootsData[root_].setTimestamp != 0;
    }

    function getIdentitiesStatesRootData(
        bytes32 root_
    ) external view returns (IdentitiesStatesRootData memory) {
        return _identitiesStatesRootsData[root_];
    }

    function getGISTRoot() external view override returns (uint256) {
        return _currentGistRoot;
    }

    function getCurrentGISTRootInfo() external view override returns (GistRootData memory) {
        return _gistsRootData[_currentGistRoot];
    }

    function geGISTRootData(uint256 root_) external view override returns (GistRootData memory) {
        return _gistsRootData[root_];
    }

    function verifyStatesMerkleData(
        StatesMerkleData calldata statesMerkleData_
    ) external view override returns (bool, bytes32) {
        bytes32 merkleLeaf_ = keccak256(
            abi.encodePacked(
                statesMerkleData_.issuerId,
                statesMerkleData_.issuerState,
                statesMerkleData_.createdAtTimestamp
            )
        );
        bytes32 computedRoot_ = MerkleProof.processProofCalldata(
            statesMerkleData_.merkleProof,
            merkleLeaf_
        );

        return (isIdentitiesStatesRootExists(computedRoot_), computedRoot_);
    }

    function _authorizeUpgrade(
        address newImplementation_,
        bytes calldata signature_
    ) internal override {
        require(newImplementation_ != address(0), "LightweightState: Zero address");

        _validateChangeAddressSignature(
            uint8(MethodId.AuthorizeUpgrade),
            address(this),
            newImplementation_,
            signature_
        );
    }

    function _authorizeUpgrade(address) internal pure virtual override {
        revert("LightweightState: This upgrade method is off");
    }
}
