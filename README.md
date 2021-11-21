# juice-contracts-v1

## Develop

To deploy the contracts to a local blockchain, run the following:

```bash
yarn chain --network hardhat
```

To run tests (all, unit, integration):

```bash
yarn test
yarn test:unit
yarn test:integration
```

You can also filter by version, test name, etc.:

```bash
yarn test:unit --grep "ProxyPaymentAddressManager"
```

## Verification

To verify the contracts on [Etherscan](https://etherscan.io), make sure you have an `ETHERSCAN_API_KEY` set in your `./.env` file. Then run the following:

```bash
npx hardhat --network $network etherscan-verify
```

This will verify all of the deployed contracts in `./deployments`.

If you encounter an error along the lines of the following, compile the problematic contract(s) in isolation first and verify one-by-one:

```
Error in plugin @nomiclabs/hardhat-etherscan: Source code exceeds max accepted (500k chars) length.
```

To compile in isolation:

```
npx hardhat compile:one Tickets
```

