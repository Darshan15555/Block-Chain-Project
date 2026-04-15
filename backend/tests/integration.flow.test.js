const {
  initWeb3,
  createProjectOnChain,
  releaseFundsOnChain,
  logExpenseOnChain,
  getProjectFromChain,
  getWeb3Status,
} = require('../middleware/web3Service');

const RUN_INTEGRATION = process.env.RUN_GANACHE_INTEGRATION === 'true';
const describeIf = RUN_INTEGRATION ? describe : describe.skip;

describeIf('Ganache Integration Flow', () => {
  const testProjectId = `INT-${Date.now()}`;
  const contractorAddress = process.env.TEST_CONTRACTOR_ADDRESS || '0x1234567890123456789012345678901234567890';

  beforeAll(async () => {
    await initWeb3();
  });

  test('create -> release -> log expense -> read details', async () => {
    const status = getWeb3Status();
    expect(status.connected).toBe(true);
    expect(status.contractDeployed).toBe(true);

    const createRes = await createProjectOnChain(testProjectId, contractorAddress, 100n);
    expect(createRes.success).toBe(true);

    const releaseRes = await releaseFundsOnChain(testProjectId, 60n);
    expect(releaseRes.success).toBe(true);

    const logRes = await logExpenseOnChain(testProjectId, 25n, 'integration-test-hash');
    expect(logRes.success).toBe(true);

    const details = await getProjectFromChain(testProjectId);
    expect(details.success).toBe(true);
    expect(details.data.projectId).toBe(testProjectId);
    expect(details.data.releasedFunds).toBe('60');
    expect(details.data.spentFunds).toBe('25');
  }, 60000);
});
