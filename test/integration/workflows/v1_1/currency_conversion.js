/** 
  Funding cycles can use currencies other than ETH that Governance has added price feeds for.

  Funds are always paid in ETH, but a funding cycle target can be denominated in another currencency.
  This means that the the amount of ETH that a project can withdraw will change over time as the price
  of ETH changes compared to their funding cycle's denominated currency.

  This test makes sure the conversion rates are honored.
*/
export default [
  {
    description: 'Add the price feed to the prices contract',
    fn: async ({ deployer, contracts, executeFn, deployContractFn, incrementCurrencyFn }) => {
      // An example price feed.
      const priceFeed = await deployContractFn('ExampleETHUSDPriceFeed');
      const [, rate] = await priceFeed.latestRoundData();
      // The amount of decimals the price should be adjusted for.
      const decimals = await priceFeed.decimals();

      // The currency number that will store the price feed. Can't be 0, which is reserve for ETH, or any other currency already set.
      const currency = incrementCurrencyFn();

      await executeFn({
        caller: deployer,
        contract: contracts.governance,
        fn: 'addPriceFeed',
        args: [contracts.prices.address, priceFeed.address, currency],
      });
      return { priceFeed, decimals, rate, currency };
    },
  },
  {
    description: 'Deploy first project',
    fn: async ({
      constants,
      contracts,
      executeFn,
      BigNumber,
      randomBigNumberFn,
      randomBytesFn,
      getBalanceFn,
      randomStringFn,
      randomSignerFn,
      incrementProjectIdFn,
      incrementFundingCycleIdFn,
      local: { rate, decimals, currency },
    }) => {
      const expectedProjectId = incrementProjectIdFn();

      // Burn the unused funding cycle ID id.
      incrementFundingCycleIdFn();

      // The owner of the project with mods.
      const owner = randomSignerFn();

      // An account that will be used to make a payment.
      const payer = randomSignerFn();

      // One payment will be made. Cant pay entire balance because some is needed for gas.
      // So, arbitrarily divide the balance so that all payments can be made successfully.
      const paymentValueInWei = randomBigNumberFn({
        min: BigNumber.from(1),
        max: (await getBalanceFn(payer.address)).div(2),
      });
      // The target must be at most the payment value.
      const targetDenominatedInWei = randomBigNumberFn({
        min: BigNumber.from(1),
        max: paymentValueInWei,
      });

      const targetDenominatedInCurrency = targetDenominatedInWei.mul(
        rate.div(BigNumber.from(10).pow(decimals)),
      );

      // Set to zero to make the test cases cleaner.
      const reservedRate = BigNumber.from(0);

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
            target: targetDenominatedInCurrency,
            currency,
            duration: randomBigNumberFn({
              min: BigNumber.from(1),
              max: constants.MaxUint16,
            }),
            cycleLimit: randomBigNumberFn({ max: constants.MaxCycleLimit }),
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
        paymentValueInWei,
        reservedRate,
        targetDenominatedInWei,
      };
    },
  },
  {
    description: 'Make a payment to the project, denominated in `currency`',
    fn: async ({
      contracts,
      executeFn,
      randomBoolFn,
      randomStringFn,
      randomAddressFn,
      local: { payer, paymentValueInWei, expectedProjectId, premineTicketBeneficiary },
    }) => {
      // An account that will receive tickets for the payment.
      // Exlcude the premine ticket beneficiary to make the test cases cleaner.
      const paymentTicketBeneficiary = randomAddressFn({
        exclude: [premineTicketBeneficiary],
      });
      await executeFn({
        caller: payer,
        contract: contracts.terminalV1_1,
        fn: 'pay',
        args: [expectedProjectId, paymentTicketBeneficiary, randomStringFn(), randomBoolFn()],
        value: paymentValueInWei,
      });
      return { paymentTicketBeneficiary };
    },
  },
  {
    description: 'Check that the beneficiary of the payment got the correct amount of tickets',
    fn: ({
      constants,
      contracts,
      checkFn,
      randomSignerFn,
      local: { paymentValueInWei, paymentTicketBeneficiary, reservedRate, expectedProjectId },
    }) => {
      // The expected number of tickets to receive during the payment.
      const expectedPaymentTickets = paymentValueInWei
        .mul(constants.MaxPercent.sub(reservedRate))
        .div(constants.MaxPercent)
        .mul(constants.InitialWeightMultiplier);
      checkFn({
        caller: randomSignerFn(),
        contract: contracts.ticketBooth,
        fn: 'balanceOf',
        args: [paymentTicketBeneficiary, expectedProjectId],
        expect: expectedPaymentTickets,
      });
    },
  },
  {
    description: 'Check that the overflow amount is being converted correctly',
    fn: ({
      contracts,
      checkFn,
      randomSignerFn,
      local: { paymentValueInWei, targetDenominatedInWei, expectedProjectId },
    }) =>
      checkFn({
        caller: randomSignerFn(),
        contract: contracts.terminalV1_1,
        fn: 'currentOverflowOf',
        args: [expectedProjectId],
        expect: paymentValueInWei.sub(targetDenominatedInWei),
      }),
  },
  {
    description: 'Tap the full amount from the project',
    fn: async ({
      contracts,
      executeFn,
      BigNumber,
      randomBigNumberFn,
      randomSignerFn,
      getBalanceFn,
      local: { targetDenominatedInWei, rate, decimals, currency, expectedProjectId, owner },
    }) => {
      // Tap a portion of the target.
      const amountToTapInWei = targetDenominatedInWei.sub(
        randomBigNumberFn({
          min: BigNumber.from(1),
          max: targetDenominatedInWei,
        }),
      );

      // An amount up to the amount paid can be tapped.
      const amountToTapInCurrency = amountToTapInWei.mul(
        rate.div(BigNumber.from(10).pow(decimals)),
      );

      // Save the owner's balance before tapping.
      const ownersInitialBalance = await getBalanceFn(owner.address);

      await executeFn({
        // Exclude the owner's address to not let gas mess up the balance calculation.
        caller: randomSignerFn({ exclude: [owner.address] }),
        contract: contracts.terminalV1_1,
        fn: 'tap',
        args: [expectedProjectId, amountToTapInCurrency, currency, amountToTapInWei],
      });

      return { amountToTapInWei, ownersInitialBalance };
    },
  },
  {
    description: 'The tapped funds should be in the owners balance',
    fn: async ({
      constants,
      contracts,
      verifyBalanceFn,
      local: { owner, amountToTapInWei, ownersInitialBalance },
    }) => {
      // The amount tapped takes into account any fees paid.
      const expectedTappedAmountInWei = amountToTapInWei
        .mul(constants.MaxPercent)
        .div((await contracts.terminalV1_1.fee()).add(constants.MaxPercent));
      await verifyBalanceFn({
        address: owner.address,
        expect: ownersInitialBalance.add(expectedTappedAmountInWei),
      });
    },
  },
  {
    description: 'Check that the overflow amount is still being converted correctly after tapping',
    fn: ({
      contracts,
      checkFn,
      randomSignerFn,
      local: { paymentValueInWei, targetDenominatedInWei, expectedProjectId },
    }) =>
      checkFn({
        caller: randomSignerFn(),
        contract: contracts.terminalV1_1,
        fn: 'currentOverflowOf',
        args: [expectedProjectId],
        expect: paymentValueInWei.sub(targetDenominatedInWei),
      }),
  },
];
