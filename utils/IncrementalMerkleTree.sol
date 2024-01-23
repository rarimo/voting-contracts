// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @notice Incremental Merkle Tree module
 */
contract IncrementalMerkleTree {
    bytes32 private immutable ZERO_HASH;

    bytes32[] public branches;
    uint256 public leavesCount;

    constructor(uint256 treeHeight_) {
        branches = new bytes32[](treeHeight_);

        ZERO_HASH = _hash(bytes32(abi.encode(0)));
    }

    function add(bytes32 element_) public {
        bytes32 resultValue_;

        resultValue_ = _hash(element_);

        uint256 index_ = 0;
        uint256 size_ = ++leavesCount;
        uint256 treeHeight_ = branches.length;

        while (index_ < treeHeight_) {
            if (size_ & 1 == 1) {
                break;
            }

            resultValue_ = _hash(branches[index_], resultValue_);

            size_ >>= 1;
            ++index_;
        }

        if (index_ == treeHeight_) {
            branches.push(resultValue_);
        } else {
            branches[index_] = resultValue_;
        }
    }

    function getRoot() public view returns (bytes32) {
        uint256 treeHeight_ = branches.length;

        if (treeHeight_ == 0) {
            return ZERO_HASH;
        }

        uint256 height_;
        uint256 size_ = leavesCount;
        bytes32 root_ = ZERO_HASH;
        bytes32[] memory zeroHashes_ = _getZeroHashes(treeHeight_);

        while (height_ < treeHeight_) {
            if (size_ & 1 == 1) {
                root_ = _hash(branches[height_], root_);
            } else {
                root_ = _hash(root_, zeroHashes_[height_]);
            }

            size_ >>= 1;
            ++height_;
        }

        return root_;
    }

    function getHeight() public view returns (uint256) {
        return branches.length;
    }

    function getLength() public view returns (uint256) {
        return leavesCount;
    }

    function _hash(bytes32 element1_) internal pure virtual returns (bytes32) {
        return keccak256(abi.encodePacked(element1_));
    }

    function _hash(bytes32 element1_, bytes32 element2_) internal view virtual returns (bytes32) {
        return keccak256(abi.encodePacked(element1_, element2_));
    }

    function _getZeroHashes(uint256 height_) private view returns (bytes32[] memory) {
        bytes32[] memory zeroHashes_ = new bytes32[](height_);

        zeroHashes_[0] = ZERO_HASH;

        for (uint256 i = 1; i < height_; ++i) {
            bytes32 result;
            bytes32 prevHash_ = zeroHashes_[i - 1];

            result = _hash(prevHash_, prevHash_);

            zeroHashes_[i] = result;
        }

        return zeroHashes_;
    }
}