// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

import './interfaces/ITerminalV1.sol';

contract TerminalV1_Rescue is ITerminal, Ownable {
  event RescueIsAllowed(uint256 projectId, bool flag);
  event AddToBalance(uint256 indexed projectId, uint256 value, address caller);

  // --- public immutable stored properties --- //

  /// @notice The Projects contract which mints ERC-721's that represent project ownership and transfers.
  IProjects public immutable projects;

  /// @notice The contract storing all funding cycle configurations.
  IFundingCycles public immutable fundingCycles;

  /// @notice The directory of terminals.
  ITerminalDirectory public immutable override terminalDirectory;

  mapping(uint256 => bool) public rescueIsAllowed;

  // --- external transactions --- //

  /** 
      @param _projects A Projects contract which mints ERC-721's that represent project ownership and transfers.
      @param _fundingCycles A funding cycle configuration store.
      @param _terminalDirectory A directory of a project's current Juicebox terminal to receive payments in.
    */
  constructor(
    IProjects _projects,
    IFundingCycles _fundingCycles,
    ITerminalDirectory _terminalDirectory,
    address _owner
  ) {
    require(
      _projects != IProjects(address(0)) &&
        _fundingCycles != IFundingCycles(address(0)) &&
        _terminalDirectory != ITerminalDirectory(address(0)) &&
        _owner != address(0),
      'TerminalV1_Rescue: ZERO_ADDRESS'
    );
    projects = _projects;
    fundingCycles = _fundingCycles;
    terminalDirectory = _terminalDirectory;

    transferOwnership(_owner);
  }

  function setRescueIsAllowed(uint256 _projectId, bool _flag) external onlyOwner {
    rescueIsAllowed[_projectId] = _flag;

    emit RescueIsAllowed(_projectId, _flag);
  }

  /** 
      @notice 
      Receives and allocates funds belonging to the specified project.

      @dev
      This gets called on migration from another terminal.

      @param _projectId The ID of the project to which the funds received belong.
    */
  function addToBalance(uint256 _projectId) external payable override {
    // The amount must be positive.
    require(msg.value > 0, 'TerminalV1_Rescue::addToBalance: BAD_AMOUNT');

    // Only allow listed projects can be rescued.
    require(rescueIsAllowed[_projectId], 'TerminalV1_Rescue::addToBalance: NOT_ALLOW_LISTED');

    // Get a reference to the project's current funding cycle.
    FundingCycle memory _fundingCycle = fundingCycles.currentOf(_projectId);

    // Stuck projects will not have a current funding cycle.
    require(_fundingCycle.number == 0, 'TerminalV1_Rescue::addToBalance: NOT_STUCK');

    // Make sure the current ballot is approved before checking the status of the latest funding cycle.
    require(
      fundingCycles.currentBallotStateOf(_projectId) == BallotState.Approved,
      'TerminalV1_Rescue::addToBalance: BALLOT_NOT_APPROVED'
    );

    // Check to see if the latest funding cycle is one-time (discount rate = 201).
    // Only allow migration to this contract if this is the case.
    _fundingCycle = fundingCycles.get(fundingCycles.latestIdOf(_projectId));
    require(_fundingCycle.discountRate == 201, 'TerminalV1_Rescue::addToBalance: NOT_STUCK');

    // Otherwise, send the funds directly to the beneficiary.
    Address.sendValue(payable(projects.ownerOf(_projectId)), msg.value);
    emit AddToBalance(_projectId, msg.value, msg.sender);
  }

  /****************** */
  // REQUIRED FOR ITERMINAL INTERFACE CONFORMANCE
  /****************** */

  function migrationIsAllowed(ITerminal) external pure override returns (bool) {
    return false;
  }

  function allowMigration(ITerminal _contract) external override {}

  function pay(
    uint256,
    address,
    string calldata,
    bool
  ) external payable override returns (uint256) {
    require(false, 'TerminalV1_Rescue::pay: NOT_ACCEPTING_FUNDS');
    return 0;
  }

  function migrate(uint256, ITerminal) external pure override {
    return;
  }
}
