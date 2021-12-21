import { expect } from 'chai';

const tests = {
  success: [
    {
      description: 'called by owner',
      fn: () => ({}),
    },
    {
      description: 'called by operator',
      fn: ({ addrs }) => ({
        owner: addrs[0].address,
        permissionFlag: true,
      }),
    },
    {
      description: 'max uint',
      fn: ({ addrs, constants }) => ({
        owner: addrs[0].address,
        permissionFlag: true,
        amount: constants.MaxInt256
      }),
    },
    {
      description: 'with preprinted amount',
      fn: ({ BigNumber }) => ({
        prePrintAmount: BigNumber.from(10).pow(18).mul(42)
      }),
    },
    {
      description: 'not allowed but no funding cycle',
      fn: () => ({
        allowed: false,
        fundingCycleNumber: 0
      }),
    },
  ],
  failure: [
    {
      description: 'unauthorized',
      fn: ({ addrs }) => ({
        owner: addrs[0].address,
        permissionFlag: false,
        revert: 'Operatable: UNAUTHORIZED',
      }),
    },
    {
      description: 'not allowed',
      fn: () => ({
        allowed: false,
        revert: 'TV1_1::printTickets: NOT_ALLOWED',
      }),
    },
    {
      description: 'max limit reached',
      fn: ({ constants }) => ({
        amount: constants.MaxInt256.add(1),
        revert: 'TV1_1::printTickets: INT_LIMIT_REACHED',
      }),
    }
  ],
};

const mockFn =
  ({ condition, mockContract, fn, args = [], returns = [] }) =>
    async () => {
      if (condition !== undefined && !condition) return;
      const normalizedArgs = typeof args === 'function' ? await args() : args;
      const normalizedReturns = typeof returns === 'function' ? await returns() : returns;
      await mockContract.mock[fn].withArgs(...normalizedArgs).returns(...normalizedReturns);
    };

const executeFn =
  ({ condition, caller, contract, fn, args = [], value = 0, events = [], revert }) =>
    async () => {
      if (condition !== undefined && !condition) return;
      const normalizedArgs = typeof args === 'function' ? await args() : args;
      const promise = contract.connect(caller)[fn](...normalizedArgs, { value });
      if (revert) {
        await expect(promise).to.be.revertedWith(revert);
        return;
      }
      if (events.length === 0) {
        await promise;
        return;
      }
      const tx = await promise;
      await tx.wait();
      await Promise.all(
        events.map(async (event) =>
          expect(tx)
            .to.emit(contract, event.name)
            .withArgs(...event.args),
        ),
      );
    };

const ops =
  ({ BigNumber, constants, deployer, mockContracts, targetContract }) =>
    (custom) => {
      const {
        caller = deployer,
        owner = deployer.address,
        permissionFlag = false,
        beneficiary = deployer.address,
        memo = 'some-memo',
        preferUnstaked = false,
        amount = BigNumber.from(10).pow(18).mul(210),
        prePrintAmount = BigNumber.from(10).pow(18).mul(0),
        projectId = 42,
        fundingCycleNumber = 1,
        revert,
        allowed = true,
      } = {
        ...custom,
      };

      // Create a packed metadata value to store the reserved rate.
      let packedMetadata = BigNumber.from(0);
      packedMetadata = packedMetadata.add(allowed ? 1 : 0);
      packedMetadata = packedMetadata.shl(1);
      packedMetadata = packedMetadata.add(0);
      packedMetadata = packedMetadata.shl(8);
      packedMetadata = packedMetadata.add(42);
      packedMetadata = packedMetadata.shl(8);
      packedMetadata = packedMetadata.add(42);
      packedMetadata = packedMetadata.shl(8);
      packedMetadata = packedMetadata.add(42);
      packedMetadata = packedMetadata.shl(8);

      return [
        mockFn({
          mockContract: mockContracts.fundingCycles,
          fn: 'currentOf',
          args: [projectId],
          returns: [
            {
              configured: 0,
              cycleLimit: 0,
              id: 1,
              projectId,
              number: fundingCycleNumber,
              basedOn: 0,
              weight: 0,
              ballot: constants.AddressZero,
              start: 0,
              duration: 0,
              target: 0,
              currency: 0,
              fee: 0,
              discountRate: 0,
              tapped: 0,
              metadata: packedMetadata,
            },
          ],
        }),
        mockFn({
          mockContract: mockContracts.projects,
          fn: 'ownerOf',
          args: [projectId],
          returns: [owner],
        }),
        mockFn({
          mockContract: mockContracts.operatorStore,
          fn: 'hasPermission',
          args: () => {
            const expectedPermissionIndex = 17;
            return [caller.address, owner, projectId, expectedPermissionIndex];
          },
          returns: [permissionFlag || false],
        }),
        mockFn({
          mockContract: mockContracts.ticketBooth,
          fn: 'totalSupplyOf',
          args: [projectId],
          returns: [0],
        }),
        ...(prePrintAmount > 0
          ? [
            mockFn({
              mockContract: mockContracts.ticketBooth,
              fn: 'print',
              args: [beneficiary, projectId, prePrintAmount, preferUnstaked],
              returns: [],
            }),
          ]
          : []),
        ...(prePrintAmount > 0
          ? [
            executeFn({
              caller,
              contract: targetContract,
              fn: 'printTickets',
              args: [projectId, prePrintAmount, beneficiary, memo, preferUnstaked],
            }),
          ]
          : []),
        mockFn({
          mockContract: mockContracts.ticketBooth,
          fn: 'totalSupplyOf',
          args: [projectId],
          returns: [prePrintAmount],
        }),
        mockFn({
          condition: !revert,
          mockContract: mockContracts.ticketBooth,
          fn: 'print',
          args: [beneficiary, projectId, amount, preferUnstaked],
          returns: [],
        }),
        executeFn({
          caller,
          contract: targetContract,
          fn: 'printTickets',
          args: [projectId, amount, beneficiary, memo, preferUnstaked],
          events: [
            {
              name: 'PrintTickets',
              args: [projectId, beneficiary, amount, memo, caller.address],
            },
          ],
          revert,
        })
      ];
    };

export default function () {
  describe('Success cases', function () {
    tests.success.forEach(function (successTest) {
      it(successTest.description, async function () {
        const resolvedOps = ops(this)(await successTest.fn(this));
        // eslint-disable-next-line no-restricted-syntax
        for (const op of resolvedOps) {
          // eslint-disable-next-line no-await-in-loop
          await op();
        }
      });
    });
  });
  describe('Failure cases', function () {
    tests.failure.forEach(function (failureTest) {
      it(failureTest.description, async function () {
        const resolvedOps = ops(this)(await failureTest.fn(this));
        // eslint-disable-next-line no-restricted-syntax
        for (const op of resolvedOps) {
          // eslint-disable-next-line no-await-in-loop
          await op();
        }
      });
    });
  });
}
