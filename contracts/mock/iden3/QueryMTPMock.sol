// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {QueryMTPValidator} from "../../iden3/validators/QueryMTPValidator.sol";

contract QueryValidatorMock is QueryMTPValidator {
    function __QueryValidatorMock_init(
        address verifierContractAddr_,
        address stateContractAddr_,
        uint256 identitesStatesUpdateTime_
    ) external {
        __QueryValidator_init(
            verifierContractAddr_,
            stateContractAddr_,
            identitesStatesUpdateTime_
        );
    }
}
