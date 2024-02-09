// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {IBaseVerifier} from "./IBaseVerifier.sol";
import {ILightweightState} from "../ILightweightState.sol";

/**
 * @dev This contract is a copy of the IIdentityVerifier contract from Rarimo [identity-contracts repository](https://github.com/rarimo/identity-contracts/tree/aeb929ccc3fa8ab508fd7576f9fa853a081e5010).
 */
interface IIdentityVerifier is IBaseVerifier {
    struct IdentityProofInfo {
        address senderAddr;
        bool isProved;
    }

    event IdentityProved(uint256 indexed identityId, address senderAddr);

    function proveIdentity(ProveIdentityParams calldata proveIdentityParams_) external;

    function transitStateAndProveIdentity(
        ProveIdentityParams calldata proveIdentityParams_,
        TransitStateParams calldata transitStateParams_
    ) external;

    function addressToIdentityId(address senderAddr_) external view returns (uint256);

    function getIdentityProofInfo(
        uint256 identityId_
    ) external view returns (IdentityProofInfo memory);

    function isIdentityProved(address userAddr_) external view returns (bool);

    function isIdentityProved(uint256 identityId_) external view returns (bool);
}
