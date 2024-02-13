// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.16;

import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";

import "@iden3/contracts/interfaces/IState.sol";
import "@iden3/contracts/interfaces/IStateTransitionVerifier.sol";
import "@iden3/contracts/lib/SmtLib.sol";
import "@iden3/contracts/lib/Poseidon.sol";
import "@iden3/contracts/lib/StateLib.sol";

/**
 * @dev This contract is a copy of the [StateV2](https://github.com/iden3/contracts/blob/5f6569bc2f942e3cf1c6032c05228046b3f3f5d5/contracts/state/StateV2.sol) contract from iden3 with the addition of an auxiliary event in the transitState function
 */
contract State is Ownable2StepUpgradeable, IState {
    using SmtLib for SmtLib.Data;
    using StateLib for StateLib.Data;

    /**
     * @dev Version of contract
     */
    string public constant VERSION = "2.1.0";

    // This empty reserved space is put in place to allow future versions
    // of the State contract to inherit from other contracts without a risk of
    // breaking the storage layout. This is necessary because the parent contracts in the
    // future may introduce some storage variables, which are placed before the State
    // contract's storage variables.
    // (see https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable#storage-gaps)
    // slither-disable-next-line shadowing-state
    // slither-disable-next-line unused-state
    uint256[500] private __gap;

    /**
     * @dev Verifier address
     */
    IStateTransitionVerifier internal verifier;

    /**
     * @dev State data
     */
    StateLib.Data internal _stateData;

    /**
     * @dev Global Identity State Tree (GIST) data
     */
    SmtLib.Data internal _gistData;

    event StateTransited(
        uint256 gistRoot,
        uint256 indexed id,
        uint256 state,
        uint256 timestamp,
        uint256 blockNumber
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initialize the contract
     * @param verifierContractAddr_ Verifier address
     */
    function __State_init(IStateTransitionVerifier verifierContractAddr_) public initializer {
        __Ownable_init();

        _gistData.initialize(MAX_SMT_DEPTH);

        verifier = verifierContractAddr_;
    }

    /**
     * @dev Set ZKP verifier contract address
     * @param newVerifierAddr_ Verifier contract address
     */
    function setVerifier(address newVerifierAddr_) external onlyOwner {
        verifier = IStateTransitionVerifier(newVerifierAddr_);
    }

    /**
     * @dev Change the state of an identity (transit to the new state) with ZKP ownership check.
     * @param id_ Identity
     * @param oldState_ Previous identity state
     * @param newState_ New identity state
     * @param isOldStateGenesis_ Is the previous state genesis?
     * @param a_ ZKP proof field
     * @param b_ ZKP proof field
     * @param c_ ZKP proof field
     */
    function transitState(
        uint256 id_,
        uint256 oldState_,
        uint256 newState_,
        bool isOldStateGenesis_,
        uint256[2] memory a_,
        uint256[2][2] memory b_,
        uint256[2] memory c_
    ) external {
        require(id_ != 0, "ID should not be zero");
        require(newState_ != 0, "New state should not be zero");
        require(!stateExists(id_, newState_), "New state already exists");

        if (isOldStateGenesis_) {
            require(!idExists(id_), "Old state is genesis but identity already exists");

            // Push old state to state entries, with zero timestamp and block
            _stateData.addGenesisState(id_, oldState_);
        } else {
            require(idExists(id_), "Old state is not genesis but identity does not yet exist");

            StateLib.EntryInfo memory prevStateInfo_ = _stateData.getStateInfoById(id_);

            require(
                prevStateInfo_.createdAtBlock != block.number,
                "No multiple set in the same block"
            );
            require(
                prevStateInfo_.state == oldState_,
                "Old state does not match the latest state"
            );
        }

        uint256[4] memory inputs_ = [
            id_,
            oldState_,
            newState_,
            uint256(isOldStateGenesis_ ? 1 : 0)
        ];

        require(
            verifier.verifyProof(a_, b_, c_, inputs_),
            "Zero-knowledge proof of state transition is not valid"
        );

        _stateData.addState(id_, newState_);
        _gistData.addLeaf(PoseidonUnit1L.poseidon([id_]), newState_);

        emit StateTransited(_gistData.getRoot(), id_, newState_, block.timestamp, block.number);
    }

    /**
     * @dev Get ZKP verifier contract address
     * @return verifier contract address
     */
    function getVerifier() external view returns (address) {
        return address(verifier);
    }

    /**
     * @dev Retrieve the last state info for a given identity
     * @param id_ identity
     * @return state info of the last committed state
     */
    function getStateInfoById(uint256 id_) external view returns (IState.StateInfo memory) {
        return _stateEntryInfoAdapter(_stateData.getStateInfoById(id_));
    }

    /**
     * @dev Retrieve states quantity for a given identity
     * @param id_ identity
     * @return states quantity
     */
    function getStateInfoHistoryLengthById(uint256 id_) external view returns (uint256) {
        return _stateData.getStateInfoHistoryLengthById(id_);
    }

    /**
     * Retrieve state infos for a given identity
     * @param id_ identity
     * @param startIndex_ start index of the state history
     * @param length_ length of the state history
     * @return A list of state infos of the identity
     */
    function getStateInfoHistoryById(
        uint256 id_,
        uint256 startIndex_,
        uint256 length_
    ) external view returns (IState.StateInfo[] memory) {
        StateLib.EntryInfo[] memory stateInfos_ = _stateData.getStateInfoHistoryById(
            id_,
            startIndex_,
            length_
        );
        IState.StateInfo[] memory result_ = new IState.StateInfo[](stateInfos_.length);

        for (uint256 i = 0; i < stateInfos_.length; i++) {
            result_[i] = _stateEntryInfoAdapter(stateInfos_[i]);
        }

        return result_;
    }

    /**
     * @dev Retrieve state information by id and state.
     * @param id_ An identity.
     * @param state_ A state.
     * @return The state info.
     */
    function getStateInfoByIdAndState(
        uint256 id_,
        uint256 state_
    ) external view returns (IState.StateInfo memory) {
        return _stateEntryInfoAdapter(_stateData.getStateInfoByIdAndState(id_, state_));
    }

    /**
     * @dev Retrieve GIST inclusion or non-inclusion proof for a given identity.
     * @param id_ Identity
     * @return The GIST inclusion or non-inclusion proof for the identity
     */
    function getGISTProof(uint256 id_) external view returns (IState.GistProof memory) {
        return _smtProofAdapter(_gistData.getProof(PoseidonUnit1L.poseidon([id_])));
    }

    /**
     * @dev Retrieve GIST inclusion or non-inclusion proof for a given identity for
     * some GIST root in the past.
     * @param id_ Identity
     * @param root_ GIST root
     * @return The GIST inclusion or non-inclusion proof for the identity
     */
    function getGISTProofByRoot(
        uint256 id_,
        uint256 root_
    ) external view returns (IState.GistProof memory) {
        return _smtProofAdapter(_gistData.getProofByRoot(PoseidonUnit1L.poseidon([id_]), root_));
    }

    /**
     * @dev Retrieve GIST inclusion or non-inclusion proof for a given identity
     * for GIST latest snapshot by the block number provided.
     * @param id_ Identity
     * @param blockNumber_ Blockchain block number
     * @return The GIST inclusion or non-inclusion proof for the identity
     */
    function getGISTProofByBlock(
        uint256 id_,
        uint256 blockNumber_
    ) external view returns (IState.GistProof memory) {
        return
            _smtProofAdapter(
                _gistData.getProofByBlock(PoseidonUnit1L.poseidon([id_]), blockNumber_)
            );
    }

    /**
     * @dev Retrieve GIST inclusion or non-inclusion proof for a given identity
     * for GIST latest snapshot by the blockchain timestamp provided.
     * @param id_ Identity
     * @param timestamp_ Blockchain timestamp
     * @return The GIST inclusion or non-inclusion proof for the identity
     */
    function getGISTProofByTime(
        uint256 id_,
        uint256 timestamp_
    ) external view returns (IState.GistProof memory) {
        return
            _smtProofAdapter(_gistData.getProofByTime(PoseidonUnit1L.poseidon([id_]), timestamp_));
    }

    /**
     * @dev Retrieve GIST latest root.
     * @return The latest GIST root
     */
    function getGISTRoot() external view returns (uint256) {
        return _gistData.getRoot();
    }

    /**
     * @dev Retrieve the GIST root history.
     * @param start_ Start index in the root history
     * @param length_ Length of the root history
     * @return Array of GIST roots infos
     */
    function getGISTRootHistory(
        uint256 start_,
        uint256 length_
    ) external view returns (IState.GistRootInfo[] memory) {
        SmtLib.RootEntryInfo[] memory rootInfos_ = _gistData.getRootHistory(start_, length_);
        IState.GistRootInfo[] memory result_ = new IState.GistRootInfo[](rootInfos_.length);

        for (uint256 i = 0; i < rootInfos_.length; i++) {
            result_[i] = _smtRootInfoAdapter(rootInfos_[i]);
        }

        return result_;
    }

    /**
     * @dev Retrieve the length of the GIST root history.
     * @return The GIST root history length
     */
    function getGISTRootHistoryLength() external view returns (uint256) {
        return _gistData.rootEntries.length;
    }

    /**
     * @dev Retrieve the specific GIST root information.
     * @param root_ GIST root.
     * @return The GIST root information.
     */
    function getGISTRootInfo(uint256 root_) external view returns (IState.GistRootInfo memory) {
        return _smtRootInfoAdapter(_gistData.getRootInfo(root_));
    }

    /**
     * @dev Retrieve the GIST root information, which is latest by the block provided.
     * @param blockNumber_ Blockchain block number
     * @return The GIST root info
     */
    function getGISTRootInfoByBlock(
        uint256 blockNumber_
    ) external view returns (IState.GistRootInfo memory) {
        return _smtRootInfoAdapter(_gistData.getRootInfoByBlock(blockNumber_));
    }

    /**
     * @dev Retrieve the GIST root information, which is latest by the blockchain timestamp provided.
     * @param timestamp_ Blockchain timestamp
     * @return The GIST root info
     */
    function getGISTRootInfoByTime(
        uint256 timestamp_
    ) external view returns (IState.GistRootInfo memory) {
        return _smtRootInfoAdapter(_gistData.getRootInfoByTime(timestamp_));
    }

    /**
     * @dev Check if identity exists.
     * @param id_ Identity
     * @return True if the identity exists
     */
    function idExists(uint256 id_) public view returns (bool) {
        return _stateData.idExists(id_);
    }

    /**
     * @dev Check if state exists.
     * @param id_ Identity
     * @param state_ State
     * @return True if the state exists
     */
    function stateExists(uint256 id_, uint256 state_) public view returns (bool) {
        return _stateData.stateExists(id_, state_);
    }

    function _smtProofAdapter(
        SmtLib.Proof memory proof_
    ) internal pure returns (IState.GistProof memory) {
        // slither-disable-next-line uninitialized-local
        uint256[MAX_SMT_DEPTH] memory siblings_;

        for (uint256 i = 0; i < MAX_SMT_DEPTH; i++) {
            siblings_[i] = proof_.siblings[i];
        }

        IState.GistProof memory result = IState.GistProof({
            root: proof_.root,
            existence: proof_.existence,
            siblings: siblings_,
            index: proof_.index,
            value: proof_.value,
            auxExistence: proof_.auxExistence,
            auxIndex: proof_.auxIndex,
            auxValue: proof_.auxValue
        });

        return result;
    }

    function _smtRootInfoAdapter(
        SmtLib.RootEntryInfo memory rootInfo_
    ) internal pure returns (IState.GistRootInfo memory) {
        return
            IState.GistRootInfo({
                root: rootInfo_.root,
                replacedByRoot: rootInfo_.replacedByRoot,
                createdAtTimestamp: rootInfo_.createdAtTimestamp,
                replacedAtTimestamp: rootInfo_.replacedAtTimestamp,
                createdAtBlock: rootInfo_.createdAtBlock,
                replacedAtBlock: rootInfo_.replacedAtBlock
            });
    }

    function _stateEntryInfoAdapter(
        StateLib.EntryInfo memory sei_
    ) internal pure returns (IState.StateInfo memory) {
        return
            IState.StateInfo({
                id: sei_.id,
                state: sei_.state,
                replacedByState: sei_.replacedByState,
                createdAtTimestamp: sei_.createdAtTimestamp,
                replacedAtTimestamp: sei_.replacedAtTimestamp,
                createdAtBlock: sei_.createdAtBlock,
                replacedAtBlock: sei_.replacedAtBlock
            });
    }
}
