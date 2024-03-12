// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {IQueryValidator} from "./IQueryValidator.sol";

interface IQueryMTPValidator is IQueryValidator {
    function getRegistrationAddressIndex() external pure returns (uint256 index);

    function getCommitmentIndex() external pure returns (uint256 index);
}
