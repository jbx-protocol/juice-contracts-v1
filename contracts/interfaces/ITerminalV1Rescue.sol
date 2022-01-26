// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import '@openzeppelin/contracts/token/ERC721/IERC721.sol';

import './ITicketBooth.sol';
import './IFundingCycles.sol';
import './IYielder.sol';
import './IProjects.sol';
import './IModStore.sol';
import './ITerminal.sol';
import './IOperatorStore.sol';
import './ITreasuryExtension.sol';

struct FundingCycleMetadata2 {
  uint256 reservedRate;
  uint256 bondingCurveRate;
  uint256 reconfigurationBondingCurveRate;
  bool payIsPaused;
  bool ticketPrintingIsAllowed;
  ITreasuryExtension treasuryExtension;
}

interface ITerminalV1Rescue {
  event AddToBalance(uint256 indexed projectId, uint256 value, address caller);
  event PrintTickets(
    uint256 indexed projectId,
    address indexed beneficiary,
    uint256 amount,
    string memo,
    address caller
  );

  event Rescued(
    uint256 projectId,
    address beneficiary,
    uint256 originalBalance,
    uint256 amount,
    address caller
  );

  event ToggleRescue(uint256 projectId, bool newValue, address caller);

  function projects() external view returns (IProjects);

  function fundingCycles() external view returns (IFundingCycles);

  function ticketBooth() external view returns (ITicketBooth);

  function rescueAllowed(uint256 _projectId) external view returns (bool);

  function balanceOf(uint256 _projectId) external view returns (uint256);

  function rescue(
    uint256 _projectId,
    address payable _beneficiary,
    uint256 _amount
  ) external;

  function toggleRescue(uint256 _projectId) external;

  function printTickets(
    uint256 _projectId,
    uint256 _amount,
    address _beneficiary,
    string memory _memo,
    bool _preferUnstakedTickets
  ) external;
}
