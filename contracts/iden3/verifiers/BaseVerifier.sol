// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {SetHelper} from "@solarity/solidity-lib/libs/arrays/SetHelper.sol";

import {GenesisUtils} from "@iden3/contracts/lib/GenesisUtils.sol";

import {IBaseVerifier} from "../../interfaces/iden3/verifiers/IBaseVerifier.sol";
import {IZKPQueriesStorage} from "../../interfaces/iden3/IZKPQueriesStorage.sol";
import {ILightweightState} from "../../interfaces/iden3/ILightweightState.sol";
import {IQueryValidator} from "../../interfaces/iden3/validators/IQueryValidator.sol";

/**
 * @dev This contract is a copy of the BaseVerifier contract from Rarimo [identity-contracts repository](https://github.com/rarimo/identity-contracts/tree/aeb929ccc3fa8ab508fd7576f9fa853a081e5010).
 */
abstract contract BaseVerifier is IBaseVerifier, OwnableUpgradeable, UUPSUpgradeable {
    using EnumerableSet for EnumerableSet.UintSet;
    using SetHelper for EnumerableSet.UintSet;

    IZKPQueriesStorage public zkpQueriesStorage;

    // schema => allowed issuers
    mapping(uint256 => EnumerableSet.UintSet) internal _allowedIssuers;

    constructor() {
        _disableInitializers();
    }

    function __BaseVerifier_init(IZKPQueriesStorage zkpQueriesStorage_) internal onlyInitializing {
        __Ownable_init();

        _setZKPQueriesStorage(zkpQueriesStorage_);
    }

    function setZKPQueriesStorage(
        IZKPQueriesStorage newZKPQueriesStorage_
    ) external override onlyOwner {
        _setZKPQueriesStorage(newZKPQueriesStorage_);
    }

    function updateAllowedIssuers(
        uint256 schema_,
        uint256[] calldata issuerIds_,
        bool isAdding_
    ) external override onlyOwner {
        _updateAllowedIssuers(schema_, issuerIds_, isAdding_);
    }

    function getAllowedIssuers(uint256 schema_) public view override returns (uint256[] memory) {
        return _allowedIssuers[schema_].values();
    }

    function isAllowedIssuer(
        uint256 schema_,
        uint256 issuerId_
    ) public view virtual override returns (bool) {
        return _allowedIssuers[schema_].contains(issuerId_);
    }

    function _setZKPQueriesStorage(IZKPQueriesStorage newZKPQueriesStorage_) internal {
        zkpQueriesStorage = newZKPQueriesStorage_;
    }

    function _updateAllowedIssuers(
        uint256 schema_,
        uint256[] calldata issuerIds_,
        bool isAdding_
    ) internal {
        if (isAdding_) {
            _allowedIssuers[schema_].add(issuerIds_);
        } else {
            _allowedIssuers[schema_].remove(issuerIds_);
        }
    }

    function _transitState(TransitStateParams memory transitStateParams_) internal {
        ILightweightState lightweightState_ = zkpQueriesStorage.lightweightState();

        if (
            !lightweightState_.isIdentitiesStatesRootExists(
                transitStateParams_.newIdentitiesStatesRoot
            )
        ) {
            lightweightState_.signedTransitState(
                transitStateParams_.newIdentitiesStatesRoot,
                transitStateParams_.gistData,
                transitStateParams_.proof
            );
        }
    }

    function _checkAllowedIssuer(string memory queryId_, uint256 issuerId_) internal view virtual {
        require(
            isAllowedIssuer(zkpQueriesStorage.getStoredSchema(queryId_), issuerId_),
            "BaseVerifier: Issuer is not on the list of allowed issuers."
        );
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
