const request = require('supertest');
const express = require('express');

jest.mock('../models/Project', () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  updateOne: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
  findById: jest.fn(),
}));

jest.mock('../models/Update', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
}));

jest.mock('../models/Verification', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  deleteOne: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
}));

jest.mock('../models/User', () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
  countDocuments: jest.fn(),
}));

jest.mock('../models/FundingRequest', () => ({
  create: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
  updateOne: jest.fn(),
}));

jest.mock('../models/ReconciliationTask', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  updateOne: jest.fn(),
  countDocuments: jest.fn(),
}));

jest.mock('../models/DemoProgress', () => ({
  updateOne: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, _res, next) => {
    const role = req.headers['x-role'] || 'authority';
    req.user = {
      id: '507f1f77bcf86cd799439011',
      role,
      name: role === 'public' ? 'Public Citizen' : 'Central Authority',
      username: role,
      walletAddress: null,
    };
    next();
  },
  requireRoles: (...roles) => (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    return next();
  },
}));

jest.mock('../middleware/web3Service', () => ({
  createProjectOnChain: jest.fn(),
  logExpenseOnChain: jest.fn(),
  releaseFundsOnChain: jest.fn(),
  updateProjectStatusOnChain: jest.fn(),
  getProjectFromChain: jest.fn(),
  getProjectExpensesFromChain: jest.fn(),
  getContractEvents: jest.fn().mockResolvedValue({ success: true, events: [] }),
  getTransactionReceipts: jest.fn().mockResolvedValue({ success: true, receipts: [] }),
  getGanacheAccounts: jest.fn().mockResolvedValue([]),
  getWeb3Status: jest.fn().mockReturnValue({ connected: false, contractDeployed: false }),
}));

const projectRoutes = require('../routes/projectRoutes');
const Project = require('../models/Project');
const Update = require('../models/Update');
const Verification = require('../models/Verification');
const User = require('../models/User');
const FundingRequest = require('../models/FundingRequest');
const DemoProgress = require('../models/DemoProgress');
const ReconciliationTask = require('../models/ReconciliationTask');
const web3Service = require('../middleware/web3Service');

describe('Project Routes', () => {
  const app = express();
  app.use(express.json());
  app.use('/api', projectRoutes);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /api/createProject blocks non-authority roles', async () => {
    const res = await request(app)
      .post('/api/createProject')
      .set('x-role', 'contractor')
      .send({
        name: 'Road Expansion',
        location: 'City A',
        totalFund: 1000,
        contractorId: '507f1f77bcf86cd799439011',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/createProject returns 502 when blockchain call fails', async () => {
    User.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439012',
        name: 'Contractor',
        username: 'contractor_1',
        walletAddress: '0x1234567890123456789012345678901234567890',
      }),
    });

    web3Service.createProjectOnChain.mockResolvedValue({
      success: false,
      error: 'transaction reverted',
    });

    const res = await request(app)
      .post('/api/createProject')
      .set('x-role', 'authority')
      .send({
        name: 'Road Expansion',
        type: 'Road',
        location: 'City A',
        totalFund: 1000,
        contractorId: '507f1f77bcf86cd799439012',
      });

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/blockchain/audit returns on-chain event ledger entries', async () => {
    Project.find
      .mockReturnValueOnce({
        select: jest.fn().mockResolvedValue([
          {
            projectId: 'P1',
            name: 'Water',
            contractor: { name: 'C1', address: '0xabc' },
          },
        ]),
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

    Update.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([]),
        }),
      }),
    });

    FundingRequest.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([]),
        }),
      }),
    });

    ReconciliationTask.countDocuments.mockResolvedValue(0);
    web3Service.getWeb3Status.mockReturnValue({
      connected: true,
      contractDeployed: true,
      contractAddress: '0xcontract',
      authorityAccount: '0xauthority',
      signerAddress: '0xauthority',
      signerMode: 'rpc_unlocked',
      ganacheUrl: 'http://127.0.0.1:7545',
    });
    web3Service.getContractEvents.mockResolvedValue({
      success: true,
      events: [
        {
          event: 'FundsReleased',
          txHash: '0xtx',
          blockNumber: 12,
          logIndex: 0,
          blockTimestamp: 1712851200,
          returnValues: {
            projectId: 'P1',
            amount: '2000',
            contractorAddress: '0xabc',
          },
        },
      ],
    });

    const res = await request(app)
      .get('/api/blockchain/audit')
      .set('x-role', 'public');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.totals.releaseTransactions).toBe(1);
    expect(res.body.txFeed[0].actionLabel).toBe('Funds Released');
    expect(res.body.txFeed[0].source).toBe('chain');
    expect(res.body.txFeed[0].blockNumber).toBe(12);
  });

  test('POST /api/verifyWork prevents duplicate verification for same update', async () => {
    Project.findOne.mockResolvedValue({ _id: '507f1f77bcf86cd799439013', projectId: 'P1' });
    Update.findOne.mockResolvedValue({ _id: '507f1f77bcf86cd799439014', projectId: 'P1' });
    Verification.findOne.mockResolvedValue({ _id: 'existing' });

    const res = await request(app)
      .post('/api/verifyWork')
      .set('x-role', 'public')
      .send({
        projectId: 'P1',
        updateId: '507f1f77bcf86cd799439014',
        status: 'Work Done',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  test('PATCH /api/projects/:projectId/status auto-syncs project when missing on current chain', async () => {
    const projectDoc = {
      _id: '507f1f77bcf86cd799439080',
      projectId: 'P1',
      status: 'Active',
      totalFund: 100000,
      releasedFund: 0,
      spentFund: 0,
      contractor: { address: '0x1234567890123456789012345678901234567890' },
      blockchainTxHash: '0xold',
      save: jest.fn().mockResolvedValue(true),
    };
    Project.findOne.mockResolvedValue(projectDoc);
    Project.updateOne.mockResolvedValue({ acknowledged: true, modifiedCount: 1 });
    web3Service.getProjectFromChain.mockResolvedValue({
      success: false,
      error: 'project does not exist',
    });
    web3Service.createProjectOnChain.mockResolvedValue({
      success: true,
      txHash: '0xsync',
      blockNumber: 21,
    });
    web3Service.updateProjectStatusOnChain.mockResolvedValue({
      success: true,
      txHash: '0xstatus',
      blockNumber: 22,
    });

    const res = await request(app)
      .patch('/api/projects/P1/status')
      .set('x-role', 'authority')
      .send({ status: 'Completed' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/re-synced and status updated/i);
    expect(web3Service.createProjectOnChain).toHaveBeenCalled();
    expect(web3Service.updateProjectStatusOnChain).toHaveBeenCalledWith('P1', 'Completed');
    expect(projectDoc.status).toBe('Completed');
    expect(projectDoc.save).toHaveBeenCalled();
  });

  test('PATCH /api/contract-requests/:id/respond accepts a pending request', async () => {
    const requestDoc = {
      _id: 'req1',
      contractorId: '507f1f77bcf86cd799439011',
      initiatedBy: 'authority',
      status: 'pending',
      responseNote: '',
      respondedAt: null,
      blockchainStatus: 'pending',
      save: jest.fn().mockResolvedValue(true),
    };
    FundingRequest.findOne.mockResolvedValue(requestDoc);

    const res = await request(app)
      .patch('/api/contract-requests/req1/respond')
      .set('x-role', 'contractor')
      .send({ action: 'accept', responseNote: 'Proceeding' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(requestDoc.status).toBe('accepted');
    expect(requestDoc.save).toHaveBeenCalled();
  });

  test('PATCH /api/contract-requests/:id/respond blocks contractor-initiated requests', async () => {
    FundingRequest.findOne.mockResolvedValue({
      _id: 'req-self',
      contractorId: '507f1f77bcf86cd799439011',
      initiatedBy: 'contractor',
      status: 'pending',
    });

    const res = await request(app)
      .patch('/api/contract-requests/req-self/respond')
      .set('x-role', 'contractor')
      .send({ action: 'accept' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/authority-initiated/i);
  });

  test('POST /api/contract-requests/:id/release blocks release when request is not accepted', async () => {
    FundingRequest.findOne.mockResolvedValue({
      _id: 'req2',
      authorityId: '507f1f77bcf86cd799439011',
      status: 'pending',
    });

    const res = await request(app)
      .post('/api/contract-requests/req2/release')
      .set('x-role', 'authority')
      .send();

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/only after contractor acceptance/i);
  });

  test('POST /api/contract-requests/raise blocks deprecated submit-update flow payload', async () => {
    const res = await request(app)
      .post('/api/contract-requests/raise')
      .set('x-role', 'contractor')
      .send({
        projectId: 'P1',
        amount: 1000,
        note: 'Fund request raised from submit-update screen (13/04/2026)',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/deprecated request flow/i);
    expect(Project.findOne).not.toHaveBeenCalled();
  });

  test('POST /api/updateWork blocks expense when released balance is zero', async () => {
    Project.findOne.mockResolvedValue({
      _id: '507f1f77bcf86cd799439099',
      projectId: 'P1',
      status: 'Active',
      releasedFund: 0,
      spentFund: 0,
      contractor: { userId: '507f1f77bcf86cd799439011' },
    });

    const res = await request(app)
      .post('/api/updateWork')
      .set('x-role', 'contractor')
      .send({
        projectId: 'P1',
        date: '2026-04-13',
        workDescription: 'Initial work log',
        materialsUsed: 'Pipe',
        workersCount: 5,
        amountSpent: 10000,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/released but unspent funds/i);
    expect(web3Service.logExpenseOnChain).not.toHaveBeenCalled();
  });

  test('POST /api/updateWork rejects future date values', async () => {
    const farFutureDate = '2099-01-01';

    const res = await request(app)
      .post('/api/updateWork')
      .set('x-role', 'contractor')
      .send({
        projectId: 'P1',
        date: farFutureDate,
        workDescription: 'Initial work log',
        amountSpent: 1000,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/cannot be in the future/i);
    expect(Project.findOne).not.toHaveBeenCalled();
  });

  test('GET /api/updates/:projectId returns smart-contract proof metadata', async () => {
    Project.findOne.mockResolvedValue({ projectId: 'P1', status: 'Active' });
    Update.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([
        {
          _id: 'upd1',
          projectId: 'P1',
          amountSpent: 1000,
          dataHash: '0xabc123',
          blockchainTxHash: '0xtx',
          blockchainStatus: 'confirmed',
          toObject() {
            return {
              _id: this._id,
              projectId: this.projectId,
              amountSpent: this.amountSpent,
              dataHash: this.dataHash,
              blockchainTxHash: this.blockchainTxHash,
              blockchainStatus: this.blockchainStatus,
            };
          },
        },
      ]),
    });
    web3Service.getProjectExpensesFromChain.mockResolvedValue({
      success: true,
      expenses: [{ dataHash: '0xabc123', amount: '1000', timestamp: '1710000000' }],
    });

    const res = await request(app)
      .get('/api/updates/P1')
      .set('x-role', 'authority');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.updates[0].smartContractVerified).toBe(true);
    expect(res.body.updates[0].smartContractProof.verification).toBe('verified');
  });

  test('GET /api/demo/progress returns tracked checklist state in demo mode', async () => {
    const prevDemoMode = process.env.DEMO_MODE;
    process.env.DEMO_MODE = 'true';
    DemoProgress.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        key: 'global',
        createProject: true,
        sendRequest: true,
        acceptRequest: false,
        submitUpdate: false,
        verifyWork: false,
      }),
    });

    const res = await request(app)
      .get('/api/demo/progress')
      .set('x-role', 'authority');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.progress.createProject).toBe(true);
    expect(res.body.progress.sendRequest).toBe(true);
    expect(res.body.progress.acceptRequest).toBe(false);
    expect(res.body.progress.openBlockchainProof).toBe(false);

    process.env.DEMO_MODE = prevDemoMode;
  });

  test('GET /api/stats returns contractor-specific roleStats payload', async () => {
    Project.countDocuments.mockResolvedValue(2);
    Project.aggregate
      .mockResolvedValueOnce([{ total: 1000000 }])
      .mockResolvedValueOnce([{ total: 400000 }])
      .mockResolvedValueOnce([{ total: 200000 }]);
    Update.countDocuments.mockResolvedValue(3);
    Verification.countDocuments.mockResolvedValue(0);
    FundingRequest.countDocuments.mockResolvedValue(4);
    FundingRequest.aggregate
      .mockResolvedValueOnce([{ total: 550000 }])
      .mockResolvedValueOnce([{ total: 250000 }]);

    const res = await request(app)
      .get('/api/stats')
      .set('x-role', 'contractor');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.stats.roleStats.projectsAssigned).toBe(2);
    expect(res.body.stats.roleStats.totalFundsRequested).toBe(550000);
    expect(res.body.stats.roleStats.totalFundsReceived).toBe(250000);
  });

  test('GET /api/stats returns public-specific roleStats payload', async () => {
    Project.countDocuments.mockResolvedValue(5);
    Project.aggregate
      .mockResolvedValueOnce([{ total: 3000000 }])
      .mockResolvedValueOnce([{ total: 1000000 }])
      .mockResolvedValueOnce([{ total: 650000 }]);
    Update.countDocuments.mockResolvedValue(7);
    Verification.countDocuments.mockResolvedValue(4);
    Verification.aggregate.mockResolvedValue([{ total: 2 }]);

    const res = await request(app)
      .get('/api/stats')
      .set('x-role', 'public');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.stats.roleStats.projectsVerified).toBe(2);
    expect(res.body.stats.roleStats.totalFundsTracked).toBe(3000000);
  });

  test('GET /api/demo/readiness returns blocker list and summary', async () => {
    User.countDocuments
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    Project.countDocuments
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1);
    ReconciliationTask.countDocuments.mockResolvedValue(2);
    DemoProgress.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        key: 'global',
        createProject: true,
        sendRequest: false,
        acceptRequest: false,
        submitUpdate: false,
        verifyWork: false,
      }),
    });
    web3Service.getWeb3Status.mockReturnValue({
      connected: true,
      contractDeployed: false,
      contractAddress: null,
      authorityAccount: null,
      ganacheUrl: 'http://127.0.0.1:7545',
    });

    const prevDemoMode = process.env.DEMO_MODE;
    process.env.DEMO_MODE = 'true';

    const res = await request(app)
      .get('/api/demo/readiness')
      .set('x-role', 'authority');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.readiness.summary.totalProjects).toBe(3);
    expect(res.body.readiness.summary.pendingReconciliation).toBe(2);
    expect(res.body.readiness.checks.contractDeployed).toBe(false);
    expect(res.body.readiness.blockers.length).toBeGreaterThan(0);

    process.env.DEMO_MODE = prevDemoMode;
  });

  test('POST /api/demo/checklist/reset works in demo mode', async () => {
    const prevDemoMode = process.env.DEMO_MODE;
    process.env.DEMO_MODE = 'true';
    DemoProgress.updateOne.mockResolvedValue({ acknowledged: true, modifiedCount: 1 });

    const res = await request(app)
      .post('/api/demo/checklist/reset')
      .set('x-role', 'authority');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(DemoProgress.updateOne).toHaveBeenCalled();

    process.env.DEMO_MODE = prevDemoMode;
  });
});
