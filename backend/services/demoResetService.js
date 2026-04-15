const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Project = require('../models/Project');
const Update = require('../models/Update');
const Verification = require('../models/Verification');
const FundingRequest = require('../models/FundingRequest');
const ReconciliationTask = require('../models/ReconciliationTask');
const DemoProgress = require('../models/DemoProgress');
const {
  initWeb3,
  createProjectOnChain,
  releaseFundsOnChain,
  logExpenseOnChain,
  getGanacheAccounts,
} = require('../middleware/web3Service');

const BACKEND_ROOT = path.resolve(__dirname, '..');

function readEnvFile() {
  const envPath = path.resolve(BACKEND_ROOT, '.env');
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split(/\r?\n/).filter(Boolean);

  for (const line of lines) {
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    process.env[key] = value;
  }
}

function runBackendScript(fileName) {
  execSync(`node scripts/${fileName}`, {
    cwd: BACKEND_ROOT,
    stdio: 'inherit',
  });
}

async function ensureMongoConnection() {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fund_tracker');
}

function generateProjectId(seed) {
  return `DEMO-${seed}-${Date.now().toString(36).toUpperCase()}`;
}

async function resetDemoData() {
  await ensureMongoConnection();

  // Redeploy so demo always starts with fresh, known contract.
  runBackendScript('compile.js');
  runBackendScript('deploy.js');
  readEnvFile();

  await initWeb3();
  const accounts = await getGanacheAccounts();
  if (!accounts || accounts.length < 4) {
    throw new Error('Ganache must expose at least 4 accounts for demo reset');
  }

  await mongoose.connection.db.dropDatabase();

  const demoUsers = [
    {
      name: 'Central Authority',
      username: 'authority_admin',
      password: 'Authority@123',
      role: 'authority',
      walletAddress: process.env.AUTHORITY_ADDRESS || accounts[0],
    },
    {
      name: 'Contractor1',
      username: 'contractor1',
      password: 'Contractor@123',
      role: 'contractor',
      walletAddress: accounts[1],
    },
    {
      name: 'Contractor2',
      username: 'contractor2',
      password: 'Contractor@123',
      role: 'contractor',
      walletAddress: accounts[2],
    },
    {
      name: 'PublicUser',
      username: 'public_user',
      password: 'Public@123',
      role: 'public',
      walletAddress: null,
    },
  ];

  const createdUsers = {};
  for (const user of demoUsers) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    const created = await User.create({
      name: user.name,
      username: user.username,
      passwordHash,
      role: user.role,
      walletAddress: user.walletAddress,
    });
    createdUsers[user.username] = created;
  }

  const authority = createdUsers.authority_admin;
  const contractor1 = createdUsers.contractor1;
  const contractor2 = createdUsers.contractor2;
  const publicUser = createdUsers.public_user;

  const projectSeeds = [
    {
      id: generateProjectId('NH39'),
      name: 'NH-39 Expansion',
      type: 'Road',
      location: 'Mumbai',
      totalFund: 5000000,
      contractor: contractor1,
    },
    {
      id: generateProjectId('Bridge'),
      name: 'River Bridge Upgrade',
      type: 'Bridge',
      location: 'Pune',
      totalFund: 3000000,
      contractor: contractor2,
    },
    {
      id: generateProjectId('School'),
      name: 'District School Modernization',
      type: 'School',
      location: 'Nashik',
      totalFund: 2000000,
      contractor: contractor1,
    },
  ];

  for (const seed of projectSeeds) {
    const chainRes = await createProjectOnChain(seed.id, seed.contractor.walletAddress, BigInt(seed.totalFund));
    if (!chainRes.success) {
      throw new Error(`Failed to create demo project ${seed.id} on-chain: ${chainRes.error}`);
    }

    await Project.create({
      projectId: seed.id,
      name: seed.name,
      type: seed.type,
      location: seed.location,
      totalFund: seed.totalFund,
      releasedFund: 0,
      spentFund: 0,
      contractor: {
        userId: seed.contractor._id,
        name: seed.contractor.name,
        address: seed.contractor.walletAddress,
        id: seed.contractor.username,
      },
      status: 'Active',
      blockchainTxHash: chainRes.txHash,
      blockchainStatus: 'confirmed',
    });
  }

  const primaryProject = await Project.findOne({ projectId: projectSeeds[0].id });
  const secondaryProject = await Project.findOne({ projectId: projectSeeds[1].id });

  const pendingRequest = await FundingRequest.create({
    projectId: secondaryProject.projectId,
    projectName: secondaryProject.name,
    contractorId: contractor2._id,
    contractorName: contractor2.name,
    authorityId: authority._id,
    authorityName: authority.name,
    amount: 750000,
    note: 'Phase-1 steel procurement',
    initiatedBy: 'authority',
    status: 'pending',
    blockchainStatus: 'pending',
  });

  const acceptedRequest = await FundingRequest.create({
    projectId: primaryProject.projectId,
    projectName: primaryProject.name,
    contractorId: contractor1._id,
    contractorName: contractor1.name,
    authorityId: authority._id,
    authorityName: authority.name,
    amount: 1000000,
    note: 'Initial mobilization release',
    initiatedBy: 'authority',
    status: 'accepted',
    respondedAt: new Date(),
    blockchainStatus: 'pending',
  });

  const releaseRes = await releaseFundsOnChain(primaryProject.projectId, BigInt(acceptedRequest.amount));
  if (!releaseRes.success) {
    throw new Error(`Failed demo release on-chain: ${releaseRes.error}`);
  }

  acceptedRequest.status = 'released';
  acceptedRequest.blockchainTxHash = releaseRes.txHash;
  acceptedRequest.blockNumber = releaseRes.blockNumber || null;
  acceptedRequest.blockchainStatus = 'confirmed';
  acceptedRequest.releasedAt = new Date();
  await acceptedRequest.save();

  primaryProject.releasedFund += acceptedRequest.amount;
  primaryProject.blockchainTxHash = releaseRes.txHash;
  primaryProject.blockchainStatus = 'confirmed';
  await primaryProject.save();

  const expenseHashSeed = {
    projectId: primaryProject.projectId,
    amount: 350000,
    note: 'Foundation work and materials',
    ts: Date.now(),
  };
  const logRes = await logExpenseOnChain(
    primaryProject.projectId,
    BigInt(expenseHashSeed.amount),
    JSON.stringify(expenseHashSeed)
  );
  if (!logRes.success) {
    throw new Error(`Failed demo expense on-chain: ${logRes.error}`);
  }

  await Update.create({
    projectId: primaryProject.projectId,
    contractorId: contractor1._id,
    date: new Date(),
    workDescription: 'Foundation slab and drainage prep completed',
    materialsUsed: 'Cement, Steel, Aggregate',
    workersCount: 42,
    amountSpent: expenseHashSeed.amount,
    submittedBy: contractor1.name,
    blockchainTxHash: logRes.txHash,
    dataHash: logRes.dataHash,
    blockchainStatus: 'confirmed',
  });

  primaryProject.spentFund += expenseHashSeed.amount;
  await primaryProject.save();

  await Verification.create({
    projectId: primaryProject.projectId,
    updateId: (await Update.findOne({ projectId: primaryProject.projectId }).sort({ createdAt: -1 }))._id,
    userId: publicUser._id,
    verifiedBy: publicUser.name,
    status: 'Work Done',
    comment: 'Work visible at site and matches update photos.',
  });

  primaryProject.verificationCount.workDone += 1;
  await primaryProject.save();

  await ReconciliationTask.deleteMany({});
  await DemoProgress.updateOne(
    { key: 'global' },
    {
      $set: {
        createProject: false,
        sendRequest: false,
        acceptRequest: false,
        submitUpdate: false,
        verifyWork: false,
        openBlockchainProof: false,
      },
    },
    { upsert: true }
  );

  return {
    users: await User.countDocuments(),
    projects: await Project.countDocuments(),
    fundingRequests: await FundingRequest.countDocuments(),
    updates: await Update.countDocuments(),
    verifications: await Verification.countDocuments(),
    pendingRequestId: pendingRequest._id.toString(),
    releasedRequestId: acceptedRequest._id.toString(),
  };
}

module.exports = {
  resetDemoData,
};
