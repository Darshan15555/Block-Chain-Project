require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { initWeb3, getGanacheAccounts, getWeb3Status } = require('../middleware/web3Service');

async function checkMongo() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fund_tracker');
    return { ok: true, message: `Mongo connected: ${mongoose.connection.name}` };
  } catch (error) {
    return { ok: false, message: `Mongo connection failed: ${error.message}` };
  }
}

async function checkBlockchain() {
  try {
    await initWeb3();
    const status = getWeb3Status();
    const accounts = await getGanacheAccounts();

    if (!status.connected) {
      return { ok: false, message: 'Web3 is not connected to Ganache' };
    }

    if (!accounts || accounts.length === 0) {
      return { ok: false, message: 'No Ganache accounts found' };
    }

    if (!status.contractDeployed) {
      return {
        ok: false,
        message: `Contract not deployed at configured address (${status.contractAddress || 'missing'})`,
      };
    }

    const signerInfo = `signerMode=${status.signerMode || 'unknown'}${status.signerAddress ? ` signer=${status.signerAddress}` : ''}`;
    const warningInfo = status.signerWarning ? ` | warning=${status.signerWarning}` : '';

    return {
      ok: true,
      message: `Chain ready: ${status.ganacheUrl}, contract=${status.contractAddress}, accounts=${accounts.length}, ${signerInfo}${warningInfo}`,
    };
  } catch (error) {
    return { ok: false, message: `Blockchain check failed: ${error.message}` };
  }
}

function checkEnv() {
  const required = ['JWT_SECRET', 'MONGODB_URI', 'GANACHE_URL'];
  const optional = ['AUTHORITY_PRIVATE_KEY', 'AUTHORITY_ADDRESS', 'CONTRACT_ADDRESS', 'DEMO_MODE'];

  const missingRequired = required.filter((key) => !process.env[key]);
  const missingOptional = optional.filter((key) => !process.env[key]);

  return {
    ok: missingRequired.length === 0,
    message: missingRequired.length
      ? `Missing required env keys: ${missingRequired.join(', ')}`
      : 'Required env keys are present',
    optionalMissing: missingOptional,
  };
}

async function runDoctor() {
  console.log('Running backend doctor checks...');

  const envResult = checkEnv();
  const mongoResult = await checkMongo();
  const chainResult = await checkBlockchain();

  console.log(`ENV   : ${envResult.ok ? 'OK' : 'FAIL'} - ${envResult.message}`);
  if (envResult.optionalMissing.length) {
    console.log(`ENV   : Optional missing: ${envResult.optionalMissing.join(', ')}`);
  }

  console.log(`MONGO : ${mongoResult.ok ? 'OK' : 'FAIL'} - ${mongoResult.message}`);
  console.log(`CHAIN : ${chainResult.ok ? 'OK' : 'FAIL'} - ${chainResult.message}`);

  await mongoose.connection.close().catch(() => {});

  if (!envResult.ok || !mongoResult.ok || !chainResult.ok) {
    process.exit(1);
  }

  console.log('Doctor checks passed. Backend demo should be ready.');
}

runDoctor().catch(async (error) => {
  console.error('Doctor crashed:', error.message);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
