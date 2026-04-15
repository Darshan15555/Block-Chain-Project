const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');

const Project = require('../models/Project');
const Update = require('../models/Update');
const Verification = require('../models/Verification');
const User = require('../models/User');
const FundingRequest = require('../models/FundingRequest');
const ReconciliationTask = require('../models/ReconciliationTask');
const DemoProgress = require('../models/DemoProgress');
const { authenticateToken, requireRoles } = require('../middleware/auth');
const { verificationRateLimiter } = require('../middleware/rateLimit');
const {
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
  initWeb3,
} = require('../middleware/web3Service');
const { resetDemoData } = require('../services/demoResetService');

const router = express.Router();

router.use(authenticateToken);

function generateProjectId() {
  return `PROJ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function hashData(data) {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

function parseAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return Math.floor(amount);
}

function toWei(inrValue) {
  const amount = parseAmount(inrValue);
  if (amount === null) {
    throw new Error('Invalid amount');
  }
  // Symbolic conversion for demo chain: 1 INR = 1 wei.
  return BigInt(amount);
}

function contractorFilter(user) {
  if (user.role !== 'contractor') {
    return {};
  }

  return { 'contractor.userId': new mongoose.Types.ObjectId(user.id) };
}

function userCanAccessProject(user, project) {
  if (user.role !== 'contractor') return true;
  return project.contractor?.userId?.toString() === user.id;
}

function fundingRequestFilter(user) {
  if (user.role === 'authority') {
    return { authorityId: new mongoose.Types.ObjectId(user.id) };
  }

  if (user.role === 'contractor') {
    return { contractorId: new mongoose.Types.ObjectId(user.id) };
  }

  return null;
}

function isAuthorityInitiatedRequest(requestItem) {
  // Backward compatibility: older records may not have initiatedBy populated.
  return !requestItem?.initiatedBy || requestItem.initiatedBy === 'authority';
}

function dbReconciliationResponse(res, message, txHash) {
  return res.status(500).json({
    success: false,
    error: message,
    needsReconciliation: true,
    txHash,
  });
}

function toUserFriendlyBlockchainError(rawMessage) {
  const message = String(rawMessage || 'Unknown blockchain error');
  if (/only authority can call this function/i.test(message)) {
    return 'Only on-chain authority can do this action. Check AUTHORITY_ADDRESS / AUTHORITY_PRIVATE_KEY alignment with deployed contract owner.';
  }
  if (/project does not exist/i.test(message)) {
    return 'Project is missing on the currently deployed smart contract. Sync project to blockchain and retry.';
  }
  if (/expense exceeds released funds/i.test(message)) {
    return 'Expense exceeds released funds. Release funds first, then submit update within released but unspent amount.';
  }
  if (/project is not active/i.test(message)) {
    return 'Project is not active on-chain. Change status to Active before submitting updates.';
  }
  return message;
}

function isDemoModeEnabled() {
  return String(process.env.DEMO_MODE || '').toLowerCase() === 'true';
}

function isProjectMissingOnChain(errorMessage) {
  return /project does not exist/i.test(String(errorMessage || ''));
}

async function ensureProjectOnChainState(project) {
  const chainLookup = await getProjectFromChain(project.projectId);
  if (chainLookup?.success) {
    return { success: true, recovered: false, chainData: chainLookup.data || null };
  }

  const lookupError = String(chainLookup?.error || '');
  if (!isProjectMissingOnChain(lookupError)) {
    return {
      success: false,
      status: 502,
      code: 'CHAIN_LOOKUP_FAILED',
      error: `Unable to validate project on blockchain: ${toUserFriendlyBlockchainError(lookupError || 'Lookup failed')}`,
    };
  }

  const contractorAddress = String(project.contractor?.address || '').trim();
  if (!contractorAddress) {
    return {
      success: false,
      status: 409,
      code: 'CHAIN_SYNC_CONTRACTOR_WALLET_MISSING',
      error: 'Assigned contractor wallet is missing. Update contractor wallet before syncing blockchain.',
    };
  }

  const totalFund = parseAmount(project.totalFund);
  if (totalFund === null) {
    return {
      success: false,
      status: 409,
      code: 'CHAIN_SYNC_INVALID_TOTAL_FUND',
      error: 'Project total fund is invalid, so blockchain sync cannot proceed.',
    };
  }

  const createResult = await createProjectOnChain(project.projectId, contractorAddress, toWei(totalFund));
  if (!createResult.success && !/project already exists/i.test(String(createResult.error || ''))) {
    return {
      success: false,
      status: 502,
      code: 'CHAIN_SYNC_CREATE_FAILED',
      error: `Blockchain sync failed while recreating project: ${toUserFriendlyBlockchainError(createResult.error)}`,
    };
  }

  let latestTxHash = createResult.txHash || null;
  const releasedFund = Math.max(0, Number(project.releasedFund || 0));
  const spentFund = Math.max(0, Number(project.spentFund || 0));

  if (releasedFund > 0) {
    const releaseRes = await releaseFundsOnChain(project.projectId, toWei(releasedFund));
    if (!releaseRes.success) {
      return {
        success: false,
        status: 502,
        code: 'CHAIN_SYNC_RELEASE_REPLAY_FAILED',
        error: `Blockchain sync failed while replaying released amount: ${toUserFriendlyBlockchainError(releaseRes.error)}`,
      };
    }
    latestTxHash = releaseRes.txHash || latestTxHash;
  }

  if (spentFund > 0) {
    const updateQuery = Update.find({ projectId: project.projectId });
    const historicalUpdates = typeof updateQuery?.sort === 'function'
      ? await updateQuery.sort({ date: 1, createdAt: 1 })
      : await updateQuery;

    if (!Array.isArray(historicalUpdates) || historicalUpdates.length === 0) {
      return {
        success: false,
        status: 409,
        code: 'CHAIN_SYNC_UPDATES_MISSING',
        error: 'Blockchain sync failed because historical updates are missing. Run demo reset to rebuild consistent state.',
      };
    }

    let replayedSpent = 0;
    for (const updateItem of historicalUpdates) {
      const amount = parseAmount(updateItem.amountSpent);
      if (amount === null) continue;

      const hashSeed = updateItem.dataHash
        || hashData({
          projectId: updateItem.projectId,
          date: updateItem.date,
          workDescription: updateItem.workDescription,
          materialsUsed: updateItem.materialsUsed,
          workersCount: updateItem.workersCount,
          amountSpent: amount,
          submittedBy: updateItem.submittedBy,
          timestamp: new Date(updateItem.createdAt || Date.now()).getTime(),
        });

      const replayResult = await logExpenseOnChain(project.projectId, toWei(amount), hashSeed);
      if (!replayResult.success) {
        return {
          success: false,
          status: 502,
          code: 'CHAIN_SYNC_EXPENSE_REPLAY_FAILED',
          error: `Blockchain sync failed while replaying expense logs: ${toUserFriendlyBlockchainError(replayResult.error)}`,
        };
      }

      replayedSpent += amount;
      latestTxHash = replayResult.txHash || latestTxHash;
    }

    if (Math.floor(spentFund) !== replayedSpent) {
      return {
        success: false,
        status: 409,
        code: 'CHAIN_SYNC_SPENT_MISMATCH',
        error: 'Blockchain sync detected spent amount mismatch with historical updates. Run demo reset to recover consistency.',
      };
    }
  }

  if (project.status && project.status !== 'Active') {
    const statusResult = await updateProjectStatusOnChain(project.projectId, project.status);
    if (!statusResult.success) {
      return {
        success: false,
        status: 502,
        code: 'CHAIN_SYNC_STATUS_REPLAY_FAILED',
        error: `Blockchain sync failed while replaying project status: ${toUserFriendlyBlockchainError(statusResult.error)}`,
      };
    }
    latestTxHash = statusResult.txHash || latestTxHash;
  }

  await Project.updateOne(
    { _id: project._id },
    {
      $set: {
        blockchainStatus: 'confirmed',
        blockchainTxHash: latestTxHash || project.blockchainTxHash || null,
      },
    }
  ).catch(() => {});

  return {
    success: true,
    recovered: true,
    chainData: null,
    txHash: latestTxHash,
  };
}

const DEFAULT_DEMO_PROGRESS = {
  createProject: false,
  sendRequest: false,
  acceptRequest: false,
  submitUpdate: false,
  verifyWork: false,
  openBlockchainProof: false,
};

async function markDemoStep(stepKey) {
  if (!isDemoModeEnabled()) return;
  if (!Object.prototype.hasOwnProperty.call(DEFAULT_DEMO_PROGRESS, stepKey)) return;

  try {
    await DemoProgress.updateOne(
      { key: 'global' },
      { $set: { [stepKey]: true } },
      { upsert: true }
    );
  } catch {
    // Demo progress should never break core API flow.
  }
}

async function resetDemoProgress() {
  try {
    await DemoProgress.updateOne(
      { key: 'global' },
      { $set: { ...DEFAULT_DEMO_PROGRESS } },
      { upsert: true }
    );
  } catch {
    // Non-blocking for reset endpoint.
  }
}

async function enqueueReconciliationTask({ operation, projectId, txHash, payload, error }) {
  try {
    await ReconciliationTask.create({
      operation,
      projectId: projectId || null,
      txHash,
      payload: payload || {},
      syncStatus: 'pending',
      lastError: error?.message || String(error || 'Unknown reconciliation error'),
    });
  } catch {
    // Do not block API response if queue write fails.
  }
}

function mapRoleStats(role, baseStats) {
  if (role === 'authority') {
    return {
      totalProjectsCreated: baseStats.totalProjects,
      totalFundsAllocated: baseStats.totalFunds,
      totalFundsReleased: baseStats.totalReleased,
    };
  }

  if (role === 'contractor') {
    return {
      projectsAssigned: baseStats.totalProjects,
      totalFundsRequested: baseStats.totalRequestedByContractor,
      totalFundsReceived: baseStats.totalReceivedByContractor,
    };
  }

  return {
    projectsVerified: baseStats.projectsVerifiedByPublic,
    totalFundsTracked: baseStats.totalFunds,
  };
}

function normalizeAddress(value) {
  return String(value || '').trim().toLowerCase();
}

function toNumberOrNull(value) {
  const parsed = Number(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function statusFromEnum(rawValue) {
  const enumValue = Number(rawValue);
  if (enumValue === 0) return 'Created';
  if (enumValue === 1) return 'Active';
  if (enumValue === 2) return 'Completed';
  if (enumValue === 3) return 'Suspended';
  return `Unknown (${rawValue})`;
}

router.get('/blockchain/status', async (req, res) => {
  try {
    const accounts = await getGanacheAccounts();
    const status = getWeb3Status();
    res.json({ success: true, ...status, accounts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/blockchain/audit', async (req, res) => {
  try {
    const [status, accounts, chainEventsResult, projects, projectTxs, updateTxs, releaseTxs, pendingReconciliation] = await Promise.all([
      Promise.resolve(getWeb3Status()),
      getGanacheAccounts(),
      getContractEvents({ event: 'allEvents', fromBlock: 0, toBlock: 'latest', limit: 250 }),
      Project.find({}).select('projectId name contractor.name contractor.address'),
      Project.find({ blockchainTxHash: { $ne: null } })
        .select('projectId name blockchainTxHash blockNumber blockchainStatus updatedAt')
        .sort({ updatedAt: -1 })
        .limit(20),
      Update.find({ blockchainTxHash: { $ne: null } })
        .select('projectId amountSpent blockchainTxHash blockNumber blockchainStatus createdAt')
        .sort({ createdAt: -1 })
        .limit(20),
      FundingRequest.find({
        status: { $in: ['released'] },
        blockchainTxHash: { $ne: null },
      })
        .select('projectId projectName amount blockchainTxHash blockNumber blockchainStatus respondedAt createdAt')
        .sort({ respondedAt: -1, createdAt: -1 })
        .limit(20),
      ReconciliationTask.countDocuments({ syncStatus: 'pending' }),
    ]);

    const projectMap = new Map(projects.map((item) => [item.projectId, item]));
    const contractorByAddress = new Map(
      projects
        .map((item) => [normalizeAddress(item.contractor?.address), item.contractor?.name])
        .filter(([address]) => !!address)
    );

    const chainEvents = chainEventsResult?.success ? chainEventsResult.events || [] : [];
    const chainTxFeed = chainEvents.map((eventItem) => {
      const values = eventItem.returnValues || {};
      const projectId = values.projectId || null;
      const projectMeta = projectId ? projectMap.get(projectId) : null;
      const contractorAddress = values.contractorAddress || projectMeta?.contractor?.address || null;
      const contractorName = contractorByAddress.get(normalizeAddress(contractorAddress)) || projectMeta?.contractor?.name || null;
      const timestamp =
        eventItem.blockTimestamp !== null && eventItem.blockTimestamp !== undefined
          ? new Date(Number(eventItem.blockTimestamp) * 1000).toISOString()
          : null;

      const base = {
        source: 'chain',
        rawEvent: eventItem.event || 'UnknownEvent',
        txHash: eventItem.txHash || null,
        blockNumber: eventItem.blockNumber ?? null,
        logIndex: eventItem.logIndex ?? null,
        timestamp,
        blockchainStatus: 'confirmed',
        projectId,
        projectName: projectMeta?.name || projectId || 'N/A',
        contractorAddress: contractorAddress || null,
        contractorName: contractorName || null,
        actorAddress: status.signerAddress || status.authorityAccount || null,
        actorName: 'Authority/Signer',
        amount: null,
        dataHash: null,
        details: '',
        type: 'other',
        actionLabel: eventItem.event || 'On-chain Event',
      };

      if (eventItem.event === 'ProjectCreated') {
        return {
          ...base,
          type: 'project',
          actionLabel: 'Project Created',
          amount: toNumberOrNull(values.totalFunds),
          details: `Budget locked and assigned to contractor wallet`,
        };
      }

      if (eventItem.event === 'ExpenseLogged') {
        return {
          ...base,
          type: 'expense',
          actionLabel: 'Expense Logged',
          amount: toNumberOrNull(values.amount),
          dataHash: values.dataHash ? String(values.dataHash) : null,
          actorName: contractorName ? `${contractorName} (submitted via backend signer)` : 'Contractor (submitted via backend signer)',
          details: 'Immutable expense entry written on-chain',
        };
      }

      if (eventItem.event === 'FundsReleased') {
        return {
          ...base,
          type: 'release',
          actionLabel: 'Funds Released',
          amount: toNumberOrNull(values.amount),
          actorName: 'Authority',
          details: contractorAddress ? `Transferred to contractor wallet ${contractorAddress}` : 'Transferred to contractor wallet',
        };
      }

      if (eventItem.event === 'ProjectStatusUpdated') {
        return {
          ...base,
          type: 'status',
          actionLabel: 'Project Status Updated',
          details: `New status: ${statusFromEnum(values.newStatus)}`,
        };
      }

      if (eventItem.event === 'AuthorityDeposited') {
        return {
          ...base,
          type: 'deposit',
          actionLabel: 'Treasury Deposited',
          amount: toNumberOrNull(values.amount),
          projectId: null,
          projectName: 'Treasury',
          details: 'Authority funded contract treasury',
        };
      }

      return base;
    });

    const dbFeed = [
      ...projectTxs.map((item) => ({
        type: 'project',
        actionLabel: 'Project Create/Update',
        projectId: item.projectId,
        projectName: item.name,
        amount: null,
        txHash: item.blockchainTxHash,
        blockNumber: item.blockNumber ?? null,
        blockchainStatus: item.blockchainStatus,
        timestamp: item.updatedAt,
        source: 'database',
        details: 'Stored in MongoDB, waiting for on-chain reconciliation',
      })),
      ...updateTxs.map((item) => ({
        type: 'expense',
        actionLabel: 'Expense Log',
        projectId: item.projectId,
        projectName: projectMap.get(item.projectId)?.name || item.projectId,
        amount: item.amountSpent,
        txHash: item.blockchainTxHash,
        blockNumber: item.blockNumber ?? null,
        blockchainStatus: item.blockchainStatus,
        timestamp: item.createdAt,
        source: 'database',
        details: 'Stored in MongoDB, waiting for on-chain reconciliation',
      })),
      ...releaseTxs.map((item) => ({
        type: 'release',
        actionLabel: 'Funds Released',
        projectId: item.projectId,
        projectName: item.projectName,
        amount: item.amount,
        txHash: item.blockchainTxHash,
        blockNumber: item.blockNumber ?? null,
        blockchainStatus: item.blockchainStatus,
        timestamp: item.respondedAt || item.createdAt,
        source: 'database',
        details: 'Stored in MongoDB, waiting for on-chain reconciliation',
      })),
    ];

    const chainHashSet = new Set(
      chainTxFeed.map((item) => String(item.txHash || '').toLowerCase()).filter(Boolean)
    );
    const dbOnlyTxFeed = dbFeed.filter((item) => {
      const normalizedHash = String(item.txHash || '').toLowerCase();
      if (!normalizedHash) return true;
      return !chainHashSet.has(normalizedHash);
    });

    const dbOnlyHashes = dbOnlyTxFeed.map((item) => item.txHash).filter(Boolean);
    const receiptResult = await getTransactionReceipts(dbOnlyHashes);
    const receiptMap = new Map(
      (receiptResult?.success ? receiptResult.receipts : [])
        .map((item) => [String(item.txHash || '').toLowerCase(), item])
        .filter(([hash]) => !!hash)
    );

    const receiptBackfills = [];
    const reconciledDbTxFeed = dbOnlyTxFeed.map((item) => {
      const hashKey = String(item.txHash || '').toLowerCase();
      const receipt = receiptMap.get(hashKey);
      if (!receipt) return item;

      receiptBackfills.push({
        type: item.type,
        txHash: item.txHash,
        blockNumber: receipt.blockNumber ?? null,
        status: receipt.status || null,
      });

      return {
        ...item,
        source: 'chain_receipt',
        blockNumber: receipt.blockNumber ?? item.blockNumber ?? null,
        timestamp: receipt.timestamp || item.timestamp,
        blockchainStatus: receipt.status || item.blockchainStatus || 'confirmed',
        details: 'Recovered from on-chain transaction receipt (event match not found).',
      };
    });

    if (receiptBackfills.length > 0) {
      await Promise.all(
        receiptBackfills.map(async (item) => {
          if (!item.txHash) return;
          const patch = {
            blockNumber: item.blockNumber ?? null,
            blockchainStatus: item.status || 'confirmed',
          };

          if (item.type === 'project') {
            await Project.updateOne({ blockchainTxHash: item.txHash }, { $set: patch }).catch(() => {});
            return;
          }
          if (item.type === 'expense') {
            await Update.updateOne({ blockchainTxHash: item.txHash }, { $set: patch }).catch(() => {});
            return;
          }
          if (item.type === 'release') {
            await FundingRequest.updateOne({ blockchainTxHash: item.txHash }, { $set: patch }).catch(() => {});
          }
        })
      );
    }

    const txFeed = [...chainTxFeed, ...reconciledDbTxFeed]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 100);

    const unresolvedDbFallbackCount = reconciledDbTxFeed.filter((item) => item.source === 'database').length;

    const typeCounts = {
      project: chainTxFeed.filter((item) => item.type === 'project').length,
      expense: chainTxFeed.filter((item) => item.type === 'expense').length,
      release: chainTxFeed.filter((item) => item.type === 'release').length,
      status: chainTxFeed.filter((item) => item.type === 'status').length,
      deposit: chainTxFeed.filter((item) => item.type === 'deposit').length,
    };

    await markDemoStep('openBlockchainProof');

    const recoveredFromReceiptCount = reconciledDbTxFeed.filter((item) => item.source === 'chain_receipt').length;

    return res.json({
      success: true,
      status: {
        connected: !!status.connected,
        contractDeployed: !!status.contractDeployed,
        contractAddress: status.contractAddress || null,
        authorityAccount: status.authorityAccount || null,
        signerAddress: status.signerAddress || null,
        signerMode: status.signerMode || null,
        signerWarning: status.signerWarning || null,
        ganacheUrl: status.ganacheUrl || null,
        accounts: accounts || [],
      },
      totals: {
        projectTransactions: typeCounts.project,
        expenseTransactions: typeCounts.expense,
        releaseTransactions: typeCounts.release,
        statusTransactions: typeCounts.status,
        depositTransactions: typeCounts.deposit,
        allTransactions: chainTxFeed.length,
        dbOnlyTransactions: unresolvedDbFallbackCount,
        pendingReconciliation: pendingReconciliation || 0,
      },
      txFeed,
      chainUsage: [
        'Project creation locks budget on-chain with project and contractor mapping.',
        'Expense logs are immutable blockchain events with data hash proof.',
        'Fund release events show exact value transferred to contractor wallet.',
        'Project status updates are tracked on-chain for lifecycle transparency.',
      ],
      auditNotes: chainEventsResult?.success
        ? [
            'Primary feed comes directly from smart-contract events.',
            recoveredFromReceiptCount > 0
              ? `${recoveredFromReceiptCount} row(s) enriched from on-chain tx receipt lookup.`
              : 'No receipt-based enrichment needed.',
          ]
        : ['Unable to load smart-contract events; showing database fallback evidence only.'],
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/users/contractors', requireRoles('authority'), async (req, res) => {
  try {
    const contractors = await User.find({ role: 'contractor' })
      .select('_id name username walletAddress')
      .sort({ name: 1 });

    res.json({
      success: true,
      contractors: contractors.map((contractor) => ({
        id: contractor._id.toString(),
        name: contractor.name,
        username: contractor.username,
        address: contractor.walletAddress,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/contract-requests', requireRoles('authority'), async (req, res) => {
  try {
    const { projectId, amount, note } = req.body;

    if (!projectId || !amount) {
      return res.status(400).json({ success: false, error: 'projectId and amount are required' });
    }

    const numericAmount = parseAmount(amount);
    if (numericAmount === null) {
      return res.status(400).json({ success: false, error: 'Invalid amount value' });
    }

    const project = await Project.findOne({ projectId });
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    if (project.status !== 'Active') {
      return res.status(400).json({ success: false, error: 'Request can be sent only for active projects' });
    }

    const remaining = Number(project.totalFund) - Number(project.releasedFund || 0);
    if (numericAmount > remaining) {
      return res.status(400).json({ success: false, error: 'Amount exceeds remaining project funds' });
    }

    const contractorUser = await User.findById(project.contractor?.userId).select('_id name username walletAddress');
    if (!contractorUser) {
      return res.status(400).json({ success: false, error: 'Assigned contractor account not found' });
    }

    const request = await FundingRequest.create({
      projectId: project.projectId,
      projectName: project.name,
      contractorId: contractorUser._id,
      contractorName: contractorUser.name,
      authorityId: req.user.id,
      authorityName: req.user.name,
      amount: numericAmount,
      note: note || '',
      initiatedBy: 'authority',
      status: 'pending',
      blockchainStatus: 'pending',
    });
    await markDemoStep('sendRequest');

    return res.status(201).json({
      success: true,
      request,
      targetContractor: {
        id: contractorUser._id.toString(),
        name: contractorUser.name,
        username: contractorUser.username,
      },
      message: `Funding request sent to ${contractorUser.name} (@${contractorUser.username})`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/contract-requests/raise', requireRoles('contractor'), async (req, res) => {
  try {
    const { projectId, amount, note } = req.body;
    if (!projectId || !amount) {
      return res.status(400).json({ success: false, error: 'projectId and amount are required' });
    }

    const numericAmount = parseAmount(amount);
    if (numericAmount === null) {
      return res.status(400).json({ success: false, error: 'Invalid amount value' });
    }

    const noteText = String(note || '').trim();
    if (/submit-update screen/i.test(noteText)) {
      return res.status(409).json({
        success: false,
        error: 'Deprecated request flow detected. Refresh app and raise fund request only from Contractor Dashboard.',
      });
    }

    const project = await Project.findOne({ projectId });
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    if (!userCanAccessProject(req.user, project)) {
      return res.status(403).json({ success: false, error: 'You can request funds only for your assigned projects' });
    }

    if (project.status !== 'Active') {
      return res.status(400).json({ success: false, error: 'Request can be raised only for active projects' });
    }

    const remaining = Number(project.totalFund) - Number(project.releasedFund || 0);
    if (numericAmount > remaining) {
      return res.status(400).json({ success: false, error: 'Amount exceeds remaining project funds' });
    }

    const authorityUser = await User.findOne({ role: 'authority' }).select('_id name');
    if (!authorityUser) {
      return res.status(400).json({ success: false, error: 'Authority account not found' });
    }

    const request = await FundingRequest.create({
      projectId: project.projectId,
      projectName: project.name,
      contractorId: req.user.id,
      contractorName: req.user.name,
      authorityId: authorityUser._id,
      authorityName: authorityUser.name,
      amount: numericAmount,
      note: note || '',
      initiatedBy: 'contractor',
      // Contractor-raised request is treated as explicit acceptance from contractor.
      status: 'accepted',
      respondedAt: new Date(),
      blockchainStatus: 'pending',
    });
    await markDemoStep('sendRequest');
    await markDemoStep('acceptRequest');

    return res.status(201).json({
      success: true,
      request,
      message: 'Fund request raised to authority. Awaiting release.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/contract-requests', requireRoles('authority', 'contractor'), async (req, res) => {
  try {
    const filter = fundingRequestFilter(req.user);
    if (!filter) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const requests = await FundingRequest.find(filter).sort({ createdAt: -1 });
    const normalizedRequests = requests.map((requestItem) => {
      const json = requestItem.toObject();
      if (!json.initiatedBy) {
        json.initiatedBy = 'authority';
      }
      return json;
    });
    return res.json({ success: true, requests: normalizedRequests });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/contract-requests/:requestId/respond', requireRoles('contractor'), async (req, res) => {
  try {
    const { action, responseNote } = req.body;
    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, error: 'action must be accept or reject' });
    }

    const requestItem = await FundingRequest.findOne({ _id: req.params.requestId });

    if (!requestItem) {
      return res.status(404).json({ success: false, error: 'Funding request not found' });
    }

    if (requestItem.contractorId?.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'This request belongs to another contractor account',
      });
    }

    if (requestItem.status !== 'pending') {
      return res.status(409).json({ success: false, error: 'Request already processed' });
    }

    if (!isAuthorityInitiatedRequest(requestItem)) {
      return res.status(409).json({
        success: false,
        error: 'Only authority-initiated requests can be accepted/rejected by contractor',
      });
    }

    requestItem.responseNote = responseNote || '';
    requestItem.respondedAt = new Date();

    if (action === 'reject') {
      requestItem.status = 'rejected';
      requestItem.blockchainStatus = 'failed';
      await requestItem.save();
      return res.json({
        success: true,
        request: requestItem,
        message: 'Funding request rejected',
      });
    }

    requestItem.status = 'accepted';
    if (!requestItem.initiatedBy) {
      requestItem.initiatedBy = 'authority';
    }
    requestItem.blockchainStatus = 'pending';
    await requestItem.save();
    await markDemoStep('acceptRequest');

    return res.json({
      success: true,
      request: requestItem,
      message: 'Request accepted. Authority can now release funds.',
    });
  } catch (error) {
    if (error?.name === 'CastError') {
      return res.status(400).json({ success: false, error: 'Invalid request id' });
    }
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/contract-requests/:requestId/release', requireRoles('authority'), async (req, res) => {
  try {
    const requestItem = await FundingRequest.findOne({
      _id: req.params.requestId,
      authorityId: req.user.id,
    });

    if (!requestItem) {
      return res.status(404).json({ success: false, error: 'Funding request not found' });
    }

    if (requestItem.status !== 'accepted') {
      return res.status(409).json({
        success: false,
        error: 'Funds can be released only after contractor acceptance',
      });
    }

    if (!isAuthorityInitiatedRequest(requestItem)) {
      return res.status(409).json({
        success: false,
        error: 'Only authority-initiated accepted requests can be released',
      });
    }

    const project = await Project.findOne({ projectId: requestItem.projectId });
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found for this request' });
    }

    if (project.status !== 'Active') {
      return res.status(400).json({ success: false, error: 'Project is not active' });
    }

    const remaining = Number(project.totalFund) - Number(project.releasedFund || 0);
    if (Number(requestItem.amount) > remaining) {
      return res.status(400).json({ success: false, error: 'Requested amount exceeds remaining project funds' });
    }

    const chainReady = await ensureProjectOnChainState(project);
    if (!chainReady.success) {
      requestItem.blockchainStatus = 'failed';
      await requestItem.save().catch(() => {});
      return res.status(chainReady.status || 409).json({
        success: false,
        code: chainReady.code || 'CHAIN_SYNC_REQUIRED',
        error: chainReady.error,
      });
    }

    const blockchainResult = await releaseFundsOnChain(project.projectId, toWei(requestItem.amount));
    if (!blockchainResult.success) {
      requestItem.blockchainStatus = 'failed';
      await requestItem.save();
      return res.status(502).json({
        success: false,
        error: `Blockchain transaction failed: ${toUserFriendlyBlockchainError(blockchainResult.error)}`,
      });
    }

    requestItem.status = 'released';
    requestItem.releasedAt = new Date();
    requestItem.blockchainTxHash = blockchainResult.txHash;
    requestItem.blockNumber = blockchainResult.blockNumber || null;
    requestItem.blockchainStatus = 'confirmed';
    await requestItem.save();

    try {
      await Project.updateOne(
        { _id: project._id },
        {
          $inc: { releasedFund: Number(requestItem.amount) },
          $set: {
            blockchainTxHash: blockchainResult.txHash,
            blockNumber: blockchainResult.blockNumber || null,
            blockchainStatus: 'confirmed',
          },
        }
      );
    } catch (dbError) {
      requestItem.blockchainStatus = 'reconciliation_required';
      await requestItem.save().catch(() => {});
      await enqueueReconciliationTask({
        operation: 'release_funds',
        projectId: project.projectId,
        txHash: blockchainResult.txHash,
        payload: {
          projectObjectId: project._id.toString(),
          amount: Number(requestItem.amount),
          requestId: requestItem._id.toString(),
          blockNumber: blockchainResult.blockNumber || null,
        },
        error: dbError,
      });

      return dbReconciliationResponse(
        res,
        `Funds were released on-chain but failed to sync project balance: ${dbError.message}`,
        blockchainResult.txHash
      );
    }

    return res.json({
      success: true,
      request: requestItem,
      blockchain: blockchainResult,
      message: chainReady.recovered
        ? 'Project was re-synced and funds released on blockchain after contractor acceptance'
        : 'Funds released on blockchain after contractor acceptance',
    });
  } catch (error) {
    if (error?.name === 'CastError') {
      return res.status(400).json({ success: false, error: 'Invalid request id' });
    }
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/createProject', requireRoles('authority'), async (req, res) => {
  try {
    const { name, type, location, totalFund, contractorId } = req.body;

    if (!name || !location || !totalFund || !contractorId) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const numericTotalFund = parseAmount(totalFund);
    if (numericTotalFund === null) {
      return res.status(400).json({ success: false, error: 'Invalid totalFund amount' });
    }

    const contractor = await User.findOne({ _id: contractorId, role: 'contractor' }).select(
      '_id name username walletAddress'
    );

    if (!contractor || !contractor.walletAddress) {
      return res.status(400).json({ success: false, error: 'Valid contractor with wallet address is required' });
    }

    const projectId = generateProjectId();
    const blockchainResult = await createProjectOnChain(projectId, contractor.walletAddress, toWei(numericTotalFund));

    if (!blockchainResult.success) {
      return res.status(502).json({
        success: false,
        error: `Blockchain transaction failed: ${toUserFriendlyBlockchainError(blockchainResult.error)}`,
      });
    }

    try {
      const project = await Project.create({
        projectId,
        name,
        type: type || 'Other',
        location,
        totalFund: numericTotalFund,
        releasedFund: 0,
        spentFund: 0,
        contractor: {
          userId: contractor._id,
          name: contractor.name,
          address: contractor.walletAddress,
          id: contractor.username,
        },
        blockchainTxHash: blockchainResult.txHash,
        blockNumber: blockchainResult.blockNumber || null,
        blockchainStatus: 'confirmed',
        status: 'Active',
      });
      await markDemoStep('createProject');

      return res.status(201).json({
        success: true,
        project,
        blockchain: blockchainResult,
        message: 'Project created and recorded on blockchain',
      });
    } catch (dbError) {
      await enqueueReconciliationTask({
        operation: 'create_project',
        projectId,
        txHash: blockchainResult.txHash,
        payload: {
          projectId,
          name,
          type: type || 'Other',
          location,
          totalFund: numericTotalFund,
          blockNumber: blockchainResult.blockNumber || null,
          contractor: {
            userId: contractor._id.toString(),
            name: contractor.name,
            address: contractor.walletAddress,
            id: contractor.username,
          },
        },
        error: dbError,
      });
      return dbReconciliationResponse(
        res,
        `Project was created on-chain but failed to persist in database: ${dbError.message}`,
        blockchainResult.txHash
      );
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/projects', async (req, res) => {
  try {
    const projects = await Project.find(contractorFilter(req.user)).sort({ createdAt: -1 });
    res.json({ success: true, projects });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/projects/:projectId', async (req, res) => {
  try {
    const project = await Project.findOne({ projectId: req.params.projectId });
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    if (!userCanAccessProject(req.user, project)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const chainData = await getProjectFromChain(req.params.projectId);

    res.json({ success: true, project, chainData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/projects/:projectId/status', requireRoles('authority'), async (req, res) => {
  const allowedStatuses = ['Created', 'Active', 'Completed', 'Suspended'];

  try {
    const { status } = req.body;
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid project status' });
    }

    const project = await Project.findOne({ projectId: req.params.projectId });
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const chainReady = await ensureProjectOnChainState(project);
    if (!chainReady.success) {
      return res.status(chainReady.status || 409).json({
        success: false,
        error: chainReady.error,
      });
    }

    const blockchainResult = await updateProjectStatusOnChain(project.projectId, status);
    if (!blockchainResult.success) {
      return res.status(502).json({
        success: false,
        error: `Blockchain transaction failed: ${toUserFriendlyBlockchainError(blockchainResult.error)}`,
      });
    }

    try {
      project.status = status;
      project.blockchainTxHash = blockchainResult.txHash;
      project.blockNumber = blockchainResult.blockNumber || null;
      await project.save();

      return res.json({
        success: true,
        project,
        blockchain: blockchainResult,
        message: chainReady.recovered
          ? `Project was re-synced and status updated to ${status}`
          : `Project status updated to ${status}`,
      });
    } catch (dbError) {
      await enqueueReconciliationTask({
        operation: 'status_update',
        projectId: project.projectId,
        txHash: blockchainResult.txHash,
        payload: {
          projectObjectId: project._id.toString(),
          status,
          blockNumber: blockchainResult.blockNumber || null,
        },
        error: dbError,
      });
      return dbReconciliationResponse(
        res,
        `Status updated on-chain but failed in database: ${dbError.message}`,
        blockchainResult.txHash
      );
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/updateWork', requireRoles('contractor'), async (req, res) => {
  try {
    const { projectId, date, workDescription, materialsUsed, workersCount, amountSpent } = req.body;

    if (!projectId || !workDescription || !amountSpent) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const numericAmount = parseAmount(amountSpent);
    if (numericAmount === null) {
      return res.status(400).json({ success: false, error: 'Invalid amountSpent value' });
    }

    const normalizedDate = date ? new Date(date) : new Date();
    if (Number.isNaN(normalizedDate.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid date value' });
    }

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    if (normalizedDate.getTime() > endOfToday.getTime()) {
      return res.status(400).json({ success: false, error: 'Update date cannot be in the future' });
    }

    const project = await Project.findOne({ projectId });
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    if (!userCanAccessProject(req.user, project)) {
      return res.status(403).json({ success: false, error: 'Only assigned contractor can submit updates' });
    }

    if (project.status !== 'Active') {
      return res.status(400).json({ success: false, error: 'Updates are allowed only for active projects' });
    }

    const releasedUnspent = Math.max(0, Number(project.releasedFund || 0) - Number(project.spentFund || 0));
    if (numericAmount > releasedUnspent) {
      return res.status(400).json({
        success: false,
        error: `Amount exceeds released but unspent funds (${releasedUnspent})`,
      });
    }

    const chainReady = await ensureProjectOnChainState(project);
    if (!chainReady.success) {
      return res.status(chainReady.status || 409).json({
        success: false,
        code: chainReady.code || 'CHAIN_SYNC_REQUIRED',
        error: chainReady.error,
      });
    }

    const updateData = {
      projectId,
      date: normalizedDate.toISOString().slice(0, 10),
      workDescription,
      materialsUsed,
      workersCount,
      amountSpent: numericAmount,
      submittedBy: req.user.name,
      timestamp: Date.now(),
    };
    const dataHash = hashData(updateData);

    const blockchainResult = await logExpenseOnChain(projectId, toWei(numericAmount), dataHash);
    if (!blockchainResult.success) {
      return res.status(502).json({
        success: false,
        error: `Blockchain transaction failed: ${toUserFriendlyBlockchainError(blockchainResult.error)}`,
      });
    }

    let createdUpdate;
    try {
      createdUpdate = await Update.create({
        projectId,
        contractorId: req.user.id,
        date: normalizedDate,
        workDescription,
        materialsUsed: materialsUsed || '',
        workersCount: Number(workersCount) || 0,
        amountSpent: numericAmount,
        submittedBy: req.user.name,
        blockchainTxHash: blockchainResult.txHash,
        blockNumber: blockchainResult.blockNumber || null,
        dataHash: blockchainResult.dataHash,
        blockchainStatus: 'confirmed',
      });

      await Project.updateOne(
        { _id: project._id },
        { $inc: { spentFund: numericAmount } }
      );
    } catch (dbError) {
      await Project.updateOne(
        { _id: project._id },
        { $set: { blockchainStatus: 'reconciliation_required' } }
      ).catch(() => {});
      await enqueueReconciliationTask({
        operation: 'log_expense',
        projectId: project.projectId,
        txHash: blockchainResult.txHash,
        payload: {
          projectObjectId: project._id.toString(),
          update: {
            projectId,
            contractorId: req.user.id,
            date: normalizedDate,
            workDescription,
            materialsUsed: materialsUsed || '',
            workersCount: Number(workersCount) || 0,
            amountSpent: numericAmount,
            submittedBy: req.user.name,
            blockchainTxHash: blockchainResult.txHash,
            blockNumber: blockchainResult.blockNumber || null,
            dataHash: blockchainResult.dataHash,
            blockchainStatus: 'confirmed',
          },
          amountSpent: numericAmount,
        },
        error: dbError,
      });

      return dbReconciliationResponse(
        res,
        `Update recorded on-chain but failed in database: ${dbError.message}`,
        blockchainResult.txHash
      );
    }

    await markDemoStep('submitUpdate');
    return res.status(201).json({
      success: true,
      update: createdUpdate,
      blockchain: blockchainResult,
      message: chainReady.recovered
        ? 'Project was re-synced and update recorded successfully on blockchain and database'
        : 'Update recorded successfully on blockchain and database',
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/updates/:projectId', async (req, res) => {
  try {
    const project = await Project.findOne({ projectId: req.params.projectId });
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    if (!userCanAccessProject(req.user, project)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const updates = await Update.find({ projectId: req.params.projectId }).sort({ createdAt: -1 });
    const updatesJson = updates.map((update) => update.toObject());

    const chainExpensesResult = await getProjectExpensesFromChain(req.params.projectId);
    const chainHashSet = new Set(
      (chainExpensesResult?.expenses || [])
        .map((expense) => String(expense.dataHash || '').toLowerCase())
        .filter(Boolean)
    );

    const normalizedUpdates = updatesJson.map((update) => {
      const dataHash = String(update.dataHash || '').toLowerCase();
      let verification = 'no_data_hash';
      let smartContractVerified = false;

      if (!chainExpensesResult?.success) {
        verification = 'chain_unavailable';
        smartContractVerified = null;
      } else if (!dataHash) {
        verification = 'no_data_hash';
      } else if (chainHashSet.has(dataHash)) {
        verification = 'verified';
        smartContractVerified = true;
      } else {
        verification = 'hash_not_found';
      }

      return {
        ...update,
        smartContractVerified,
        smartContractProof: {
          verification,
          dataHash: update.dataHash || null,
          txHash: update.blockchainTxHash || null,
          blockchainStatus: update.blockchainStatus || null,
        },
      };
    });

    res.json({
      success: true,
      updates: normalizedUpdates,
      blockchainProof: {
        available: !!chainExpensesResult?.success,
        error: chainExpensesResult?.success ? null : chainExpensesResult?.error || 'Unavailable',
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/releaseFunds', requireRoles('authority'), async (req, res) => {
  try {
    if (isDemoModeEnabled()) {
      return res.status(403).json({
        success: false,
        error: 'Direct release is disabled in demo mode. Use Request -> Accept -> Release flow.',
      });
    }

    const { projectId, amount } = req.body;

    if (!projectId || !amount) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const numericAmount = parseAmount(amount);
    if (numericAmount === null) {
      return res.status(400).json({ success: false, error: 'Invalid amount value' });
    }

    const project = await Project.findOne({ projectId });
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    if (project.status !== 'Active') {
      return res.status(400).json({ success: false, error: 'Funds can be released only for active projects' });
    }

    const remaining = Number(project.totalFund) - Number(project.releasedFund || 0);
    if (numericAmount > remaining) {
      return res.status(400).json({ success: false, error: 'Amount exceeds remaining project funds' });
    }

    const chainReady = await ensureProjectOnChainState(project);
    if (!chainReady.success) {
      return res.status(chainReady.status || 409).json({
        success: false,
        code: chainReady.code || 'CHAIN_SYNC_REQUIRED',
        error: chainReady.error,
      });
    }

    const blockchainResult = await releaseFundsOnChain(projectId, toWei(numericAmount));
    if (!blockchainResult.success) {
      return res.status(502).json({
        success: false,
        error: `Blockchain transaction failed: ${toUserFriendlyBlockchainError(blockchainResult.error)}`,
      });
    }

    try {
      await Project.updateOne(
        { _id: project._id },
        {
          $inc: { releasedFund: numericAmount },
          $set: {
            blockchainTxHash: blockchainResult.txHash,
            blockNumber: blockchainResult.blockNumber || null,
            blockchainStatus: 'confirmed',
          },
        }
      );
    } catch (dbError) {
      await Project.updateOne(
        { _id: project._id },
        { $set: { blockchainStatus: 'reconciliation_required' } }
      ).catch(() => {});
      await enqueueReconciliationTask({
        operation: 'release_funds',
        projectId: project.projectId,
        txHash: blockchainResult.txHash,
        payload: {
          projectObjectId: project._id.toString(),
          amount: numericAmount,
          blockNumber: blockchainResult.blockNumber || null,
        },
        error: dbError,
      });

      return dbReconciliationResponse(
        res,
        `Funds released on-chain but failed to update database: ${dbError.message}`,
        blockchainResult.txHash
      );
    }

    return res.json({
      success: true,
      blockchain: blockchainResult,
      message: chainReady.recovered
        ? 'Project was re-synced and funds released on blockchain and database'
        : 'Funds released on blockchain and synced to database',
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/verifyWork', requireRoles('public'), verificationRateLimiter, async (req, res) => {
  try {
    const { projectId, updateId, status, comment } = req.body;

    if (!projectId || !updateId || !status) {
      return res.status(400).json({ success: false, error: 'projectId, updateId and status are required' });
    }

    if (!['Work Done', 'Not Done'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid verification status' });
    }

    const project = await Project.findOne({ projectId });
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const update = await Update.findOne({ _id: updateId, projectId });
    if (!update) {
      return res.status(404).json({ success: false, error: 'Update not found for project' });
    }

    const existing = await Verification.findOne({ userId: req.user.id, updateId });
    if (existing) {
      return res.status(409).json({ success: false, error: 'You have already verified this update' });
    }

    const verification = await Verification.create({
      projectId,
      updateId,
      userId: req.user.id,
      status,
      comment: comment || '',
      verifiedBy: req.user.name,
    });

    const counterField = status === 'Work Done' ? 'verificationCount.workDone' : 'verificationCount.notDone';
    try {
      await Project.updateOne({ _id: project._id }, { $inc: { [counterField]: 1 } });
    } catch (counterError) {
      await Verification.deleteOne({ _id: verification._id }).catch(() => {});
      throw counterError;
    }

    const refreshedProject = await Project.findById(project._id).select('verificationCount');
    await markDemoStep('verifyWork');

    return res.status(201).json({
      success: true,
      verification,
      verificationCount: refreshedProject?.verificationCount,
      message: `Verification submitted: ${status}`,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, error: 'You have already verified this update' });
    }
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/verifications/:projectId', async (req, res) => {
  try {
    const project = await Project.findOne({ projectId: req.params.projectId });
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    if (!userCanAccessProject(req.user, project)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const verifications = await Verification.find({ projectId: req.params.projectId }).sort({ createdAt: -1 });
    res.json({ success: true, verifications });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/projects/:projectId/timeline', async (req, res) => {
  try {
    const project = await Project.findOne({ projectId: req.params.projectId });
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    if (!userCanAccessProject(req.user, project)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const [requests, updates, verifications] = await Promise.all([
      FundingRequest.find({ projectId: req.params.projectId }).sort({ createdAt: 1 }),
      Update.find({ projectId: req.params.projectId }).sort({ createdAt: 1 }),
      Verification.find({ projectId: req.params.projectId }).sort({ createdAt: 1 }),
    ]);

    const events = [];

    events.push({
      key: `project-created-${project.projectId}`,
      type: 'project_created',
      title: 'Project Created',
      actorName: 'Authority',
      actorRole: 'authority',
      amount: project.totalFund,
      txHash: project.blockchainTxHash || '0x... (simulated)',
      chainAction: true,
      timestamp: project.createdAt,
    });

    requests.forEach((request) => {
      events.push({
        key: `request-sent-${request._id}`,
        type: 'request_sent',
        title: 'Request Sent',
        actorName: request.initiatedBy === 'contractor' ? request.contractorName : request.authorityName,
        actorRole: request.initiatedBy,
        amount: request.amount,
        txHash: null,
        chainAction: false,
        timestamp: request.createdAt,
      });

      if (['accepted', 'released'].includes(request.status)) {
        events.push({
          key: `request-accepted-${request._id}`,
          type: 'request_accepted',
          title: 'Request Accepted',
          actorName: request.contractorName,
          actorRole: 'contractor',
          amount: request.amount,
          txHash: null,
          // Acceptance itself is off-chain in this demo flow.
          // We still render it in the proof timeline with simulated tx placeholder.
          chainAction: true,
          timestamp: request.respondedAt || request.updatedAt,
        });
      }

      if (request.status === 'released') {
        events.push({
          key: `request-released-${request._id}`,
          type: 'funds_released',
          title: 'Funds Released',
          actorName: request.authorityName,
          actorRole: 'authority',
          amount: request.amount,
          txHash: request.blockchainTxHash || '0x... (simulated)',
          chainAction: true,
          timestamp: request.releasedAt || request.updatedAt,
        });
      }
    });

    updates.forEach((update) => {
      events.push({
        key: `update-${update._id}`,
        type: 'update_logged',
        title: 'Update Logged',
        actorName: update.submittedBy,
        actorRole: 'contractor',
        amount: update.amountSpent,
        txHash: update.blockchainTxHash || '0x... (simulated)',
        chainAction: true,
        timestamp: update.date || update.createdAt,
      });
    });

    verifications.forEach((verification) => {
      events.push({
        key: `verification-${verification._id}`,
        type: 'public_verified',
        title: `Public Verified (${verification.status})`,
        actorName: verification.verifiedBy,
        actorRole: 'public',
        amount: null,
        txHash: null,
        chainAction: false,
        timestamp: verification.createdAt,
      });
    });

    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return res.json({ success: true, timeline: events });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/reconciliation/pending', requireRoles('authority'), async (req, res) => {
  try {
    const tasks = await ReconciliationTask.find({ syncStatus: 'pending' })
      .sort({ createdAt: -1 })
      .limit(100);

    return res.json({ success: true, tasks });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/reconcile/:id', requireRoles('authority'), async (req, res) => {
  let task = null;
  try {
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      task = await ReconciliationTask.findById(req.params.id);
    }

    if (!task) {
      task = await ReconciliationTask.findOne({
        projectId: req.params.id,
        syncStatus: 'pending',
      }).sort({ createdAt: -1 });
    }

    if (!task) {
      return res.status(404).json({ success: false, error: 'Reconciliation task not found' });
    }

    if (task.syncStatus === 'synced') {
      return res.json({ success: true, task, message: 'Task already synced' });
    }

    if (task.operation === 'create_project') {
      const existing = await Project.findOne({ projectId: task.projectId });
      if (!existing) {
        await Project.create({
          ...task.payload,
          blockchainTxHash: task.txHash,
          blockNumber: Number(task.payload?.blockNumber || 0) || null,
          blockchainStatus: 'confirmed',
        });
      }
    } else if (task.operation === 'log_expense') {
      const existingUpdate = await Update.findOne({ blockchainTxHash: task.txHash });
      if (!existingUpdate) {
        await Update.create(task.payload.update);
        await Project.updateOne(
          { _id: task.payload.projectObjectId },
          { $inc: { spentFund: Number(task.payload.amountSpent || 0) } }
        );
      }
    } else if (task.operation === 'release_funds') {
      const projectSelector = task.payload.projectObjectId
        ? { _id: task.payload.projectObjectId }
        : { projectId: task.projectId };

      await Project.updateOne(
        projectSelector,
        {
          $inc: { releasedFund: Number(task.payload.amount || 0) },
          $set: {
            blockchainTxHash: task.txHash,
            blockNumber: Number(task.payload?.blockNumber || 0) || null,
            blockchainStatus: 'confirmed',
          },
        }
      );

      if (task.payload.requestId) {
        await FundingRequest.updateOne(
          { _id: task.payload.requestId },
          {
            $set: {
              status: 'released',
              blockchainStatus: 'confirmed',
              blockchainTxHash: task.txHash,
              blockNumber: Number(task.payload?.blockNumber || 0) || null,
              releasedAt: new Date(),
            },
          }
        );
      }
    } else if (task.operation === 'status_update') {
      await Project.updateOne(
        { _id: task.payload.projectObjectId },
        {
          $set: {
            status: task.payload.status,
            blockchainTxHash: task.txHash,
            blockNumber: Number(task.payload?.blockNumber || 0) || null,
            blockchainStatus: 'confirmed',
          },
        }
      );
    } else {
      return res.status(400).json({ success: false, error: 'Unsupported reconciliation operation' });
    }

    task.syncStatus = 'synced';
    task.syncedAt = new Date();
    task.syncRetryCount += 1;
    task.lastError = null;
    await task.save();

    return res.json({ success: true, task, message: 'Reconciliation synced successfully' });
  } catch (error) {
    if (task?._id) {
      await ReconciliationTask.updateOne(
        { _id: task._id },
        {
          $set: { lastError: error.message, syncStatus: 'pending' },
          $inc: { syncRetryCount: 1 },
        }
      ).catch(() => {});
    }

    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/demo/progress', async (_req, res) => {
  try {
    if (isDemoModeEnabled()) {
      const progressDoc = await DemoProgress.findOne({ key: 'global' }).lean();
      const progress = progressDoc
        ? {
            createProject: !!progressDoc.createProject,
            sendRequest: !!progressDoc.sendRequest,
            acceptRequest: !!progressDoc.acceptRequest,
            submitUpdate: !!progressDoc.submitUpdate,
            verifyWork: !!progressDoc.verifyWork,
            openBlockchainProof: !!progressDoc.openBlockchainProof,
          }
        : { ...DEFAULT_DEMO_PROGRESS };

      return res.json({ success: true, progress });
    }

    const [projectsCount, requestsCount, acceptedRequestsCount, updatesCount, verificationsCount, proofEventsCount] = await Promise.all([
      Project.countDocuments(),
      FundingRequest.countDocuments(),
      FundingRequest.countDocuments({ status: { $in: ['accepted', 'released'] } }),
      Update.countDocuments(),
      Verification.countDocuments(),
      Project.countDocuments({ blockchainTxHash: { $ne: null } }),
    ]);

    return res.json({
      success: true,
      progress: {
        createProject: projectsCount > 0,
        sendRequest: requestsCount > 0,
        acceptRequest: acceptedRequestsCount > 0,
        submitUpdate: updatesCount > 0,
        verifyWork: verificationsCount > 0,
        openBlockchainProof: proofEventsCount > 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/demo/checklist/reset', requireRoles('authority'), async (_req, res) => {
  try {
    if (!isDemoModeEnabled()) {
      return res.status(403).json({ success: false, error: 'Checklist reset is available only in DEMO_MODE=true' });
    }

    await resetDemoProgress();
    return res.json({ success: true, message: 'Demo checklist reset completed' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/demo/readiness', requireRoles('authority'), async (_req, res) => {
  try {
    const web3Status = getWeb3Status();
    const [authorityUsers, contractorUsers, publicUsers, totalProjects, projectsMissingWallet, pendingReconciliation] =
      await Promise.all([
        User.countDocuments({ role: 'authority' }),
        User.countDocuments({ role: 'contractor' }),
        User.countDocuments({ role: 'public' }),
        Project.countDocuments(),
        Project.countDocuments({
          $or: [{ 'contractor.address': { $exists: false } }, { 'contractor.address': null }, { 'contractor.address': '' }],
        }),
        ReconciliationTask.countDocuments({ syncStatus: 'pending' }),
      ]);

    let checklist = { ...DEFAULT_DEMO_PROGRESS };
    if (isDemoModeEnabled()) {
      const progressDoc = await DemoProgress.findOne({ key: 'global' }).lean();
      if (progressDoc) {
        checklist = {
          createProject: !!progressDoc.createProject,
          sendRequest: !!progressDoc.sendRequest,
          acceptRequest: !!progressDoc.acceptRequest,
          submitUpdate: !!progressDoc.submitUpdate,
          verifyWork: !!progressDoc.verifyWork,
          openBlockchainProof: !!progressDoc.openBlockchainProof,
        };
      }
    }

    const checks = {
      blockchainConnected: !!web3Status.connected,
      contractDeployed: !!web3Status.contractDeployed,
      usersSeeded: authorityUsers > 0 && contractorUsers > 0 && publicUsers > 0,
      projectsSeeded: totalProjects > 0,
      contractorWalletsConfigured: projectsMissingWallet === 0,
      reconciliationClear: pendingReconciliation === 0,
    };

    const blockers = [];
    if (!checks.blockchainConnected) blockers.push('Ganache/Web3 is not connected');
    if (!checks.contractDeployed) blockers.push('Smart contract is not deployed');
    if (!checks.usersSeeded) blockers.push('Demo users are missing (run seed reset)');
    if (!checks.projectsSeeded) blockers.push('Demo projects are missing (run seed reset)');
    if (!checks.contractorWalletsConfigured) blockers.push('Some projects have missing contractor wallet');
    if (!checks.reconciliationClear) blockers.push('Pending reconciliation tasks need retry');

    const completedChecklistSteps = Object.values(checklist).filter(Boolean).length;

    return res.json({
      success: true,
      readiness: {
        checks,
        blockers,
        checklist,
        checklistCompleted: completedChecklistSteps,
        checklistTotal: Object.keys(checklist).length,
        summary: {
          authorityUsers,
          contractorUsers,
          publicUsers,
          totalProjects,
          projectsMissingWallet,
          pendingReconciliation,
        },
        blockchain: {
          ganacheUrl: web3Status.ganacheUrl || null,
          contractAddress: web3Status.contractAddress || null,
          authorityAccount: web3Status.authorityAccount || null,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/demo/reset', requireRoles('authority'), async (req, res) => {
  try {
    if (!isDemoModeEnabled()) {
      return res.status(403).json({ success: false, error: 'Demo reset is available only in DEMO_MODE=true' });
    }

    const summary = await resetDemoData();
    await resetDemoProgress();
    await initWeb3();
    return res.json({
      success: true,
      summary,
      message: 'Demo data reset completed',
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const matchFilter = contractorFilter(req.user);
    const aggregatePrefix = Object.keys(matchFilter).length ? [{ $match: matchFilter }] : [];
    const requestFilter = fundingRequestFilter(req.user);

    const [
      totalProjects,
      activeProjects,
      completedProjects,
      totalFundsResult,
      totalReleasedResult,
      totalSpentResult,
      totalUpdates,
      totalVerifications,
      totalFundingRequests,
      pendingFundingRequests,
      contractorRequestedResult,
      contractorReceivedResult,
      projectsVerifiedByPublic,
    ] = await Promise.all([
      Project.countDocuments(matchFilter),
      Project.countDocuments({ ...matchFilter, status: 'Active' }),
      Project.countDocuments({ ...matchFilter, status: 'Completed' }),
      Project.aggregate([...aggregatePrefix, { $group: { _id: null, total: { $sum: '$totalFund' } } }]),
      Project.aggregate([...aggregatePrefix, { $group: { _id: null, total: { $sum: '$releasedFund' } } }]),
      Project.aggregate([...aggregatePrefix, { $group: { _id: null, total: { $sum: '$spentFund' } } }]),
      Update.countDocuments(req.user.role === 'contractor' ? { contractorId: req.user.id } : {}),
      Verification.countDocuments(req.user.role === 'public' ? { userId: req.user.id } : {}),
      requestFilter ? FundingRequest.countDocuments(requestFilter) : Promise.resolve(0),
      requestFilter ? FundingRequest.countDocuments({ ...requestFilter, status: 'pending' }) : Promise.resolve(0),
      req.user.role === 'contractor'
        ? FundingRequest.aggregate([
            { $match: { contractorId: new mongoose.Types.ObjectId(req.user.id) } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
          ])
        : Promise.resolve([]),
      req.user.role === 'contractor'
        ? FundingRequest.aggregate([
            { $match: { contractorId: new mongoose.Types.ObjectId(req.user.id), status: 'released' } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
          ])
        : Promise.resolve([]),
      req.user.role === 'public'
        ? Verification.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(req.user.id) } },
            { $group: { _id: '$projectId' } },
            { $count: 'total' },
          ])
        : Promise.resolve(0),
    ]);

    const baseStats = {
      totalProjects,
      activeProjects,
      completedProjects,
      totalFunds: totalFundsResult[0]?.total || 0,
      totalReleased: totalReleasedResult[0]?.total || 0,
      totalSpent: totalSpentResult[0]?.total || 0,
      totalUpdates,
      totalVerifications,
      totalFundingRequests,
      pendingFundingRequests,
      totalRequestedByContractor: contractorRequestedResult[0]?.total || 0,
      totalReceivedByContractor: contractorReceivedResult[0]?.total || 0,
      projectsVerifiedByPublic: Array.isArray(projectsVerifiedByPublic)
        ? projectsVerifiedByPublic[0]?.total || 0
        : projectsVerifiedByPublic || 0,
    };

    return res.json({
      success: true,
      stats: {
        ...baseStats,
        roleStats: mapRoleStats(req.user.role, baseStats),
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
