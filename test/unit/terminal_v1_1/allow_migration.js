import { expect } from 'chai';
import { constants } from 'ethers';

const tests = {
  success: [
    {
      description: 'set a new terminal',
      fn: async ({ multisig, deployMockLocalContractFn, mockContracts }) => ({
        caller: multisig,
        terminal: (
          await deployMockLocalContractFn('TerminalV1', [
            mockContracts.projects.address,
            mockContracts.fundingCycles.address,
            mockContracts.ticketBooth.address,
            mockContracts.operatorStore.address,
            mockContracts.modStore.address,
            mockContracts.prices.address,
            mockContracts.terminalDirectory.address,
            multisig.address,
          ])
        ).address,
      }),
    },
  ],
  failure: [
    {
      description: 'unauthorized',
      fn: ({ deployer, targetContract }) => ({
        caller: deployer,
        terminal: targetContract.address,
        revert: 'Ownable: caller is not the owner',
      }),
    },
    {
      description: 'zero address',
      fn: ({ multisig }) => ({
        caller: multisig,
        terminal: constants.AddressZero,
        revert: 'TV1_1::allowMigration: ZERO_ADDRESS',
      }),
    },
    {
      description: 'same as current',
      fn: ({ multisig, targetContract }) => ({
        caller: multisig,
        terminal: targetContract.address,
        revert: 'TV1_1::allowMigration: NO_OP',
      }),
    },
  ],
};

export default function () {
  describe('Success cases', function () {
    tests.success.forEach(function (successTest) {
      it(successTest.description, async function () {
        const { caller, terminal } = await successTest.fn(this);

        // Execute the transaction.
        const tx = await this.targetContract.connect(caller).allowMigration(terminal);

        // Expect an event to have been emitted.
        await expect(tx).to.emit(this.targetContract, 'AllowMigration').withArgs(terminal);

        // Get the stored allowed value.
        const storedAllowedValue = await this.targetContract.migrationIsAllowed(terminal);

        // Expect the stored value to equal whats expected.
        expect(storedAllowedValue).to.equal(true);
      });
    });
  });
  describe('Failure cases', function () {
    tests.failure.forEach(function (failureTest) {
      it(failureTest.description, async function () {
        const { caller, terminal, revert } = failureTest.fn(this);

        await expect(
          this.targetContract.connect(caller).allowMigration(terminal),
        ).to.be.revertedWith(revert);
      });
    });
  });
}
