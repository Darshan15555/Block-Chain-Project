const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { signToken, authenticateToken } = require('../middleware/auth');
const { getGanacheAccounts, getWeb3Status } = require('../middleware/web3Service');

const router = express.Router();
const ALLOWED_ROLES = ['authority', 'contractor', 'public'];
const WALLET_REGEX = /^0x[a-fA-F0-9]{40}$/;

function sanitizeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    username: user.username,
    role: user.role,
    walletAddress: user.walletAddress || null,
    companyName: user.companyName || '',
    email: user.email || null,
  };
}

router.get('/wallet-options', async (_req, res) => {
  try {
    const [accounts, chainStatus] = await Promise.all([
      getGanacheAccounts(),
      Promise.resolve(getWeb3Status()),
    ]);

    const authorityAddress = String(chainStatus.authorityAccount || '').toLowerCase();
    const wallets = (accounts || [])
      .map((item) => String(item || '').trim())
      .filter((item) => WALLET_REGEX.test(item))
      .filter((item) => item.toLowerCase() !== authorityAddress);

    return res.json({
      success: true,
      wallets,
      blockchain: {
        connected: !!chainStatus.connected,
        contractDeployed: !!chainStatus.contractDeployed,
        authorityAccount: chainStatus.authorityAccount || null,
        ganacheUrl: chainStatus.ganacheUrl || null,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/signup', async (req, res) => {
  try {
    const { name, username, password, role, walletAddress, companyName, email } = req.body;
    const normalizedRole = String(role || '').trim().toLowerCase();
    const normalizedUsername = String(username || '').trim().toLowerCase();

    if (!name || !normalizedUsername || !password || !normalizedRole) {
      return res.status(400).json({
        success: false,
        error: 'Name, username, password and role are required',
      });
    }

    if (!ALLOWED_ROLES.includes(normalizedRole)) {
      return res.status(400).json({ success: false, error: 'Invalid role selection' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    const normalizedWallet = walletAddress ? String(walletAddress).trim() : null;
    if (normalizedRole === 'contractor') {
      if (!normalizedWallet || !WALLET_REGEX.test(normalizedWallet)) {
        return res.status(400).json({
          success: false,
          error: 'Contractor signup requires a valid wallet address',
        });
      }
    } else if (normalizedWallet && !WALLET_REGEX.test(normalizedWallet)) {
      return res.status(400).json({ success: false, error: 'Invalid wallet address format' });
    }

    const existing = await User.findOne({ username: normalizedUsername });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: String(name).trim(),
      username: normalizedUsername,
      passwordHash,
      role: normalizedRole,
      walletAddress: normalizedWallet || null,
      companyName: normalizedRole === 'contractor' ? String(companyName || name || '').trim() : '',
      email: email ? String(email).trim().toLowerCase() : null,
    });

    const token = signToken(user);
    return res.status(201).json({
      success: true,
      token,
      user: sanitizeUser(user),
      message: 'Account created successfully',
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, error: 'Username already exists' });
    }
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, username, password, role } = req.body;
    const identifier = String(email || username || '').trim().toLowerCase();

    if (!identifier || !password) {
      return res.status(400).json({ success: false, error: 'Email/username and password are required' });
    }

    const normalizedRole = role ? String(role).trim().toLowerCase() : null;
    if (normalizedRole && !ALLOWED_ROLES.includes(normalizedRole)) {
      return res.status(400).json({ success: false, error: 'Invalid role selection' });
    }

    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const passwordOk = await user.comparePassword(password);
    if (!passwordOk) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    if (normalizedRole && user.role !== normalizedRole) {
      return res.status(403).json({
        success: false,
        error: 'Role mismatch. Select the same role you signed up with.',
      });
    }

    const token = signToken(user);

    return res.json({
      success: true,
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/public-viewer', async (_req, res) => {
  try {
    let user = await User.findOne({ username: 'public_user' });
    if (!user) {
      user = await User.findOne({ role: 'public' });
    }
    if (!user) {
      const passwordHash = await bcrypt.hash('Public@123', 10);
      user = await User.create({
        name: 'Public Viewer',
        username: 'public_user',
        email: 'citizen@public.org',
        passwordHash,
        role: 'public',
      });
    }

    const token = signToken(user);
    return res.json({
      success: true,
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  const fullUser = await User.findById(req.user.id).select('_id name username role walletAddress companyName email');
  if (!fullUser) {
    return res.status(401).json({ success: false, error: 'User not found' });
  }
  return res.json({
    success: true,
    user: sanitizeUser(fullUser),
  });
});

module.exports = router;
