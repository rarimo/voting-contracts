// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {IZKPQueriesStorage} from "../IZKPQueriesStorage.sol";

import {ILightweightState} from "../ILightweightState.sol";

/**
 * @dev This contract is a copy of the IBaseVerifier contract from Rarimo [identity-contracts repository](https://github.com/rarimo/identity-contracts/tree/aeb929ccc3fa8ab508fd7576f9fa853a081e5010).
 */
interface IBaseVerifier {
    struct ProveIdentityParams {
        ILightweightState.StatesMerkleData statesMerkleData;
        uint256[] inputs;
        uint256[2] a;
        uint256[2][2] b;
        uint256[2] c;
    }

    struct TransitStateParams {
        bytes32 newIdentitiesStatesRoot;
        ILightweightState.GistRootData gistData;
        bytes proof;
    }

    function setZKPQueriesStorage(IZKPQueriesStorage newZKPQueriesStorage_) external;

    function updateAllowedIssuers(
        uint256 schema_,
        uint256[] memory issuerIds_,
        bool isAdding_
    ) external;

    function zkpQueriesStorage() external view returns (IZKPQueriesStorage);

    function getAllowedIssuers(uint256 schema_) external view returns (uint256[] memory);

    function isAllowedIssuer(uint256 schema_, uint256 issuerId_) external view returns (bool);
}
