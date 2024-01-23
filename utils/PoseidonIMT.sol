// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {PoseidonUnit1L, PoseidonUnit2L} from "@iden3/contracts/lib/Poseidon.sol";

import {IncrementalMerkleTree} from "./IncrementalMerkleTree.sol";

/**
 * @notice Incremental Merkle Tree module with Poseidon hash function
 */
contract PoseidonIMT is IncrementalMerkleTree {
    constructor(uint256 treeHeight_) IncrementalMerkleTree(treeHeight_) {}

    function _hash(bytes32 element1_) internal pure override returns (bytes32) {
        return bytes32(PoseidonUnit1L.poseidon([uint256(element1_)]));
    }

    function _hash(bytes32 element1_, bytes32 element2_) internal pure override returns (bytes32) {
        return bytes32(PoseidonUnit2L.poseidon([uint256(element1_), uint256(element2_)]));
    }
}