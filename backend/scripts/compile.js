const fs = require('fs');
const path = require('path');
const solc = require('solc');

const contractPath = path.resolve(__dirname, '../contracts/FundTracking.sol');
const contractSource = fs.readFileSync(contractPath, 'utf8');

const input = {
  language: 'Solidity',
  sources: {
    'FundTracking.sol': {
      content: contractSource,
    },
  },
  settings: {
    evmVersion: 'paris',
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode'],
      },
    },
  },
};

console.log('Compiling FundTracking.sol...');
const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
  for (const err of output.errors) {
    if (err.severity === 'error') {
      console.error('Compilation error:', err.formattedMessage);
      process.exit(1);
    }
    console.warn('Compiler warning:', err.formattedMessage);
  }
}

const contract = output.contracts['FundTracking.sol']['FundTracking'];
const abi = contract.abi;
const bytecode = contract.evm.bytecode.object;

const buildDir = path.resolve(__dirname, '../build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

const outPath = path.resolve(buildDir, 'FundTracking.json');
fs.writeFileSync(outPath, JSON.stringify({ abi, bytecode }, null, 2), 'utf8');

console.log('Contract compiled successfully.');
console.log(`ABI and bytecode saved to: ${outPath}`);
