// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {RecordRegistry} from "../src/RecordRegistry.sol";

contract RecordRegistryTest is Test {
    RecordRegistry registry;
    address relayer = address(0xBEEF);
    bytes32 constant ID = keccak256("employment");
    bytes32 constant EMPLOYMENT = keccak256("employment-hash");
    bytes32 constant WORKER = keccak256("worker-key");
    bytes32 constant EMPLOYER = keccak256("employer-key");
    bytes32 constant RECORD = keccak256("april");
    bytes32 constant DECISION = keccak256("ack");
    uint32 constant APRIL = 202604;

    function setUp() public {
        registry = new RecordRegistry();
        vm.prank(relayer);
        registry.openEmployment(ID, EMPLOYMENT, WORKER, EMPLOYER);
    }

    function test_opensEmploymentWithBothKeys() public view {
        RecordRegistry.Employment memory e = registry.getEmployment(ID);
        assertEq(e.recorder, relayer);
        assertEq(e.employmentHash, EMPLOYMENT);
        assertEq(e.workerKeyHash, WORKER);
        assertEq(e.employerKeyHash, EMPLOYER);
        assertEq(e.openedAt, block.timestamp);
    }

    function test_cannotReopenOrOpenWithZeroHashes() public {
        vm.expectRevert(abi.encodeWithSelector(RecordRegistry.EmploymentAlreadyOpen.selector, ID));
        registry.openEmployment(ID, EMPLOYMENT, WORKER, EMPLOYER);
        vm.expectRevert(RecordRegistry.ZeroHash.selector);
        registry.openEmployment(keccak256("other"), EMPLOYMENT, bytes32(0), EMPLOYER);
    }

    function test_proposeThenAcknowledge() public {
        vm.startPrank(relayer);
        registry.propose(ID, APRIL, RECORD);
        vm.expectEmit(true, true, false, true);
        emit RecordRegistry.RecordDecided(ID, APRIL, RECORD, DECISION, RecordRegistry.Kind.Acknowledged);
        registry.decide(ID, APRIL, RECORD, DECISION, false);
        vm.stopPrank();

        RecordRegistry.Entry[] memory list = registry.getEntries(ID, APRIL);
        assertEq(list.length, 2);
        assertEq(uint8(list[0].kind), uint8(RecordRegistry.Kind.Proposed));
        assertEq(list[0].decisionHash, bytes32(0));
        assertEq(uint8(list[1].kind), uint8(RecordRegistry.Kind.Acknowledged));
        assertEq(list[1].recordHash, RECORD);
        assertEq(list[1].decisionHash, DECISION);
    }

    function test_decisionsAppendSoADisputeIsNeverErased() public {
        vm.startPrank(relayer);
        registry.propose(ID, APRIL, RECORD);
        registry.decide(ID, APRIL, RECORD, keccak256("dispute"), true);
        registry.decide(ID, APRIL, RECORD, DECISION, false);
        vm.stopPrank();
        RecordRegistry.Entry[] memory list = registry.getEntries(ID, APRIL);
        assertEq(list.length, 3);
        assertEq(uint8(list[1].kind), uint8(RecordRegistry.Kind.Disputed));
    }

    function test_cannotDecideOnARecordThatWasNeverProposed() public {
        vm.startPrank(relayer);
        registry.propose(ID, APRIL, RECORD);
        vm.expectRevert(abi.encodeWithSelector(RecordRegistry.UnknownProposal.selector, ID, APRIL, keccak256("edited")));
        registry.decide(ID, APRIL, keccak256("edited"), DECISION, false);
        vm.expectRevert(abi.encodeWithSelector(RecordRegistry.UnknownProposal.selector, ID, uint32(202605), RECORD));
        registry.decide(ID, 202605, RECORD, DECISION, false);
        vm.stopPrank();
    }

    function test_onlyTheRecorderCanAppend() public {
        vm.expectRevert(abi.encodeWithSelector(RecordRegistry.NotRecorder.selector, ID, address(this)));
        registry.propose(ID, APRIL, RECORD);
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(RecordRegistry.UnknownEmployment.selector, keccak256("nope")));
        registry.propose(keccak256("nope"), APRIL, RECORD);
    }

    function test_rejectsInvalidPeriods() public {
        uint32[4] memory bad = [uint32(202600), 202613, 199912, 20260401];
        vm.startPrank(relayer);
        for (uint256 i = 0; i < bad.length; i++) {
            vm.expectRevert(abi.encodeWithSelector(RecordRegistry.InvalidPeriod.selector, bad[i]));
            registry.propose(ID, bad[i], RECORD);
        }
        vm.stopPrank();
    }

    function test_capsEntriesPerPeriod() public {
        vm.startPrank(relayer);
        for (uint256 i = 0; i < registry.MAX_ENTRIES_PER_PERIOD(); i++) {
            registry.propose(ID, APRIL, keccak256(abi.encode(i)));
        }
        vm.expectRevert(abi.encodeWithSelector(RecordRegistry.PeriodFull.selector, ID, APRIL));
        registry.propose(ID, APRIL, RECORD);
        vm.stopPrank();
    }

    function testFuzz_entriesForOnePeriodDoNotLeakIntoAnother(uint8 month) public {
        month = uint8(bound(month, 1, 12));
        uint32 period = 202600 + month;
        vm.prank(relayer);
        registry.propose(ID, period, RECORD);
        assertEq(registry.getEntries(ID, period).length, 1);
        assertEq(registry.getEntries(ID, period == APRIL ? 202605 : APRIL).length, 0);
    }
}
