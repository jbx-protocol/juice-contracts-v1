import { constants } from 'ethers';
import { ethers } from 'hardhat';
import jbToken from '../../../../artifacts/contracts/Tickets.sol/Tickets.json';
/** 
  Burns tokens from the zero address.
*/

// The currency will be 0, which corresponds to ETH, preventing the need for currency price conversion.
const currency = 0;

export default [
  {
    description: 'Deploy a project for the owner',
    fn: async ({
      executeFn,
      randomBigNumberFn,
      randomSignerFn,
      randomStringFn,
      BigNumber,
      getBalanceFn,
      randomBytesFn,
      incrementProjectIdFn,
      incrementFundingCycleIdFn,
      constants,
      contracts,
    }) => {
      const expectedProjectId = incrementProjectIdFn();

      // Burn the unused funding cycle ID id.
      incrementFundingCycleIdFn();

      // The owner of the project that will migrate.
      const owner = randomSignerFn();

      // An account that will be used to make payments.
      const payer = randomSignerFn();

      // Two payments will be made. Cant pay entire balance because some is needed for gas.
      // So, arbitrarily find a number less than a third so that all payments can be made successfully.
      const paymentValue1 = randomBigNumberFn({
        min: BigNumber.from(1),
        max: (await getBalanceFn(payer.address)).div(100),
      });
      const paymentValue2 = randomBigNumberFn({
        min: BigNumber.from(1),
        max: (await getBalanceFn(payer.address)).div(100),
      });

      // The project's funding cycle target will at most be a fourth of the payment value. Leaving plenty of overflow.
      const target = randomBigNumberFn({
        max: paymentValue1.add(paymentValue2).div(4),
      });

      // Set a random percentage of tickets to reserve for the project owner.
      const reservedRate = randomBigNumberFn({ max: constants.MaxPercent });

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
          randomStringFn(),
          {
            target,
            currency,
            duration: randomBigNumberFn({
              min: BigNumber.from(1),
              max: constants.MaxUint16,
            }),
            cycleLimit: randomBigNumberFn({
              max: constants.MaxCycleLimit,
            }),
            discountRate: randomBigNumberFn({ max: constants.MaxPercent }),
            ballot: constants.AddressZero,
          },
          {
            reservedRate,
            bondingCurveRate: randomBigNumberFn({
              max: constants.MaxPercent,
            }),
            reconfigurationBondingCurveRate: randomBigNumberFn({
              max: constants.MaxPercent,
            }),
            payIsPaused: false,
            ticketPrintingIsAllowed: false,
            treasuryExtension: constants.AddressZero
          },
          [],
          [],
        ],
      });
      return {
        expectedProjectId,
        owner,
        payer,
        paymentValue1,
        paymentValue2,
        reservedRate,
      };
    },
  },
  {
    description: 'Issue tickets',
    fn: ({ executeFn, contracts, randomStringFn, local: { owner, expectedProjectId } }) =>
      executeFn({
        caller: owner,
        contract: contracts.ticketBooth,
        fn: 'issue',
        args: [
          expectedProjectId,
          randomStringFn({ canBeEmpty: false }),
          randomStringFn({ canBeEmpty: false }),
        ],
      }),
  },
  {
    description:
      'Make a payment to the project without first issueing tickets should print staked tickets',
    fn: async ({
      randomSignerFn,
      executeFn,
      contracts,
      randomStringFn,
      randomBoolFn,
      local: { expectedProjectId, payer, paymentValue1 },
    }) => {
      // An account that will be distributed tickets in the first payment.
      const ticketBeneficiary = randomSignerFn();

      await executeFn({
        caller: payer,
        contract: contracts.terminalV1_1,
        fn: 'pay',
        args: [expectedProjectId, ticketBeneficiary.address, randomStringFn(), true],
        value: paymentValue1,
      });

      return { ticketBeneficiary };
    },
  },
  {
    description: 'The ticket beneficiary should have tickets',
    fn: async ({
      checkFn,
      constants,
      randomSignerFn,
      contracts,
      local: { paymentValue1, reservedRate, ticketBeneficiary, expectedProjectId },
    }) => {
      // The amount of tickets that will be expected to be staked after the first payment.
      const expectedStakedBalance = paymentValue1
        .mul(constants.InitialWeightMultiplier)
        .mul(constants.MaxPercent.sub(reservedRate))
        .div(constants.MaxPercent);

      await checkFn({
        caller: randomSignerFn(),
        contract: contracts.ticketBooth,
        fn: 'balanceOf',
        args: [ticketBeneficiary.address, expectedProjectId],
        expect: expectedStakedBalance,
        // Allow some wiggle room due to possible division precision errors.
        plusMinus: {
          amount: 10,
        },
      });

      await checkFn({
        caller: randomSignerFn(),
        contract: contracts.ticketBooth,
        fn: 'totalSupplyOf',
        args: [expectedProjectId],
        expect: expectedStakedBalance,
        // Allow some wiggle room due to possible division precision errors.
        plusMinus: {
          amount: 10,
        },
      });

      return { expectedStakedBalance };
    },
  },
  {
    description: "Burning tokens from zero doesn't do anything if there's no balance",
    fn: ({
      randomSignerFn,
      contracts,
      executeFn,
      local: { expectedProjectId },
    }) =>
      executeFn({
        caller: randomSignerFn(),
        contract: contracts.terminalV1_1,
        fn: 'burnFromDeadAddress',
        args: [expectedProjectId],
        revert: "0x00 NOTHING_TO_BURN"
      }),
  },
  {
    description: 'The ticket beneficiary should still have tickets',
    fn: async ({
      checkFn,
      constants,
      randomSignerFn,
      contracts,
      local: { paymentValue1, reservedRate, ticketBeneficiary, expectedProjectId },
    }) => {
      // The amount of tickets that will be expected to be staked after the first payment.
      const expectedStakedBalance = paymentValue1
        .mul(constants.InitialWeightMultiplier)
        .mul(constants.MaxPercent.sub(reservedRate))
        .div(constants.MaxPercent);

      await checkFn({
        caller: randomSignerFn(),
        contract: contracts.ticketBooth,
        fn: 'balanceOf',
        args: [ticketBeneficiary.address, expectedProjectId],
        expect: expectedStakedBalance,
        // Allow some wiggle room due to possible division precision errors.
        plusMinus: {
          amount: 10,
        },
      });

      await checkFn({
        caller: randomSignerFn(),
        contract: contracts.ticketBooth,
        fn: 'totalSupplyOf',
        args: [expectedProjectId],
        expect: expectedStakedBalance,
        // Allow some wiggle room due to possible division precision errors.
        plusMinus: {
          amount: 10,
        },
      });
    },
  },
  {
    description: "The balance of the token should be the same",
    fn: async ({
      checkFn,
      randomSignerFn,
      contracts,
      local: { ticketBeneficiary, expectedProjectId, expectedStakedBalance },
    }) => {
      const ticketContract = new ethers.Contract(await contracts.ticketBooth.ticketsOf(expectedProjectId), jbToken.abi);
      await checkFn({
        caller: randomSignerFn(),
        contract: ticketContract,
        fn: 'balanceOf',
        args: [ticketBeneficiary.address],
        expect: expectedStakedBalance,
        // Allow some wiggle room due to possible division precision errors.
        plusMinus: {
          amount: 10,
        },
      });

      return { ticketContract }
    }
  },
  {
    description: "Transfer to the zero address",
    fn: async ({
      executeFn,
      local: { ticketBeneficiary, ticketContract, expectedStakedBalance },
    }) => {
      await executeFn({
        caller: ticketBeneficiary,
        contract: ticketContract,
        fn: 'increaseAllowance',
        args: [ticketBeneficiary.address, expectedStakedBalance]
      });

      await executeFn({
        caller: ticketBeneficiary,
        contract: ticketContract,
        fn: 'transferFrom',
        args: [ticketBeneficiary.address, "0x000000000000000000000000000000000000dEaD", expectedStakedBalance]
      });
    }
  },
  {
    description: 'The ticket beneficiary should still have tickets',
    fn: async ({
      checkFn,
      constants,
      randomSignerFn,
      contracts,
      BigNumber,
      local: { ticketBeneficiary, expectedProjectId, expectedStakedBalance },
    }) => {
      await checkFn({
        caller: randomSignerFn(),
        contract: contracts.ticketBooth,
        fn: 'balanceOf',
        args: [ticketBeneficiary.address, expectedProjectId],
        expect: BigNumber.from(0)
      });

      await checkFn({
        caller: randomSignerFn(),
        contract: contracts.ticketBooth,
        fn: 'totalSupplyOf',
        args: [expectedProjectId],
        expect: expectedStakedBalance,
        // Allow some wiggle room due to possible division precision errors.
        plusMinus: {
          amount: 10,
        },
      });
    },
  },
  {
    description: "Burn from the dead address",
    fn: ({
      randomSignerFn,
      contracts,
      executeFn,
      local: { expectedProjectId, expectedStakedBalance },
    }) =>
      executeFn({
        caller: randomSignerFn(),
        contract: contracts.terminalV1_1,
        fn: 'burnFromDeadAddress',
        args: [expectedProjectId],
        revert: expectedStakedBalance == 0 && "0x00 NOTHING_TO_BURN"
      }),
  },
  {
    description: 'There should no longer be tickets',
    fn: async ({
      checkFn,
      randomSignerFn,
      contracts,
      BigNumber,
      local: { ticketBeneficiary, expectedProjectId },
    }) => {
      await checkFn({
        caller: randomSignerFn(),
        contract: contracts.ticketBooth,
        fn: 'balanceOf',
        args: [ticketBeneficiary.address, expectedProjectId],
        expect: BigNumber.from(0)
      });

      await checkFn({
        caller: randomSignerFn(),
        contract: contracts.ticketBooth,
        fn: 'totalSupplyOf',
        args: [expectedProjectId],
        expect: BigNumber.from(0)
      });
    },
  },
];
