require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const { initWeb3 } = require('./middleware/web3Service');
const { ensureDemoUsers } = require('./services/seedUsers');
const authRoutes = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api', projectRoutes);

app.get('/', (_req, res) => {
  res.json({
    message: 'Blockchain Fund Tracker API',
    version: '2.0.0',
    endpoints: {
      'POST /api/auth/login': 'Authenticate user',
      'GET /api/auth/wallet-options': 'Get demo wallet suggestions for contractor signup',
      'GET /api/auth/me': 'Get current user profile',
      'GET /api/blockchain/status': 'Blockchain connection status',
      'POST /api/createProject': 'Create a new project (authority only)',
      'POST /api/updateWork': 'Submit work update (contractor only)',
      'POST /api/releaseFunds': 'Release funds (authority only)',
      'POST /api/verifyWork': 'Verify project update (public only)',
      'PATCH /api/projects/:id/status': 'Update project status (authority only)',
    },
  });
});

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fund_tracker');
    console.log('MongoDB connected to fund_tracker database');

    await ensureDemoUsers();
    console.log('Demo users ensured');

    await initWeb3();

    app.listen(PORT, () => {
      console.log('');
      console.log('+-----------------------------------------------+');
      console.log('|   Blockchain Fund Tracker Backend             |');
      console.log(`|   Server running on port ${PORT}                     |`);
      console.log('+-----------------------------------------------+');
      console.log('');
    });
  } catch (error) {
    console.error('Startup failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
