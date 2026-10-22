// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title RecordRegistry
/// @notice Append-only fingerprints of co-signed salary records for Payslip.
/// No salary data, names or identifiers are stored: only keccak256 hashes. An employment binds the hash
/// of the agreement and the hashes of both parties' passkey public keys. Each month then gets the
/// employer's proposed record hash and the worker's decision (acknowledged or disputed).
///
/// The recorder (the Payslip relayer that pays gas) cannot forge anything: every hash is backed by a
/// passkey signature that anyone can verify off-chain against the anchored key hashes. What the recorder
/// can do is refuse to anchor, which is why a missing entry is itself reported as evidence.
contract RecordRegistry {
    /// Keep in sync with ENTRY_KIND in packages/core/src/packet.ts.
    enum Kind {
        None,
        Proposed,
        Acknowledged,
        Disputed
    }

    struct Employment {
        address recorder;
        bytes32 employmentHash;
        bytes32 workerKeyHash;
        bytes32 employerKeyHash;
        uint64 openedAt;
    }

    struct Entry {
        Kind kind;
        bytes32 recordHash;
        bytes32 decisionHash;
        uint64 recordedAt;
    }

    /// Bounds the per-month history so reads stay cheap. Real months have a handful of entries.
    uint256 public constant MAX_ENTRIES_PER_PERIOD = 32;

    mapping(bytes32 employmentId => Employment) private employments;
    mapping(bytes32 employmentId => mapping(uint32 period => Entry[])) private entries;

    event EmploymentOpened(bytes32 indexed employmentId, address indexed recorder, bytes32 employmentHash);
    event RecordProposed(bytes32 indexed employmentId, uint32 indexed period, bytes32 recordHash);
    event RecordDecided(
        bytes32 indexed employmentId, uint32 indexed period, bytes32 recordHash, bytes32 decisionHash, Kind kind
    );

    error ZeroHash();
    error EmploymentAlreadyOpen(bytes32 employmentId);
    error UnknownEmployment(bytes32 employmentId);
    error NotRecorder(bytes32 employmentId, address caller);
    error InvalidPeriod(uint32 period);
    error UnknownProposal(bytes32 employmentId, uint32 period, bytes32 recordHash);
    error PeriodFull(bytes32 employmentId, uint32 period);

    function openEmployment(
        bytes32 employmentId,
        bytes32 employmentHash,
        bytes32 workerKeyHash,
        bytes32 employerKeyHash
    ) external {
        if (
            employmentId == bytes32(0) || employmentHash == bytes32(0) || workerKeyHash == bytes32(0)
                || employerKeyHash == bytes32(0)
        ) revert ZeroHash();
        if (employments[employmentId].recorder != address(0)) revert EmploymentAlreadyOpen(employmentId);

        employments[employmentId] = Employment({
            recorder: msg.sender,
            employmentHash: employmentHash,
            workerKeyHash: workerKeyHash,
            employerKeyHash: employerKeyHash,
            openedAt: uint64(block.timestamp)
        });
        emit EmploymentOpened(employmentId, msg.sender, employmentHash);
    }

    /// @param period YYYYMM, for example 202604 for April 2026.
    function propose(bytes32 employmentId, uint32 period, bytes32 recordHash) external {
        if (recordHash == bytes32(0)) revert ZeroHash();
        _append(
            employmentId,
            period,
            Entry({
                kind: Kind.Proposed,
                recordHash: recordHash,
                decisionHash: bytes32(0),
                recordedAt: uint64(block.timestamp)
            })
        );
        emit RecordProposed(employmentId, period, recordHash);
    }

    /// Records the worker's answer to a record that was proposed for the same period. Later decisions are
    /// appended, never overwritten, so a dispute stays visible even if an acknowledgement follows it.
    function decide(bytes32 employmentId, uint32 period, bytes32 recordHash, bytes32 decisionHash, bool disputed)
        external
    {
        if (recordHash == bytes32(0) || decisionHash == bytes32(0)) revert ZeroHash();
        if (!_hasProposal(employmentId, period, recordHash)) revert UnknownProposal(employmentId, period, recordHash);
        Kind kind = disputed ? Kind.Disputed : Kind.Acknowledged;
        _append(
            employmentId,
            period,
            Entry({kind: kind, recordHash: recordHash, decisionHash: decisionHash, recordedAt: uint64(block.timestamp)})
        );
        emit RecordDecided(employmentId, period, recordHash, decisionHash, kind);
    }

    function getEmployment(bytes32 employmentId) external view returns (Employment memory) {
        return employments[employmentId];
    }

    function getEntries(bytes32 employmentId, uint32 period) external view returns (Entry[] memory) {
        return entries[employmentId][period];
    }

    function _append(bytes32 employmentId, uint32 period, Entry memory entry) private {
        Employment storage employment = employments[employmentId];
        if (employment.recorder == address(0)) revert UnknownEmployment(employmentId);
        if (employment.recorder != msg.sender) revert NotRecorder(employmentId, msg.sender);
        uint32 month = period % 100;
        if (period < 200001 || period > 999912 || month == 0 || month > 12) revert InvalidPeriod(period);
        Entry[] storage list = entries[employmentId][period];
        if (list.length >= MAX_ENTRIES_PER_PERIOD) revert PeriodFull(employmentId, period);
        list.push(entry);
    }

    function _hasProposal(bytes32 employmentId, uint32 period, bytes32 recordHash) private view returns (bool) {
        Entry[] storage list = entries[employmentId][period];
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i].kind == Kind.Proposed && list[i].recordHash == recordHash) return true;
        }
        return false;
    }
}
