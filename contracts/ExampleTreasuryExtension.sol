// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import './interfaces/ITerminalV1.sol';
import './interfaces/ITreasuryExtension.sol';

contract ExampleTreasuryExtension is ITreasuryExtension {
  function ETHValue(uint256) external pure override returns (uint256) {
    return 1E18;
  }
}
