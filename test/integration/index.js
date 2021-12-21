import { BigNumber, constants, utils } from 'ethers';
import {
  projects as _projects_v1,
  challengeHandle as _challengeHandle_v1,
  deploy as _deploy_v1,
  ticketLockingAndTransfers as _ticketLockingAndTransfers_v1,
  redeem as _redeem_v1,
  printReservedTickets as _printReservedTickets_v1,
  printPreminedTickets as _printPreminedTickets_v1,
  issueTickets as _issueTickets_v1,
  tap as _tap_v1,
  takeFee as _takeFee_v1,
  reconfigure as _reconfigure_v1,
  limit as _limit_v1,
  zeroDuration as _zeroDuration_v1,
  nonRecurring as _nonRecurring_v1,
  approvedBallot as _approvedBallot_v1,
  failedBallot as _failedBallot_v1,
  iteratedFailedBallot as _iteratedFailedBallot_v1,
  migrate as _migrate_v1,
  operatorPermissions as _operatorPermissions_v1,
  setPayoutMods as _setPayoutMods_v1,
  setTicketMods as _setTicketMods_v1,
  governance as _governance_v1,
  setFee as _setFee_v1,
  currencyConversion as _currencyConversion_v1,
  transferProjectOwnership as _transferProjectOwnership_v1,
  directPaymentAddresses as _directPaymentAddresses_v1,
  setTerminal as _setTerminal_v1,
  proxyPaymentAddresses as _proxyPaymentAddresses_v1,
} from './workflows/v1';

import {
  projects as _projects_v1_1,
  challengeHandle as _challengeHandle_v1_1,
  deploy as _deploy_v1_1,
  ticketLockingAndTransfers as _ticketLockingAndTransfers_v1_1,
  redeem as _redeem_v1_1,
  redeemWithTreasuryExtension as _redeem_with_treasury_extension_v1_1,
  printReservedTickets as _printReservedTickets_v1_1,
  printTickets as _printTickets_v1_1,
  issueTickets as _issueTickets_v1_1,
  tap as _tap_v1_1,
  takeFee as _takeFee_v1_1,
  reconfigure as _reconfigure_v1_1,
  limit as _limit_v1_1,
  zeroDuration as _zeroDuration_v1_1,
  nonRecurring as _nonRecurring_v1_1,
  approvedBallot as _approvedBallot_v1_1,
  failedBallot as _failedBallot_v1_1,
  iteratedFailedBallot as _iteratedFailedBallot_v1_1,
  migrate as _migrate_v1_1,
  operatorPermissions as _operatorPermissions_v1_1,
  setPayoutMods as _setPayoutMods_v1_1,
  setTicketMods as _setTicketMods_v1_1,
  governance as _governance_v1_1,
  setFee as _setFee_v1_1,
  currencyConversion as _currencyConversion_v1_1,
  transferProjectOwnership as _transferProjectOwnership_v1_1,
  directPaymentAddresses as _directPaymentAddresses_v1_1,
  setTerminal as _setTerminal_v1_1,
  proxyPaymentAddresses as _proxyPaymentAddresses_v1_1,
  pausePayments as _pausePayments_v1_1,
  burnFromDeadAddress as _burnFromDeadAddress_v1_1
} from './workflows/v1_1';

import {
  migrate as _migrate_v1_to_v1_1,
} from './workflows/v1_to_v1_1_migration';

// The first project ID is used for governance.
let projectId = BigNumber.from(1);
// The first funding cycle ID is used for governance.
let fundingCycleId = BigNumber.from(1);

let currency = BigNumber.from(0);

const run = function (ops) {
  return function () {
    // eslint-disable-next-line no-restricted-syntax
    for (const op of ops) {
      it(op.description, async function () {
        this.local = {
          ...this.local,
          // eslint-disable-next-line no-await-in-loop
          ...(await op.fn(this)),
        };
      });
    }
  };
};

export default function () {
  // Deploy all contracts.
  before(async function () {
    const operatorStore = await this.deployContractFn('OperatorStore');
    const projects = await this.deployContractFn('Projects', [operatorStore.address]);
    const prices = await this.deployContractFn('Prices');
    const terminalDirectory = await this.deployContractFn('TerminalDirectory', [
      projects.address,
      operatorStore.address,
    ]);
    const fundingCycles = await this.deployContractFn('FundingCycles', [terminalDirectory.address]);

    const ticketBooth = await this.deployContractFn('TicketBooth', [
      projects.address,
      operatorStore.address,
      terminalDirectory.address,
    ]);

    const modStore = await this.deployContractFn('ModStore', [
      projects.address,
      operatorStore.address,
      terminalDirectory.address,
    ]);

    const governance = await this.deployContractFn('Governance', [1, terminalDirectory.address]);
    const multisig = this.addrs[11];
    this.multisig = multisig;

    const terminalV1 = await this.deployContractFn('TerminalV1', [
      projects.address,
      fundingCycles.address,
      ticketBooth.address,
      operatorStore.address,
      modStore.address,
      prices.address,
      terminalDirectory.address,
      governance.address,
    ]);

    const terminalV1_1 = await this.deployContractFn('TerminalV1_1', [
      projects.address,
      fundingCycles.address,
      ticketBooth.address,
      operatorStore.address,
      modStore.address,
      prices.address,
      terminalDirectory.address,
      multisig.address,
    ]);

    const proxyPaymentAddressManager = await this.deployContractFn('ProxyPaymentAddressManager', [
      terminalDirectory.address,
      ticketBooth.address,
    ]);

    // Set governance as the prices contract owner.
    await prices.transferOwnership(governance.address);
    /** 
      Deploy the governance contract's project. It will have an ID of 1.
    */
    await this.executeFn({
      caller: this.deployer,
      contract: terminalV1,
      fn: 'deploy',
      args: [
        this.deployer.address,
        utils.formatBytes32String('juicebox'),
        '',
        {
          target: 0,
          currency: 0,
          // Duration must be zero so that the same cycle lasts throughout the tests.
          duration: 0,
          cycleLimit: BigNumber.from(0),
          discountRate: BigNumber.from(0),
          ballot: constants.AddressZero,
        },
        {
          reservedRate: 0,
          bondingCurveRate: 0,
          reconfigurationBondingCurveRate: 0,
        },
        [],
        [],
      ],
    });

    // Bind the contracts to give the wokflows access to them.
    this.contracts = {
      governance,
      terminalDirectory,
      prices,
      operatorStore,
      ticketBooth,
      fundingCycles,
      projects,
      modStore,
      terminalV1,
      terminalV1_1,
      proxyPaymentAddressManager,
    };

    // The governance project should have an ID of 1.
    this.constants.GovernanceProjectId = 1;

    // Bind the standard weight multiplier to the constants.
    // This is used to determine how many tickets get printed per value contributed during a first funding cycle.
    this.constants.InitialWeightMultiplier = (await fundingCycles.BASE_WEIGHT()).div(
      BigNumber.from(10).pow(18),
    );

    this.constants.MaxCycleLimit = await fundingCycles.MAX_CYCLE_LIMIT();

    this.constants.GovernanceProjectId = projectId;
    this.constants.GovenanceOwner = this.deployer.address;

    // All perecents are out of 200, except for mods.
    this.constants.MaxPercent = BigNumber.from(200);

    // Mod percents are out of 10000.
    this.constants.MaxModPercent = BigNumber.from(10000);

    // Discount rate percents are out of 201. sending 201 creates a non recurring funding cycle.
    this.constants.MaxDiscountRate = BigNumber.from(201);

    // The denominator for discount rates is 1000, meaning only 80% - 100% are accessible.
    this.constants.DiscountRatePercentDenominator = BigNumber.from(1000);

    this.incrementProjectIdFn = () => {
      projectId = projectId.add(1);
      return projectId;
    };
    this.incrementFundingCycleIdFn = () => {
      fundingCycleId = fundingCycleId.add(1);
      return fundingCycleId;
    };

    this.incrementCurrencyFn = () => {
      currency = currency.add(1);
      return currency;
    };

    this.bondingCurveFn = ({ rate, count, total, overflow }) => {
      if (count.eq(total)) return overflow;
      if (rate.eq(this.constants.MaxPercent)) return overflow.mul(count).div(total);
      if (rate.eq(0)) return overflow.mul(count).div(total).mul(count).div(total);
      return overflow
        .mul(count)
        .div(total)
        .mul(rate.add(count.mul(this.constants.MaxPercent.sub(rate)).div(total)))
        .div(this.constants.MaxPercent);
    };
  });


  let iterations = process.env.INTEGRATION_TEST_COUNT || 10;
  for (let i = 0; i < iterations; i += 1) {
    // V1
    describe(
      'Projects can be created, have their URIs changed, transfer/claim handles, and be attached to funding cycles',
      run(_projects_v1),
    );
    describe(
      "Projects can have their handle's challenged, and claimed if not renewed in time",
      run(_challengeHandle_v1),
    );
    describe('Deployment of a project with funding cycles and mods included', run(_deploy_v1));
    describe(
      'Ticket holders can lock their tickets, which prevents them from being redeemed, unstaked, or transfered',
      run(_ticketLockingAndTransfers_v1),
    );
    describe('Redeem tickets for overflow', run(_redeem_v1));
    describe('Prints reserved tickets', run(_printReservedTickets_v1));
    describe(
      'Projects can print premined tickets before a payment has been made to it',
      run(_printPreminedTickets_v1),
    );
    describe('Issues tickets and honors preference', run(_issueTickets_v1));
    describe('Tap funds up to the configured target', run(_tap_v1));
    describe(
      "A fee should be taken into governance's project when a project taps funds",
      run(_takeFee_v1),
    );
    describe('Reconfigures a project', run(_reconfigure_v1));
    describe('A funding cycle configuration can have a limit', run(_limit_v1));
    describe('A funding cycle configuration can have a duration of 0', run(_zeroDuration_v1));
    describe('A funding cycle configuration can be non recurring', run(_nonRecurring_v1));
    describe('Ballot must be approved for reconfiguration to become active', run(_approvedBallot_v1));
    describe('Reconfiguration that fails a ballot should be ignored', run(_failedBallot_v1));
    describe(
      'Reconfiguration proposed after a failed configuration should obide by the ballot duration',
      run(_iteratedFailedBallot_v1),
    );
    describe('Migrate from one Terminal to another', run(_migrate_v1));
    describe('Operators can be given permissions', run(_operatorPermissions_v1));
    describe('Set and update payout mods, honoring locked status', run(_setPayoutMods_v1));
    describe('Set and update ticket mods, honoring locked status', run(_setTicketMods_v1));
    describe('A new governance can be appointed and accepted', run(_governance_v1));
    describe('Governance can set a new fee for future configurations', run(_setFee_v1));
    describe('Currencies rates are converted to/from correctly', run(_currencyConversion_v1));
    describe('Transfer ownership over a project', run(_transferProjectOwnership_v1));
    describe(
      'Direct payment addresses can be deployed to add an fundable address to a project',
      run(_directPaymentAddresses_v1),
    );
    describe(
      'A project can be created without a payment terminal, and can set one after',
      run(_setTerminal_v1),
    );
    describe(
      'Proxy payment addresses can be deployed to add an fundable address to a project',
      run(_proxyPaymentAddresses_v1),
    );

    // V1.1
    describe(
      'Projects can be created, have their URIs changed, transfer/claim handles, and be attached to funding cycles',
      run(_projects_v1_1),
    );
    describe(
      "Projects can have their handle's challenged, and claimed if not renewed in time",
      run(_challengeHandle_v1_1),
    );
    describe('Deployment of a project with funding cycles and mods included', run(_deploy_v1_1));
    describe(
      'Ticket holders can lock their tickets, which prevents them from being redeemed, unstaked, or transfered',
      run(_ticketLockingAndTransfers_v1_1),
    );
    describe('Redeem tickets for overflow', run(_redeem_v1_1));
    describe('Redeem tickets for overflow with a treasury extension attached', run(_redeem_with_treasury_extension_v1_1));
    describe('Prints reserved tickets', run(_printReservedTickets_v1_1));
    describe(
      'Projects can print tickets',
      run(_printTickets_v1_1),
    );
    describe('Issues tickets and honors preference', run(_issueTickets_v1_1));
    describe('Tap funds up to the configured target', run(_tap_v1_1));
    describe(
      "A fee should be taken into governance's project when a project taps funds",
      run(_takeFee_v1_1),
    );
    describe('Reconfigures a project', run(_reconfigure_v1_1));
    describe('A funding cycle configuration can have a limit', run(_limit_v1_1));
    describe('A funding cycle configuration can have a duration of 0', run(_zeroDuration_v1_1));
    describe('A funding cycle configuration can be non recurring', run(_nonRecurring_v1_1));
    describe('Ballot must be approved for reconfiguration to become active', run(_approvedBallot_v1_1));
    describe('Reconfiguration that fails a ballot should be ignored', run(_failedBallot_v1_1));
    describe(
      'Reconfiguration proposed after a failed configuration should obide by the ballot duration',
      run(_iteratedFailedBallot_v1_1),
    );
    describe('Migrate from one Terminal to another', run(_migrate_v1_1));
    describe('Operators can be given permissions', run(_operatorPermissions_v1_1));
    describe('Set and update payout mods, honoring locked status', run(_setPayoutMods_v1_1));
    describe('Set and update ticket mods, honoring locked status', run(_setTicketMods_v1_1));
    describe('A new address can be transfered ownership', run(_governance_v1_1));
    describe('Governance can set a new fee for future configurations', run(_setFee_v1_1));
    describe('Currencies rates are converted to/from correctly', run(_currencyConversion_v1_1));
    describe('Transfer ownership over a project', run(_transferProjectOwnership_v1_1));
    describe(
      'Direct payment addresses can be deployed to add an fundable address to a project',
      run(_directPaymentAddresses_v1_1),
    );
    describe(
      'A project can be created without a payment terminal, and can set one after',
      run(_setTerminal_v1_1),
    );
    describe(
      'Proxy payment addresses can be deployed to add an fundable address to a project',
      run(_proxyPaymentAddresses_v1_1),
    );
    describe(
      'Projects can pause payments',
      run(_pausePayments_v1_1),
    );

    describe('Anyone can burn tokens belonging to the dead address', run(_burnFromDeadAddress_v1_1));

    // V1 => V1.1 migration
    describe('Migrate from V1 Terminal to a V1_1 terminal', run(_migrate_v1_to_v1_1));

  }
}