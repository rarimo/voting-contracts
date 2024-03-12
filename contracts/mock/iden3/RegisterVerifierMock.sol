// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {IZKPQueriesStorage} from "../../interfaces/iden3/IZKPQueriesStorage.sol";

import {RegisterVerifier} from "../../iden3/verifiers/RegisterVerifier.sol";

contract RegisterVerifierMock is RegisterVerifier {
    function __BaseVerifierMock_init(IZKPQueriesStorage zkpQueriesStorage_) external {
        __BaseVerifier_init(zkpQueriesStorage_);
    }
}
