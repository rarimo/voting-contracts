// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {QueryValidator} from "./QueryValidator.sol";

/**
 * @dev This contract is a copy of the QueryMTPValidator contract from Rarimo [identity-contracts repository](https://github.com/rarimo/identity-contracts/tree/aeb929ccc3fa8ab508fd7576f9fa853a081e5010).
 */
contract QueryMTPValidator is QueryValidator {
    string internal constant CIRCUIT_ID = "credentialAtomicQueryMTPV2OnChain";
    uint256 internal constant USER_ID_INDEX = 1;
    uint256 internal constant CHALLENGE_INDEX = 4;

    function __QueryMTPValidator_init(
        address verifierContractAddr_,
        address stateContractAddr_,
        uint256 identitesStatesUpdateTime_
    ) public initializer {
        __QueryValidator_init(
            verifierContractAddr_,
            stateContractAddr_,
            identitesStatesUpdateTime_
        );
    }

    function getCircuitId() external pure override returns (string memory id) {
        return CIRCUIT_ID;
    }

    function getUserIdIndex() external pure override returns (uint256) {
        return USER_ID_INDEX;
    }

    function getChallengeInputIndex() external pure override returns (uint256 index) {
        return CHALLENGE_INDEX;
    }

    function _getInputValidationParameters(
        uint256[] calldata inputs_
    ) internal pure override returns (ValidationParams memory) {
        return ValidationParams(inputs_[2], inputs_[5], inputs_[6], inputs_[7], inputs_[9]);
    }
}
