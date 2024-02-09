// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {IIdentityVerifier} from "../../interfaces/verifiers/IIdentityVerifier.sol";
import {IZKPQueriesStorage} from "../../interfaces/IZKPQueriesStorage.sol";
import {ILightweightState} from "../../interfaces/ILightweightState.sol";
import {IQueryValidator} from "../../interfaces/IQueryValidator.sol";

import {BaseVerifier} from "./BaseVerifier.sol";

/**
 * @dev This contract is a copy of the IdentityVerifier contract from Rarimo [identity-contracts repository](https://github.com/rarimo/identity-contracts/tree/aeb929ccc3fa8ab508fd7576f9fa853a081e5010).
 */
contract IdentityVerifier is IIdentityVerifier, BaseVerifier {
    string public constant IDENTITY_PROOF_QUERY_ID = "IDENTITY_PROOF";

    mapping(address => uint256) public override addressToIdentityId;

    mapping(uint256 => IdentityProofInfo) internal _identitiesProofInfo;

    function __IdentityVerifier_init(IZKPQueriesStorage zkpQueriesStorage_) external initializer {
        __BaseVerifier_init(zkpQueriesStorage_);
    }

    function proveIdentity(ProveIdentityParams calldata proveIdentityParams_) external override {
        _proveIdentity(proveIdentityParams_);
    }

    function transitStateAndProveIdentity(
        ProveIdentityParams calldata proveIdentityParams_,
        TransitStateParams calldata transitStateParams_
    ) external override {
        _transitState(transitStateParams_);
        _proveIdentity(proveIdentityParams_);
    }

    function getIdentityProofInfo(
        uint256 identityId_
    ) external view override returns (IdentityProofInfo memory) {
        return _identitiesProofInfo[identityId_];
    }

    function isIdentityProved(address userAddr_) external view override returns (bool) {
        return _identitiesProofInfo[addressToIdentityId[userAddr_]].isProved;
    }

    function isIdentityProved(uint256 identityId_) public view override returns (bool) {
        return _identitiesProofInfo[identityId_].isProved;
    }

    function _proveIdentity(ProveIdentityParams calldata proveIdentityParams_) internal {
        _verify(IDENTITY_PROOF_QUERY_ID, proveIdentityParams_);

        require(
            addressToIdentityId[msg.sender] == 0,
            "IdentityVerifier: Msg sender address has already been used to prove the another identity."
        );

        IQueryValidator queryValidator_ = IQueryValidator(
            zkpQueriesStorage.getQueryValidator(IDENTITY_PROOF_QUERY_ID)
        );

        uint256 identityId_ = proveIdentityParams_.inputs[queryValidator_.getUserIdIndex()];

        require(
            !isIdentityProved(identityId_),
            "IdentityVerifier: Identity has already been proven."
        );

        addressToIdentityId[msg.sender] = identityId_;
        _identitiesProofInfo[identityId_] = IdentityProofInfo(msg.sender, true);

        emit IdentityProved(identityId_, msg.sender);
    }
}
