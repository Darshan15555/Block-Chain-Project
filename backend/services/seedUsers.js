const bcrypt = require('bcryptjs');
const User = require('../models/User');

const DEMO_USERS = [
  {
    name: 'Central Authority',
    username: 'authority_admin',
    password: 'Authority@123',
    role: 'authority',
    walletAddress: process.env.AUTHORITY_ADDRESS || '0x121077538f6d6ed13538bbfb6f112fb25b01411b',
  },
  {
    name: 'Contractor1',
    username: 'contractor1',
    password: 'Contractor@123',
    role: 'contractor',
    walletAddress: '0x1234567890123456789012345678901234567890',
  },
  {
    name: 'Contractor2',
    username: 'contractor2',
    password: 'Contractor@123',
    role: 'contractor',
    walletAddress: '0x2345678901234567890123456789012345678901',
  },
  {
    name: 'PublicUser',
    username: 'public_user',
    password: 'Public@123',
    role: 'public',
    walletAddress: null,
  },
];

async function ensureDemoUsers() {
  for (const demoUser of DEMO_USERS) {
    const existing = await User.findOne({ username: demoUser.username });
    if (existing) {
      continue;
    }

    const passwordHash = await bcrypt.hash(demoUser.password, 10);
    await User.create({
      name: demoUser.name,
      username: demoUser.username,
      passwordHash,
      role: demoUser.role,
      walletAddress: demoUser.walletAddress,
    });
  }
}

module.exports = {
  ensureDemoUsers,
  DEMO_USERS,
};
