/** 
  Projects can be configured to pause payments.
*/

import { BigNumber } from "@ethersproject/bignumber";

// The currency will be 0, which corresponds to ETH, preventing the need for currency price conversion.
const currency = 0;

export default [
  {
    description: 'Deploy a project for the owner',
    fn: async ({
      constants,
      contracts,
      BigNumber,
      executeFn,
      randomBigNumberFn,
      randomBytesFn,
      randomSignerFn,
      incrementProjectIdFn,
      incrementFundingCycleIdFn,
    }) => {
      const expectedProjectId = incrementProjectIdFn();
      // Burn the unused funding cycle ID id.
      incrementFundingCycleIdFn();

      // The owner of the project that will migrate.
      const owner = randomSignerFn();

      // Set duration to 0 so that the project can be reconfigured without delay.
      const duration = BigNumber.from(0);

      await executeFn({
        caller: randomSignerFn(),
        contract: contracts.terminalV1_1,
        fn: 'deploy',
        args: [
          owner.address,
          randomBytesFn({
            // Make sure its unique by prepending the id.
            prepend: expectedProjectId.toString(),
          }),
          '',
          {
            target: randomBigNumberFn(),
            currency,
            duration,
            cycleLimit: randomBigNumberFn({
              max: constants.MaxCycleLimit,
            }),
            discountRate: randomBigNumberFn({ max: constants.MaxPercent }),
            ballot: constants.AddressZero,
          },
          {
            reservedRate: BigNumber.from(200),
            bondingCurveRate: BigNumber.from(200),
            reconfigurationBondingCurveRate: BigNumber.from(200),
            payIsPaused: true,
            ticketPrintingIsAllowed: false,
            treasuryExtension: constants.AddressZero
          },
          [],
          [],
        ],
      });

      return {
        owner,
        expectedProjectId
      };
    },
  },
  {
    description: 'Making a payment to a paused project shouldnt work',
    fn: async ({
      executeFn,
      randomStringFn,
      randomSignerFn,
      randomBoolFn,
      contracts,
      getBalanceFn,
      randomBigNumberFn,
      local: { expectedProjectId },
    }) => {
      // An account that will be used to make payments.
      const payer = randomSignerFn();

      await executeFn({
        caller: payer,
        contract: contracts.terminalV1_1,
        fn: 'pay',
        args: [expectedProjectId, randomSignerFn().address, randomStringFn(), randomBoolFn()],
        value: randomBigNumberFn({
          min: BigNumber.from(1000),
          max: (await getBalanceFn(payer.address)).div(100),
        }),
        revert: "TV1_1::pay: PAUSED"
      })
    }
  },
  {
    description: 'Reconfigure to unpause payments',
    fn: async ({
      constants,
      contracts,
      BigNumber,
      executeFn,
      randomBigNumberFn,
      incrementFundingCycleIdFn,
      local: { owner, expectedProjectId },
    }) => {

      // Burn the unused funding cycle ID id.
      incrementFundingCycleIdFn();

      await executeFn({
        caller: owner,
        contract: contracts.terminalV1_1,
        fn: 'configure',
        args: [
          expectedProjectId,
          {
            target: randomBigNumberFn(),
            currency,
            duration: BigNumber.from(0),
            cycleLimit: randomBigNumberFn({
              max: constants.MaxCycleLimit,
            }),
            discountRate: randomBigNumberFn({ max: constants.MaxPercent }),
            ballot: constants.AddressZero,
          },
          {
            reservedRate: BigNumber.from(200),
            bondingCurveRate: BigNumber.from(200),
            reconfigurationBondingCurveRate: BigNumber.from(200),
            payIsPaused: false,
            ticketPrintingIsAllowed: false,
            treasuryExtension: constants.AddressZero
          },
          [],
          [],
        ],
      });
    },
  },
  {
    description: 'Making a payment to a unpaused project should work',
    fn: async ({
      executeFn,
      randomStringFn,
      randomSignerFn,
      randomBoolFn,
      contracts,
      randomBigNumberFn,
      getBalanceFn,
      local: { expectedProjectId },
    }) => {

      // An account that will be used to make payments.
      const payer = randomSignerFn();
      await executeFn({
        caller: payer,
        contract: contracts.terminalV1_1,
        fn: 'pay',
        args: [expectedProjectId, randomSignerFn().address, randomStringFn(), randomBoolFn()],
        value: randomBigNumberFn({
          min: BigNumber.from(1000),
          max: (await getBalanceFn(payer.address)).div(100),
        }),
      })
    }
  },
  {
    description: 'Making a payment to an project without paused payments should work',
    fn: async ({
      executeFn,
      randomStringFn,
      randomSignerFn,
      randomBoolFn,
      contracts,
      getBalanceFn,
      randomBigNumberFn,
      local: { expectedProjectId },
    }) => {
      const payer = randomSignerFn();
      await executeFn({
        caller: payer,
        contract: contracts.terminalV1_1,
        fn: 'pay',
        args: [expectedProjectId, randomSignerFn().address, randomStringFn(), randomBoolFn()],
        value: randomBigNumberFn({
          min: BigNumber.from(1000),
          max: (await getBalanceFn(payer.address)).div(100),
        })
      });
    }
  },
];
