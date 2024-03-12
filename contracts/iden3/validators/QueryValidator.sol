// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {VerifierHelper} from "@solarity/solidity-lib/libs/zkp/snarkjs/VerifierHelper.sol";

import {GenesisUtils} from "@iden3/contracts/lib/GenesisUtils.sol";

import {ILightweightState} from "../../interfaces/iden3/ILightweightState.sol";
import {IQueryValidator} from "../../interfaces/iden3/validators/IQueryValidator.sol";

/**
 * @dev This contract is a copy of the QueryValidator contract from Rarimo [identity-contracts repository](https://github.com/rarimo/identity-contracts/tree/aeb929ccc3fa8ab508fd7576f9fa853a081e5010).
 */
abstract contract QueryValidator is IQueryValidator, OwnableUpgradeable, UUPSUpgradeable {
    using VerifierHelper for address;

    ILightweightState public override lightweightState;
    address public override verifier;

    uint256 public override identitesStatesUpdateTime;

    constructor() {
        _disableInitializers();
    }

    function __QueryValidator_init(
        address verifierContractAddr_,
        address stateContractAddr_,
        uint256 identitesStatesUpdateTime_
    ) internal onlyInitializing {
        __Ownable_init();

        lightweightState = ILightweightState(stateContractAddr_);
        verifier = verifierContractAddr_;

        identitesStatesUpdateTime = identitesStatesUpdateTime_;
    }

    function setVerifier(address newVerifier_) external override onlyOwner {
        verifier = newVerifier_;
    }

    function setIdentitesStatesUpdateTime(
        uint256 newIdentitesStatesUpdateTime_
    ) public virtual override onlyOwner {
        identitesStatesUpdateTime = newIdentitesStatesUpdateTime_;
    }

    function verify(
        ILightweightState.StatesMerkleData calldata statesMerkleData_,
        uint256[] memory inputs_,
        uint256[2] calldata a_,
        uint256[2][2] calldata b_,
        uint256[2] calldata c_,
        uint256 queryHash_
    ) external view virtual override returns (bool) {
        require(verifier.verifyProof(inputs_, a_, b_, c_), "QueryValidator: proof is not valid");

        ValidationParams memory validationParams_ = _getInputValidationParameters(inputs_);

        require(
            validationParams_.queryHash == queryHash_,
            "QueryValidator: query hash does not match the requested one"
        );

        require(
            validationParams_.issuerClaimAuthState == validationParams_.issuerClaimNonRevState,
            "QueryValidator: only actual states must be used"
        );
        require(
            validationParams_.issuerId == statesMerkleData_.issuerId &&
                validationParams_.issuerClaimNonRevState == statesMerkleData_.issuerState,
            "QueryValidator: invalid issuer data in the states merkle data struct"
        );

        _checkGistRoot(validationParams_.gistRoot);
        _verifyStatesMerkleData(statesMerkleData_);

        return true;
    }

    function getCircuitId() external pure virtual returns (string memory);

    function getUserIdIndex() external pure virtual returns (uint256);

    function getChallengeInputIndex() external pure virtual returns (uint256);

    function _getInputValidationParameters(
        uint256[] memory inputs_
    ) internal pure virtual returns (ValidationParams memory);

    function _checkGistRoot(uint256 gistRoot_) internal view {
        ILightweightState.GistRootData memory rootData_ = lightweightState.geGISTRootData(
            gistRoot_
        );

        require(
            gistRoot_ != 0 && rootData_.root == gistRoot_,
            "QueryValidator: gist root state isn't in state contract"
        );
    }

    function _verifyStatesMerkleData(
        ILightweightState.StatesMerkleData calldata statesMerkleData_
    ) internal view {
        (bool isRootExists_, bytes32 computedRoot_) = lightweightState.verifyStatesMerkleData(
            statesMerkleData_
        );

        require(
            isRootExists_,
            "QueryValidator: issuer state does not exist in the state contract"
        );

        if (computedRoot_ != lightweightState.identitiesStatesRoot()) {
            ILightweightState.IdentitiesStatesRootData
                memory _identitiesStatesRootData = lightweightState.getIdentitiesStatesRootData(
                    computedRoot_
                );

            require(
                _identitiesStatesRootData.setTimestamp + identitesStatesUpdateTime >
                    block.timestamp,
                "QueryValidator: identites states update time has expired"
            );
        }
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
