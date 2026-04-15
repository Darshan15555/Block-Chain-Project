import { useEffect, useState } from 'react';
import { api } from '../utils/api';

const ROLE_OPTIONS = [
  {
    id: 'authority',
    name: 'Authority',
    desc: 'Create projects, send funding requests, release project funds',
    icon: 'A',
  },
  {
    id: 'contractor',
    name: 'Contractor',
    desc: 'Receive requests, accept/reject, submit updates',
    icon: 'C',
  },
  {
    id: 'public',
    name: 'Public User',
    desc: 'View projects and verify works',
    icon: 'P',
  },
];

function roleName(role) {
  return ROLE_OPTIONS.find((option) => option.id === role)?.name || 'Role';
}

const WALLET_REGEX = /^0x[a-fA-F0-9]{40}$/;

export default function LoginPage({ onLogin, showToast }) {
  const [mode, setMode] = useState('login');
  const [selectedRole, setSelectedRole] = useState('authority');
  const [loading, setLoading] = useState(false);
  const [walletOptions, setWalletOptions] = useState([]);
  const [walletOptionsLoading, setWalletOptionsLoading] = useState(false);
  const [walletInfo, setWalletInfo] = useState({
    connected: false,
    contractDeployed: false,
    ganacheUrl: null,
  });
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: '',
  });
  const [signupForm, setSignupForm] = useState({
    name: '',
    username: '',
    password: '',
    walletAddress: '',
  });

  useEffect(() => {
    let active = true;

    if (mode !== 'signup' || selectedRole !== 'contractor') {
      setWalletOptions([]);
      return () => {
        active = false;
      };
    }

    setWalletOptionsLoading(true);
    api.getWalletOptions()
      .then((response) => {
        if (!active) return;
        setWalletOptions(response.data.wallets || []);
        setWalletInfo(response.data.blockchain || {});
      })
      .catch(() => {
        if (!active) return;
        setWalletOptions([]);
        setWalletInfo({
          connected: false,
          contractDeployed: false,
          ganacheUrl: null,
        });
      })
      .finally(() => {
        if (active) setWalletOptionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [mode, selectedRole]);

  const handleLogin = async (event) => {
    event.preventDefault();
    if (!loginForm.username || !loginForm.password) {
      showToast('Enter username and password', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await api.login({
        role: selectedRole,
        username: loginForm.username,
        password: loginForm.password,
      });
      onLogin(response.data);
      showToast(`${roleName(selectedRole)} login successful`, 'success');
    } catch (error) {
      showToast(error.response?.data?.error || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (event) => {
    event.preventDefault();
    if (!signupForm.name || !signupForm.username || !signupForm.password) {
      showToast('Fill all required signup fields', 'error');
      return;
    }

    if (selectedRole === 'contractor' && !signupForm.walletAddress) {
      showToast('Contractor signup requires wallet address', 'error');
      return;
    }

    if (signupForm.walletAddress && !WALLET_REGEX.test(signupForm.walletAddress.trim())) {
      showToast('Wallet address must be a valid 0x... Ethereum address', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await api.signup({
        role: selectedRole,
        name: signupForm.name,
        username: signupForm.username,
        password: signupForm.password,
        walletAddress: signupForm.walletAddress || null,
      });
      onLogin(response.data);
      showToast('Signup successful', 'success');
    } catch (error) {
      showToast(error.response?.data?.error || 'Signup failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-grid" />
      <div className="login-bg-glow" />
      <div className="login-card login-card-wide">
        <div className="login-logo">BlockFund</div>
        <div className="login-tagline">Blockchain-Based Transparent Infrastructure Fund Tracking</div>
        <div
          style={{
            width: '100%',
            marginBottom: 14,
            textAlign: 'left',
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, marginBottom: 4 }}>
            Quick Demo Login Guide
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            1. Select role first. 2. Login with that role credentials. 3. Follow on-screen checklist.
          </div>
        </div>

        <div className="auth-switch">
          <button
            type="button"
            className={`auth-switch-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => setMode('login')}
          >
            Login
          </button>
          <button
            type="button"
            className={`auth-switch-btn ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => setMode('signup')}
          >
            Sign Up
          </button>
        </div>

        <div className="login-roles" style={{ width: '100%', marginBottom: 14 }}>
          {ROLE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`role-btn ${selectedRole === option.id ? 'selected' : ''}`}
              onClick={() => setSelectedRole(option.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20, fontWeight: 700 }}>{option.icon}</span>
                <div style={{ textAlign: 'left' }}>
                  <div className="role-name">{option.name}</div>
                  <div className="role-desc">{option.desc}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleLogin} style={{ width: '100%' }}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                className="form-input"
                value={loginForm.username}
                onChange={(event) => setLoginForm((prev) => ({ ...prev, username: event.target.value }))}
                placeholder="Enter username"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                value={loginForm.password}
                onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="Enter password"
              />
            </div>
            <button className="login-enter-btn" type="submit" disabled={loading}>
              {loading ? 'Signing in...' : `Login as ${roleName(selectedRole)}`}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignup} style={{ width: '100%' }}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                value={signupForm.name}
                onChange={(event) => setSignupForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Your full name"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  className="form-input"
                  value={signupForm.username}
                  onChange={(event) => setSignupForm((prev) => ({ ...prev, username: event.target.value }))}
                  placeholder="Choose username"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  className="form-input"
                  type="password"
                  value={signupForm.password}
                  onChange={(event) => setSignupForm((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder="Minimum 6 characters"
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">
                Wallet Address {selectedRole === 'contractor' ? '*' : '(Optional)'}
              </label>
              <input
                className="form-input"
                value={signupForm.walletAddress}
                onChange={(event) => setSignupForm((prev) => ({ ...prev, walletAddress: event.target.value }))}
                placeholder="0x..."
              />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textAlign: 'left' }}>
                {selectedRole === 'contractor'
                  ? 'Required: authority releases funds to this wallet on blockchain.'
                  : 'Optional for this role.'}
              </div>
            </div>
            {selectedRole === 'contractor' && (
              <div className="form-group">
                <label className="form-label">Pick Ganache Wallet (Demo)</label>
                <select
                  className="form-select"
                  value={walletOptions.includes(signupForm.walletAddress) ? signupForm.walletAddress : ''}
                  onChange={(event) => setSignupForm((prev) => ({ ...prev, walletAddress: event.target.value }))}
                  disabled={walletOptionsLoading}
                >
                  <option value="">
                    {walletOptionsLoading
                      ? 'Loading local wallets...'
                      : walletOptions.length > 0
                        ? 'Select a local Ganache wallet'
                        : 'No wallet options found'}
                  </option>
                  {walletOptions.map((wallet) => (
                    <option key={wallet} value={wallet}>
                      {wallet}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textAlign: 'left' }}>
                  {walletInfo.connected
                    ? `Ganache connected${walletInfo.ganacheUrl ? ` on ${walletInfo.ganacheUrl}` : ''}.`
                    : 'Start Ganache to auto-load local demo wallet options.'}
                </div>
              </div>
            )}
            <button className="login-enter-btn" type="submit" disabled={loading}>
              {loading ? 'Creating account...' : `Sign Up as ${roleName(selectedRole)}`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
