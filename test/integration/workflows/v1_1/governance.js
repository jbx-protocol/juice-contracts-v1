/** 
  The governance of the terminalV1_1 can transfer its power to a new address.
  To do so, the governance must appoint a new address, and that address must accept the appointment.
*/
export default [
  {
    description: 'The initial governance can set a new fee',
    fn: ({ BigNumber, executeFn, multisig, contracts, randomBigNumberFn }) =>
      executeFn({
        caller: multisig,
        contract: contracts.terminalV1_1,
        fn: 'setFee',
        args: [randomBigNumberFn({ max: BigNumber.from(10) })],
      }),
  },
  {
    description: 'Change owner',
    fn: async ({ executeFn, contracts, multisig, randomSignerFn }) => {
      // Appoint a governance with a different address.
      const firstAppointedOwner = randomSignerFn();

      await executeFn({
        caller: multisig,
        contract: contracts.terminalV1_1,
        fn: 'transferOwnership',
        args: [firstAppointedOwner.address],
      });

      return { firstAppointedOwner };
    },
  },
  {
    description: "The new owner should be able to set a fee",
    fn: ({
      executeFn,
      contracts,
      randomBigNumberFn,
      BigNumber,
      local: { firstAppointedOwner },
    }) =>
      executeFn({
        caller: firstAppointedOwner,
        contract: contracts.terminalV1_1,
        fn: 'setFee',
        args: [randomBigNumberFn({ max: BigNumber.from(10) })]
      }),
  },
  {
    description: 'The old owner should not be able to set a fee',
    fn: ({ executeFn, multisig, contracts, randomBigNumberFn, BigNumber }) =>
      executeFn({
        caller: multisig,
        contract: contracts.terminalV1_1,
        fn: 'setFee',
        args: [randomBigNumberFn({ max: BigNumber.from(10) })],
        revert: "Ownable: caller is not the owner"
      }),
  },
  {
    description: 'New governance should be able to transfer to the old governance back',
    fn: ({ executeFn, contracts, multisig, local: { firstAppointedOwner } }) =>
      executeFn({
        caller: firstAppointedOwner,
        contract: contracts.terminalV1_1,
        fn: 'transferOwnership',
        args: [multisig.address],
      }),
  }
];
