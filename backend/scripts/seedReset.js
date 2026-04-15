require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { resetDemoData } = require('../services/demoResetService');

async function run() {
  try {
    const summary = await resetDemoData();
    console.log('Demo reset completed:', summary);
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Demo reset failed:', error.message);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
}

run();
