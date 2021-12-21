import hardhat from 'hardhat';
const {
  ethers: { BigNumber },
} = hardhat;

import { expect } from 'chai';

const tests = {
  success: [
    {
      description: 'set to 5%',
      fn: ({ multisig }) => ({
        caller: multisig,
        fee: BigNumber.from(10),
      }),
    },
    {
      description: 'set to 0%',
      fn: ({ multisig }) => ({
        caller: multisig,
        fee: BigNumber.from(0),
      }),
    },
  ],
  failure: [
    {
      description: 'unauthorized',
      fn: ({ deployer }) => ({
        caller: deployer,
        fee: BigNumber.from(200),
        revert: 'Ownable: caller is not the owner',
      }),
    },
    {
      description: 'over 5%',
      fn: ({ multisig }) => ({
        caller: multisig,
        fee: BigNumber.from(11),
        revert: 'TV1_1::setFee: BAD_FEE',
      }),
    },
  ],
};

export default function () {
  describe('Success cases', function () {
    tests.success.forEach(function (successTest) {
      it(successTest.description, async function () {
        const { caller, fee } = successTest.fn(this);

        // Execute the transaction.
        const tx = await this.targetContract.connect(caller).setFee(fee);

        // Expect an event to have been emitted.
        await expect(tx).to.emit(this.targetContract, 'SetFee').withArgs(fee);

        // Get the stored fee value.
        const storedFee = await this.targetContract.fee();

        // Expect the stored value to equal whats expected.
        expect(storedFee).to.equal(fee);
      });
    });
  });
  describe('Failure cases', function () {
    tests.failure.forEach(function (failureTest) {
      it(failureTest.description, async function () {
        const { caller, fee, revert } = failureTest.fn(this);

        await expect(this.targetContract.connect(caller).setFee(fee)).to.be.revertedWith(revert);
      });
    });
  });
}
