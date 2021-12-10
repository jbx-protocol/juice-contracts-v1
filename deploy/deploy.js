const { ethers } = require('hardhat');

const { readFileSync } = require('fs');
const { sync } = require('glob');
const { BigNumber, Contract } = require('ethers');

async function main() {
	const [deployer] = await ethers.getSigners();
	const multisig = "0x98c40E18372F2b01317727e19f7BaC27C9e3De5E";
	console.log(deployer.address); // 0xb36718d589b40b9a449e201a28aaa5374519f19b

	// Bind a reference to a function that can deploy a contract on the local network.
	const deployContractFn = async (contractName, args = []) => {
		const artifacts = await ethers.getContractFactory(contractName);
		return artifacts.deploy(...args);
	};

	const executeFn = async ({
		caller,
		contract,
		contractName,
		contractAddress,
		fn,
		args = [],
		value = 0,
		events = [],
		revert,
	}) => {
		// Args can be either a function or an array.
		const normalizedArgs = typeof args === 'function' ? await args() : args;

		let contractInternal;
		if (contractName) {
			if (contract) {
				throw 'You can only provide a contract name or contract object.';
			}
			if (!contractAddress) {
				throw 'You must provide a contract address with a contract name.';
			}

			contractInternal = new Contract(contractAddress, readContractAbi(contractName), caller);
		} else {
			contractInternal = contract;
		}

		// Save the promise that is returned.
		const promise = contractInternal.connect(caller)[fn](...normalizedArgs, { value });

		// If a revert message is passed in, check to see if it was thrown.
		if (revert) {
			await _expect(promise).to.be.revertedWith(revert);
			return;
		}

		// Await the promise.
		const tx = await promise;

		// Wait for a block to get mined.
		await tx.wait();

		// Return if there are no events.
		if (events.length === 0) return;

		// Check for events.
		events.forEach((event) =>
			_expect(tx)
				.to.emit(contract, event.name)
				.withArgs(...event.args),
		);
	};

	const readContractAbi = (contractName) => {
		const files = sync(`${config.paths.artifacts}/contracts/**/${contractName}.sol/${contractName}.json`, {});
		if (files.length == 0) {
			throw 'No files found!';
		}
		if (files.length > 1) {
			throw 'Multiple files found!';
		}
		return JSON.parse(readFileSync(files[0]).toString()).abi;
	};

	const OperatorStore = await deployContractFn('OperatorStore', []);
	console.log('OperatorStore: ', OperatorStore.address);

	const Prices = await deployContractFn('Prices', []);
	console.log('Prices: ', Prices.address);

	const Projects = await deployContractFn('Projects', [OperatorStore.address]);
	console.log('Projects: ', Projects.address);

	const TerminalDirectory = await deployContractFn('TerminalDirectory', [Projects.address, OperatorStore.address]);
	console.log('TerminalDirectory: ', TerminalDirectory.address);

	const Governance = await deployContractFn('Governance', [1, TerminalDirectory.address]);
	console.log('Governance: ', Governance.address);
	await Prices.transferOwnership(Governance.address);
	const priceFeed = '0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE';
	await Governance.addPriceFeed(Prices.address, priceFeed, 1);
	await Governance.transferOwnership(multisig);

	const ModStore = await deployContractFn('ModStore', [
		Projects.address,
		OperatorStore.address,
		TerminalDirectory.address,
	]);
	console.log('ModStore: ', ModStore.address);

	const TicketBooth = await deployContractFn('TicketBooth', [
		Projects.address,
		OperatorStore.address,
		TerminalDirectory.address,
	]);
	console.log('TicketBooth: ', TicketBooth.address);

	const FundingCycles = await deployContractFn('FundingCycles', [TerminalDirectory.address]);
	console.log('FundingCycles: ', FundingCycles.address);

	const TerminalV1 = await deployContractFn('TerminalV1', [
		Projects.address,
		FundingCycles.address,
		TicketBooth.address,
		OperatorStore.address,
		ModStore.address,
		Prices.address,
		TerminalDirectory.address,
		Governance.address,
	]);
	console.log('TerminalV1: ', TerminalV1.address);

	// const ProxyPaymentAddressManager = await deployContractFn('ProxypaymentAddressManager', [
	// 	TerminalDirectory.address,
	// 	TicketBooth.address,
	// ]);

	await executeFn({
		caller: deployer,
		contract: TerminalV1,
		fn: 'deploy',
		args: [
			deployer.address,
			ethers.utils.formatBytes32String('MUDAO'),
			'',
			{
				target: BigNumber.from('19967000000000000000000'),
				currency: 1,
				// Duration must be zero so that the same cycle lasts throughout the tests.
				duration: BigNumber.from(30),
				cycleLimit: 0,
				discountRate: BigNumber.from(200),
				ballot: ethers.constants.AddressZero, // 7tian todo
			},
			{
				reservedRate: BigNumber.from(20),
				bondingCurveRate: BigNumber.from(120),
				reconfigurationBondingCurveRate: BigNumber.from(120),
			},
			[],
			[],
		],
	});
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
