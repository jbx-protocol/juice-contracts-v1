const fs = require('fs');
const dotenv = require('dotenv');

require('@nomiclabs/hardhat-etherscan');
require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-ethers');
require('hardhat-gas-reporter');
require('hardhat-deploy');

dotenv.config();

const defaultNetwork = 'localhost';

function mnemonic() {
	return process.env.PRIVATE_KEY;
}

module.exports = {
	defaultNetwork,
	networks: {
		localhost: {
			url: 'http://localhost:8545',
		},
		bsc: {
			url: 'https://bsc-mainnet.web3api.com/v1/WFKT1AK5TMQRXQS9R9EQU21DXYDIYD4HTY',
			chainId: 56,
			gas: 2100000,
			gasPrice: 50000000000,
			accounts: [mnemonic()],
		},
		kovan: {
			url: 'https://kovan.infura.io/v3/788f289cea4849e39a3dc28840eea608',
			chainId: 42,
			gas: 2100000,
			gasPrice: 50000000000,
			accounts: [mnemonic()],
		},
	},
	solidity: {
		version: '0.8.6',
		settings: {
			optimizer: {
				enabled: true,
				runs: 10000,
			},
		},
	},
	mocha: {
		bail: true,
		timeout: 6000,
	},
	gasReporter: {
		currency: 'USD',
		// gasPrice: 21,
		enabled: !!process.env.REPORT_GAS,
		showTimeSpent: true,
	},
	bscscan: {
		apiKey: `${process.env.BSCSCAN_API_KEY}`,
	},
};
