const { Web3 } = require('web3');
const fs = require('fs');
const path = require('path');

let web3;
let contract;
let contractABI;
let contractAddress;
let authorityAccount;
let onChainAuthority;
let authoritySignerAddress;
let authoritySignerPrivateKey;
let authoritySignerMode = 'rpc_unlocked';
let authoritySignerWarning;
let contractReady = false;

function normalizeNumberLike(value) {
  if (typeof value === 'bigint') {
    return Number(value);
  }
  return value;
}

function formatBlockchainError(error) {
  const message =
    error?.cause?.message ||
    error?.data?.message ||
    error?.message ||
    'Unknown blockchain error';

  return message.replace(/Returned error:\s*/i, '').trim();
}

function normalizeAddress(value) {
  return String(value || '').trim().toLowerCase();
}

async function validateContractDeployment() {
  if (!web3 || !contractAddress) {
    contractReady = false;
    return;
  }

  const code = await web3.eth.getCode(contractAddress);
  if (!code || code === '0x') {
    contract = null;
    contractReady = false;
    console.warn('No contract code found at configured CONTRACT_ADDRESS');
    return;
  }

  contractReady = true;
}

async function initWeb3() {
  try {
    authoritySignerAddress = null;
    authoritySignerPrivateKey = null;
    authoritySignerMode = 'rpc_unlocked';
    authoritySignerWarning = null;
    onChainAuthority = null;

    const ganacheUrl = process.env.GANACHE_URL || 'http://127.0.0.1:7545';
    web3 = new Web3(ganacheUrl);
    console.log('Web3 connected to Ganache:', ganacheUrl);

    const buildPath = path.resolve(__dirname, '../build/FundTracking.json');
    if (!fs.existsSync(buildPath)) {
      console.warn('Build file not found. Run: npm run compile && npm run deploy');
      contractReady = false;
      return;
    }

    const buildData = JSON.parse(fs.readFileSync(buildPath, 'utf8'));
    contractABI = buildData.abi;
    contractAddress = process.env.CONTRACT_ADDRESS || buildData.address;
    authorityAccount = process.env.AUTHORITY_ADDRESS || buildData.deployerAccount;

    if (!contractAddress || !authorityAccount) {
      console.warn('Blockchain config missing CONTRACT_ADDRESS/AUTHORITY_ADDRESS');
      contractReady = false;
      return;
    }

    contract = new web3.eth.Contract(contractABI, contractAddress);
    await validateContractDeployment();

    if (contractReady) {
      try {
        onChainAuthority = await contract.methods.authority().call();
      } catch {
        onChainAuthority = null;
      }

      if (onChainAuthority && normalizeAddress(onChainAuthority) !== normalizeAddress(authorityAccount)) {
        authoritySignerWarning =
          `Configured AUTHORITY_ADDRESS (${authorityAccount}) does not match on-chain authority (${onChainAuthority}). Using on-chain authority.`;
        authorityAccount = onChainAuthority;
        console.warn(authoritySignerWarning);
      }

      const privateKey = String(process.env.AUTHORITY_PRIVATE_KEY || '').trim();
      if (privateKey) {
        try {
          const cleanKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
          const signerAccount = web3.eth.accounts.privateKeyToAccount(cleanKey);
          authoritySignerAddress = signerAccount.address;

          if (normalizeAddress(authoritySignerAddress) === normalizeAddress(authorityAccount)) {
            authoritySignerPrivateKey = cleanKey;
            authoritySignerMode = 'private_key';
          } else {
            authoritySignerWarning =
              authoritySignerWarning ||
              `AUTHORITY_PRIVATE_KEY address (${authoritySignerAddress}) does not match authority (${authorityAccount}). Falling back to unlocked RPC account.`;
            console.warn(authoritySignerWarning);
          }
        } catch (error) {
          authoritySignerWarning =
            authoritySignerWarning || `Invalid AUTHORITY_PRIVATE_KEY. Falling back to unlocked RPC account.`;
          console.warn(`${authoritySignerWarning} ${formatBlockchainError(error)}`);
        }
      }

      console.log('Smart contract loaded at:', contractAddress);
      console.log('Authority account:', authorityAccount);
      console.log('Authority signer mode:', authoritySignerMode);
    }
  } catch (error) {
    contractReady = false;
    console.error('Web3 init error:', formatBlockchainError(error));
  }
}

function isContractReady() {
  return !!(web3 && contract && contractAddress && authorityAccount && contractReady);
}

async function sendAsAuthority(method, valueWei = 0n) {
  if (!isContractReady()) {
    return { success: false, error: 'Blockchain not configured or contract not deployed' };
  }

  const value = BigInt(valueWei).toString();

  try {
    if (authoritySignerMode !== 'private_key') {
      const gas = await method.estimateGas({ from: authorityAccount, value });
      const receipt = await method.send({
        from: authorityAccount,
        gas: Math.floor(Number(gas) * 1.2),
        value,
      });

      return {
        success: true,
        txHash: receipt.transactionHash,
        blockNumber: normalizeNumberLike(receipt.blockNumber),
      };
    }

    const accountAddress = authoritySignerAddress;
    const data = method.encodeABI();

    const [gasEstimate, chainId, gasPrice, nonce] = await Promise.all([
      web3.eth.estimateGas({
        from: accountAddress,
        to: contractAddress,
        data,
        value,
      }),
      web3.eth.getChainId(),
      web3.eth.getGasPrice(),
      web3.eth.getTransactionCount(accountAddress, 'pending'),
    ]);

    const tx = {
      chainId,
      nonce,
      from: accountAddress,
      to: contractAddress,
      gas: Math.floor(Number(gasEstimate) * 1.2),
      gasPrice,
      value,
      data,
    };

    const signedTx = await web3.eth.accounts.signTransaction(tx, authoritySignerPrivateKey);
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

    return {
      success: true,
      txHash: receipt.transactionHash,
      blockNumber: normalizeNumberLike(receipt.blockNumber),
    };
  } catch (error) {
    return { success: false, error: formatBlockchainError(error) };
  }
}

async function createProjectOnChain(projectId, contractorAddress, totalFundsWei) {
  const method = contract.methods.createProject(projectId, contractorAddress, totalFundsWei.toString());
  return sendAsAuthority(method, totalFundsWei);
}

async function logExpenseOnChain(projectId, amountWei, dataHash) {
  if (!isContractReady()) {
    return { success: false, error: 'Blockchain not configured or contract not deployed' };
  }

  try {
    const normalizedInput = String(dataHash || '').trim();
    const isPreHashedBytes32 = /^0x[a-fA-F0-9]{64}$/.test(normalizedInput);
    const hashBytes = isPreHashedBytes32
      ? normalizedInput
      : web3.utils.keccak256(normalizedInput);
    const method = contract.methods.logExpense(projectId, amountWei.toString(), hashBytes);
    const receipt = await sendAsAuthority(method, 0n);

    if (!receipt.success) {
      return receipt;
    }

    return {
      success: true,
      txHash: receipt.txHash,
      blockNumber: receipt.blockNumber,
      dataHash: hashBytes,
    };
  } catch (error) {
    return { success: false, error: formatBlockchainError(error) };
  }
}

async function releaseFundsOnChain(projectId, amountWei) {
  const method = contract.methods.releaseFunds(projectId, amountWei.toString());
  return sendAsAuthority(method, 0n);
}

async function updateProjectStatusOnChain(projectId, status) {
  const enumMap = {
    Created: 0,
    Active: 1,
    Completed: 2,
    Suspended: 3,
  };

  const statusEnum = Number.isInteger(status) ? status : enumMap[status];
  if (statusEnum === undefined) {
    return { success: false, error: 'Invalid status enum' };
  }

  const method = contract.methods.updateProjectStatus(projectId, statusEnum);
  return sendAsAuthority(method, 0n);
}

async function getProjectFromChain(projectId) {
  if (!isContractReady()) {
    return { success: false, error: 'Blockchain not configured or contract not deployed' };
  }

  try {
    let result;
    try {
      result = await contract.methods.getProject(projectId).call();
    } catch {
      result = await contract.methods.getProjectDetails(projectId).call();
    }
    return {
      success: true,
      data: {
        projectId: result[0],
        contractorAddress: result[1],
        totalFunds: result[2].toString(),
        releasedFunds: result[3].toString(),
        spentFunds: result[4].toString(),
        status: ['Created', 'Active', 'Completed', 'Suspended'][Number(result[5])],
      },
    };
  } catch (error) {
    return { success: false, error: formatBlockchainError(error) };
  }
}

async function getProjectExpensesFromChain(projectId) {
  if (!isContractReady()) {
    return { success: false, error: 'Blockchain not configured or contract not deployed' };
  }

  try {
    const expenses = await contract.methods.getProjectExpenses(projectId).call();
    const normalized = (expenses || []).map((item) => ({
      projectId: item.projectId || item[0] || projectId,
      amount: String(item.amount || item[1] || '0'),
      dataHash: String(item.dataHash || item[2] || ''),
      timestamp: String(item.timestamp || item[3] || '0'),
    }));

    return { success: true, expenses: normalized };
  } catch (error) {
    return { success: false, error: formatBlockchainError(error) };
  }
}

async function getContractEvents({ event = 'allEvents', fromBlock = 0, toBlock = 'latest', limit = 200 } = {}) {
  if (!isContractReady()) {
    return { success: false, error: 'Blockchain not configured or contract not deployed' };
  }

  try {
    const events = await contract.getPastEvents(event, { fromBlock, toBlock });
    const sorted = [...(events || [])].sort((a, b) => {
      const blockA = Number(a.blockNumber || 0);
      const blockB = Number(b.blockNumber || 0);
      if (blockA !== blockB) return blockB - blockA;
      return Number(b.logIndex || 0) - Number(a.logIndex || 0);
    });

    const trimmed = Number(limit) > 0 ? sorted.slice(0, Number(limit)) : sorted;
    const blockNumbers = Array.from(new Set(trimmed.map((item) => Number(item.blockNumber || 0)).filter((n) => n > 0)));

    const blockMap = new Map();
    await Promise.all(
      blockNumbers.map(async (blockNumber) => {
        try {
          const block = await web3.eth.getBlock(blockNumber);
          if (block?.timestamp !== undefined && block?.timestamp !== null) {
            blockMap.set(blockNumber, Number(block.timestamp));
          }
        } catch {
          // Best-effort timestamp lookup.
        }
      })
    );

    return {
      success: true,
      events: trimmed.map((item) => ({
        event: item.event || null,
        txHash: item.transactionHash || null,
        blockNumber: normalizeNumberLike(item.blockNumber),
        logIndex: normalizeNumberLike(item.logIndex),
        returnValues: item.returnValues || {},
        blockTimestamp: blockMap.get(Number(item.blockNumber || 0)) || null,
      })),
    };
  } catch (error) {
    return { success: false, error: formatBlockchainError(error) };
  }
}

async function getTransactionReceipts(txHashes = []) {
  if (!web3) {
    return { success: false, error: 'Blockchain not configured' };
  }

  try {
    const normalizedHashes = Array.from(
      new Set(
        (Array.isArray(txHashes) ? txHashes : [])
          .map((value) => String(value || '').trim())
          .filter(Boolean)
      )
    );

    const receiptEntries = await Promise.all(
      normalizedHashes.map(async (txHash) => {
        try {
          const receipt = await web3.eth.getTransactionReceipt(txHash);
          if (!receipt) return [txHash.toLowerCase(), null];
          return [
            txHash.toLowerCase(),
            {
              txHash,
              blockNumber: normalizeNumberLike(receipt.blockNumber),
              status: receipt.status === false ? 'failed' : 'confirmed',
            },
          ];
        } catch {
          return [txHash.toLowerCase(), null];
        }
      })
    );

    const receiptMap = new Map(receiptEntries.filter(([, value]) => !!value));
    const blockNumbers = Array.from(
      new Set(
        Array.from(receiptMap.values())
          .map((item) => Number(item.blockNumber || 0))
          .filter((value) => value > 0)
      )
    );

    const blockTimestampMap = new Map();
    await Promise.all(
      blockNumbers.map(async (blockNumber) => {
        try {
          const block = await web3.eth.getBlock(blockNumber);
          if (block?.timestamp !== undefined && block?.timestamp !== null) {
            blockTimestampMap.set(blockNumber, Number(block.timestamp));
          }
        } catch {
          // Best-effort lookup.
        }
      })
    );

    const receipts = Array.from(receiptMap.values()).map((item) => ({
      ...item,
      timestamp: blockTimestampMap.has(Number(item.blockNumber || 0))
        ? new Date(blockTimestampMap.get(Number(item.blockNumber || 0)) * 1000).toISOString()
        : null,
    }));

    return { success: true, receipts };
  } catch (error) {
    return { success: false, error: formatBlockchainError(error) };
  }
}

async function getGanacheAccounts() {
  if (!web3) return [];

  try {
    return await web3.eth.getAccounts();
  } catch {
    return [];
  }
}

function getWeb3Status() {
  const activeSignerAddress = authoritySignerMode === 'private_key'
    ? authoritySignerAddress
    : authorityAccount;

  return {
    connected: !!web3,
    contractDeployed: !!contractReady,
    contractAddress: contractAddress || null,
    authorityAccount: authorityAccount || null,
    onChainAuthority: onChainAuthority || null,
    signerAddress: activeSignerAddress || null,
    signerMode: authoritySignerMode,
    signerWarning: authoritySignerWarning || null,
    ganacheUrl: process.env.GANACHE_URL || 'http://127.0.0.1:7545',
  };
}

module.exports = {
  initWeb3,
  isContractReady,
  createProjectOnChain,
  logExpenseOnChain,
  releaseFundsOnChain,
  updateProjectStatusOnChain,
  getProjectFromChain,
  getProjectExpensesFromChain,
  getContractEvents,
  getTransactionReceipts,
  getGanacheAccounts,
  getWeb3Status,
  formatBlockchainError,
};
