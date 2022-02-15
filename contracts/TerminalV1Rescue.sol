// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import '@openzeppelin/contracts/utils/Address.sol';

import '@paulrberg/contracts/math/PRBMath.sol';
import '@paulrberg/contracts/math/PRBMathUD60x18.sol';

import './interfaces/ITerminalV1Rescue.sol';
import './abstract/JuiceboxProject.sol';
import './abstract/Operatable.sol';

import './libraries/Operations.sol';

/**
  @notice 
  Terminal allowing allow listed projects with one-time funding cycles to rescue stuck ETH.
*/
contract TerminalV1Rescue is Operatable, ITerminalV1Rescue, ITerminal, ReentrancyGuard, Ownable {
  /// @notice The Projects contract which mints ERC-721's that represent project ownership and transfers.
  IProjects public immutable override projects;

  /// @notice The contract storing all funding cycle configurations.
  IFundingCycles public immutable override fundingCycles;

  /// @notice The contract that manages Ticket printing and redeeming.
  ITicketBooth public immutable override ticketBooth;

  /// @notice The directory of terminals.
  ITerminalDirectory public immutable override terminalDirectory;

  /// @notice The amount of ETH that each project is responsible for.
  mapping(uint256 => uint256) public override balanceOf;

  /// @notice The addresses that are allowed to be rescued.
  mapping(uint256 => bool) public override rescueAllowed;

  // Whether or not a particular contract is available for projects to migrate their funds and Tickets to.
  mapping(ITerminal => bool) public override migrationIsAllowed;

  /** 
    @param _projects A Projects contract which mints ERC-721's that represent project ownership and transfers.
    @param _fundingCycles A funding cycle configuration store.
    @param _ticketBooth A contract that manages Ticket printing and redeeming.
    @param _operatorStore A contract storing operator assignments.
    @param _terminalDirectory A directory of a project's current Juicebox terminal to receive payments in.
  */
  constructor(
    IProjects _projects,
    IFundingCycles _fundingCycles,
    ITicketBooth _ticketBooth,
    IOperatorStore _operatorStore,
    ITerminalDirectory _terminalDirectory,
    address _owner
  ) Operatable(_operatorStore) {
    require(
      _projects != IProjects(address(0)) &&
        _fundingCycles != IFundingCycles(address(0)) &&
        _ticketBooth != ITicketBooth(address(0)) &&
        _terminalDirectory != ITerminalDirectory(address(0)) &&
        _owner != address(0),
      'zero address'
    );
    projects = _projects;
    fundingCycles = _fundingCycles;
    ticketBooth = _ticketBooth;
    terminalDirectory = _terminalDirectory;

    transferOwnership(_owner);
  }

  /** 
    @notice 
    Allows a project to print tickets for a specified beneficiary.

    @dev
    Only a project's owner or a designated operator can print tickets.

    @param _projectId The ID of the project to print tickets for.
    @param _amount The amount of tickets to print.
    @param _beneficiary The address to send the printed tickets to.
    @param _memo A memo to leave with the printing.
    @param _preferUnstakedTickets If there is a preference to unstake the printed tickets.
  */
  function printTickets(
    uint256 _projectId,
    uint256 _amount,
    address _beneficiary,
    string memory _memo,
    bool _preferUnstakedTickets
  )
    external
    override
    requirePermission(projects.ownerOf(_projectId), _projectId, Operations.PrintTickets)
  {
    // Can't send to the zero address.
    require(_beneficiary != address(0), 'zero address');

    // Print the project's tickets for the beneficiary.
    ticketBooth.print(_beneficiary, _projectId, _amount, _preferUnstakedTickets);

    emit PrintTickets(_projectId, _beneficiary, _amount, _memo, msg.sender);
  }

  /** 
    @notice
    A function that burns the supply of the dead address for a project. 

    @dev
    Callable only by project owner, if rescue is allowed by the projectId, if the project's current funding cycle is non recurring.

    @param _projectId The ID of the project whose ETH is being resued.
    @param _beneficiary The recipient of the resucued funds.
    @param _amount The amount to rescue as a fixed point number.
  */
  function rescue(
    uint256 _projectId,
    address payable _beneficiary,
    uint256 _amount
  ) external override nonReentrant {
    // Must be project owner.
    require(msg.sender == projects.ownerOf(_projectId), 'not owner');

    // Project must be allow listed.
    require(rescueAllowed[_projectId], 'not allowed');

    // Amount must have been specified.
    require(_amount > 0, 'must be rescuing something');

    // Get a referrence to the original balance.
    uint256 _originalBalance = balanceOf[_projectId];

    // Balance must exist.
    require(_originalBalance >= _amount, 'not enough to rescue');

    // Get a reference to the current funding cycle for the project.
    FundingCycle memory _fundingCycle = fundingCycles.get(fundingCycles.latestIdOf(_projectId));

    // Only one-time funding cycles are rescuable.
    require(_fundingCycle.discountRate == 201, 'cant rescue');

    balanceOf[_projectId] = balanceOf[_projectId] - _amount;

    // Send funds to beneficiary.
    if (_amount > 0) Address.sendValue(_beneficiary, _amount);

    emit Rescued(_projectId, _beneficiary, _originalBalance, _amount, msg.sender);
  }

  /**
    @notice 
    Receives and allocates funds belonging to the specified project.

    @param _projectId The ID of the project to which the funds received belong.
  */
  function addToBalance(uint256 _projectId) external payable override {
    require(rescueAllowed[_projectId], 'not allowed');
    balanceOf[_projectId] = balanceOf[_projectId] + msg.value;
    emit AddToBalance(_projectId, msg.value, msg.sender);
  }

  /**
    @notice 
    Allows certain projects to migrate to have funds rescued.

    @param _projectId The ID of the project to allow rescuing.
  */
  function toggleRescue(uint256 _projectId) external override onlyOwner {
    rescueAllowed[_projectId] = !rescueAllowed[_projectId];

    emit ToggleRescue(_projectId, rescueAllowed[_projectId], msg.sender);
  }

  /**
    @notice 
    NO-OP
  */
  function migrate(uint256, ITerminal) external pure override {
    require(false, 'cant migrate');
  }

  /**
    @notice 
    NO-OP
  */
  function allowMigration(ITerminal) external pure override {
    require(false, 'cant allow migration');
  }

  /**
    @notice 
    NO-OP
  */
  function pay(
    uint256,
    address,
    string calldata,
    bool
  ) external payable override returns (uint256) {
    require(false, 'cant pay');
    return 0;
  }
}
