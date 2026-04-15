require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Web3 } = require('web3');
const fs = require('fs');
const path = require('path');

const web3 = new Web3(process.env.GANACHE_URL || 'http://127.0.0.1:7545');

function upsertEnvVariable(content, key, value) {
  const line = `${key}=${value}`;
  const regex = new RegExp(`^${key}=.*$`, 'm');

  if (regex.test(content)) {
    return content.replace(regex, line);
  }

  const separator = content.endsWith('\n') || content.length === 0 ? '' : '\n';
  return `${content}${separator}${line}\n`;
}

async function deploy() {
  try {
    const buildPath = path.resolve(__dirname, '../build/FundTracking.json');
    if (!fs.existsSync(buildPath)) {
      console.error('Build file not found. Run "npm run compile" first.');
      process.exit(1);
    }

    const { abi, bytecode } = JSON.parse(fs.readFileSync(buildPath, 'utf8'));

    const accounts = await web3.eth.getAccounts();
    if (!accounts || accounts.length === 0) {
      console.error('No Ganache accounts found. Start Ganache and retry.');
      process.exit(1);
    }

    const deployerAccount = accounts[0];

    console.log('Deploying FundTracking contract...');
    console.log(`Deployer: ${deployerAccount}`);

    const contract = new web3.eth.Contract(abi);
    const deployTx = contract.deploy({ data: `0x${bytecode}` });

    const gasEstimate = await deployTx.estimateGas({ from: deployerAccount });
    console.log(`Estimated gas: ${gasEstimate}`);

    const deployedContract = await deployTx.send({
      from: deployerAccount,
      gas: Math.floor(Number(gasEstimate) * 1.2),
    });

    const contractAddress = deployedContract.options.address;
    console.log(`Contract deployed at: ${contractAddress}`);

    const envPath = path.resolve(__dirname, '../.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    envContent = upsertEnvVariable(envContent, 'CONTRACT_ADDRESS', contractAddress);
    envContent = upsertEnvVariable(envContent, 'AUTHORITY_ADDRESS', deployerAccount);
    fs.writeFileSync(envPath, envContent, 'utf8');

    console.log('.env updated with contract and authority address.');
    console.log('IMPORTANT: Set AUTHORITY_PRIVATE_KEY in backend/.env from Ganache account key.');

    const buildData = JSON.parse(fs.readFileSync(buildPath, 'utf8'));
    buildData.address = contractAddress;
    buildData.deployerAccount = deployerAccount;
    fs.writeFileSync(buildPath, JSON.stringify(buildData, null, 2));

    console.log('Deployment completed. Backend is ready to start.');
  } catch (error) {
    console.error('Deployment failed:', error.message);
    process.exit(1);
  }
}

deploy();
