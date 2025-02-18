/*==================================================
  Modules
  ==================================================*/
const BigNumber = require('bignumber.js');
const sdk = require('../../../../sdk');
const token0 = require('./abis/token0.json');
const token1 = require('./abis/token1.json');
const getReserves = require('./abis/getReserves.json');


/*==================================================
  Settings
  ==================================================*/
const START_BLOCK = 4931780;
const FACTORY = '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32';

/*==================================================
  TVL
  ==================================================*/
module.exports = async function tvl(_, block) {
  let supportedTokens = await (
    sdk
      .api
      .util
      .supportedTokens()
      .then((supportedTokens) => supportedTokens.map((token) => {
        if (token.platforms && token.platforms['polygon-pos']) {
          return token.platforms['polygon-pos'];
        }
      }))
  );
  supportedTokens = supportedTokens.filter(token => token)

  const logs = (
    await sdk.api.util
      .getLogs({
        keys: [],
        toBlock: block,
        target: FACTORY,
        fromBlock: START_BLOCK,
        topic: 'PairCreated(address,address,address,uint256)',
        chain: 'polygon'
      })
  ).output;

  let pairAddresses = []
  const token0Addresses = []
  const token1Addresses = []
  for (let log of logs) {
    token0Addresses.push(`0x${log.topics[1].substr(-40)}`.toLowerCase())
    token1Addresses.push(`0x${log.topics[2].substr(-40)}`.toLowerCase())
  }

  pairAddresses = (logs.map((log) =>         // sometimes the full log is emitted
        typeof log === 'string' ? log.toLowerCase() : `0x${log.data.slice(64 - 40 + 2, 64 + 2)}`.toLowerCase()));


  const pairs = {}
  // add token0Addresses
  token0Addresses.forEach((token0Address, i) => {
    if (supportedTokens.includes(token0Address)) {
      const pairAddress = pairAddresses[i]
      pairs[pairAddress] = {
        token0Address: token0Address,
      }
    }
  })

  // add token1Addresses
  token1Addresses.forEach((token1Address, i) => {
    if (supportedTokens.includes(token1Address)) {
      const pairAddress = pairAddresses[i]
      pairs[pairAddress] = {
        ...(pairs[pairAddress] || {}),
        token1Address: token1Address,
      }
    }
  })

  let balanceCalls = []

  for (let pair of Object.keys(pairs)) {
    if (pairs[pair].token0Address) {
      balanceCalls.push({
        target: pairs[pair].token0Address,
        params: pair,
      })
    }

    if (pairs[pair].token1Address) {
      balanceCalls.push({
        target: pairs[pair].token1Address,
        params: pair,
      })
    }
  }

  const tokenBalances = (
    await sdk.api.abi.multiCall({
      abi: 'erc20:balanceOf',
      calls: balanceCalls,
      block,
      chain: 'polygon'
    })
  )

  let balances = {};

  sdk.util.sumMultiBalanceOf(balances, tokenBalances)

  return balances;
};
