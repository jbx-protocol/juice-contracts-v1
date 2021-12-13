import addToBalance from './add_to_balance';
import allowMigration from './allow_migration';
import configure from './configure';
import deploy from './deploy';
import migrate from './migrate';
import pay from './pay';
import printTickets from './print_tickets';
import printReservedTickets from './print_reserved_tickets';
import redeem from './redeem';
import setFee from './set_fee';
import tap from './tap';

const contractName = 'TerminalV1_1';

export default function () {
  // Before the tests, deploy mocked dependencies and the contract.
  before(async function () {
    // Deploy mock dependency contracts.
    const operatorStore = await this.deployMockLocalContractFn('OperatorStore');
    const projects = await this.deployMockLocalContractFn('Projects', [operatorStore.address]);
    const prices = await this.deployMockLocalContractFn('Prices');
    const terminalDirectory = await this.deployMockLocalContractFn('TerminalDirectory', [
      projects.address,
      operatorStore.address,
    ]);
    const fundingCycles = await this.deployMockLocalContractFn('FundingCycles', [
      terminalDirectory.address,
    ]);
    const ticketBooth = await this.deployMockLocalContractFn('TicketBooth', [
      projects.address,
      operatorStore.address,
      terminalDirectory.address,
    ]);
    const modStore = await this.deployMockLocalContractFn('ModStore', [
      projects.address,
      operatorStore.address,
    ]);

    const multisig = this.addrs[9];

    this.multisig = multisig;

    this.mockContracts = {
      operatorStore,
      projects,
      prices,
      terminalDirectory,
      fundingCycles,
      ticketBooth,
      modStore
    };

    this.targetContract = await this.deployContractFn(contractName, [
      projects.address,
      fundingCycles.address,
      ticketBooth.address,
      operatorStore.address,
      modStore.address,
      prices.address,
      terminalDirectory.address,
      multisig.address,
    ]);

    this.contractName = contractName;
  });

  // Test each function.
  describe('setFee(...)', setFee);
  describe('allowMigration(...)', allowMigration);
  describe('addToBalance(...)', addToBalance);
  describe('migrate(...)', migrate);
  describe('deploy(...)', deploy);
  describe('configure(...)', configure);
  describe('pay(...)', pay);
  describe('printTickets(...)', printTickets);
  describe('redeem(...)', redeem);
  describe('tap(...)', tap);
  describe('printReservedTickets(...)', printReservedTickets);
}
