/**
 * Deploys Terminal V1.1 contract.
 */

module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  let chainId = await getChainId();

  let chain;
  let multisig;

  console.log({ chainId, d: deployer });

  switch (chainId) {
    // mainnet
    case '1':
      chain = 'mainnet';
      multisig = '0xAF28bcB48C40dBC86f52D459A6562F658fc94B1e';
      break;
    // rinkeby
    case '4':
      chain = 'rinkeby';
      multisig = '0xAF28bcB48C40dBC86f52D459A6562F658fc94B1e';
      break;
    // local
    case '31337':
      chain = 'localhost';
      multisig = '0x69C6026e3938adE9e1ddE8Ff6A37eC96595bF1e1';
      break;
    default:
      throw new Error(`Chain id ${chainId} not supported`);
  }

  console.log({ chain });
  console.log({ owner: multisig });

  await deploy('TerminalV1_1', {
    from: deployer,
    args: [
      require(`../deployments/${chain}/Projects.json`).address,
      require(`../deployments/${chain}/FundingCycles.json`).address,
      require(`../deployments/${chain}/TicketBooth.json`).address,
      require(`../deployments/${chain}/OperatorStore.json`).address,
      require(`../deployments/${chain}/ModStore.json`).address,
      require(`../deployments/${chain}/Prices.json`).address,
      require(`../deployments/${chain}/TerminalDirectory.json`).address,
      /*_governance=*/multisig
    ],
    log: true,
  });
};

module.exports.tags = ['TerminalV1_1'];