import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import BlockFundLogo from '../components/BlockFundLogo';

const ROLE_OPTIONS = [
  {
    id: 'authority',
    name: 'Authority',
    desc: 'Create projects, release milestone funds, supervise audits',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    id: 'contractor',
    name: 'Contractor',
    desc: 'Receive fund requests, submit proof of work, track disbursements',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
  },
  {
    id: 'public',
    name: 'Public Citizen',
    desc: 'Browse projects, inspect blockchain proof, cast verification votes',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

const WALLET_REGEX = /^0x[a-fA-F0-9]{40}$/;

const DEMO_PRESETS = [
  {
    label: 'Authority Admin',
    role: 'authority',
    email: 'authority@blockfund.gov',
    password: 'Authority@123',
    badge: 'Gov Authority',
    color: '#6366f1',
  },
  {
    label: 'Apex Contractor',
    role: 'contractor',
    email: 'contractor1@apexinfra.com',
    password: 'Contractor@123',
    badge: 'Contractor',
    color: '#f59e0b',
  },
  {
    label: 'Public Citizen',
    role: 'public',
    email: 'citizen@public.org',
    password: 'Public@123',
    badge: 'Citizen',
    color: '#10b981',
  },
];

export default function LoginPage({ onLogin, showToast, onBackToHome }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('authority@blockfund.gov');
  const [loginPassword, setLoginPassword] = useState('Authority@123');

  // Sign up form state
  const [selectedRole, setSelectedRole] = useState('authority');
  const [signupForm, setSignupForm] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    companyName: '',
    walletAddress: '',
  });

  // Ganache wallet helper
  const [walletOptions, setWalletOptions] = useState([]);
  const [walletOptionsLoading, setWalletOptionsLoading] = useState(false);
  const [walletInfo, setWalletInfo] = useState({
    connected: false,
    contractDeployed: false,
    ganacheUrl: null,
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
      .then((res) => {
        if (!active) return;
        setWalletOptions(res.data?.wallets || []);
        setWalletInfo(res.data?.blockchain || {});
      })
      .catch(() => {
        if (!active) return;
        setWalletOptions([]);
      })
      .finally(() => {
        if (active) setWalletOptionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [mode, selectedRole]);

  // Handle Login
  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    const identifier = loginEmail.trim();
    if (!identifier || !loginPassword) {
      showToast('Please enter your email/username and password', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await api.login({
        email: identifier,
        password: loginPassword,
      });
      showToast(`Welcome back, ${res.data?.user?.name || 'User'}!`, 'success');
      onLogin(res.data);
    } catch (err) {
      showToast(err.response?.data?.error || 'Authentication failed. Please check your credentials.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle Quick Demo Fill
  const handleQuickDemo = (preset) => {
    setLoginEmail(preset.email);
    setLoginPassword(preset.password);
    showToast(`Loaded ${preset.label} credentials`, 'info');
  };

  // Handle One-Click Public Viewer Access
  const handlePublicViewerAccess = async () => {
    setLoading(true);
    try {
      const res = await api.loginPublicViewer();
      showToast('Signed in as Public Viewer with read-only audit access', 'success');
      onLogin(res.data);
    } catch (err) {
      // Fallback to logging in with default citizen credentials
      try {
        const fallbackRes = await api.login({
          email: 'citizen@public.org',
          password: 'Public@123',
        });
        showToast('Signed in as Public Viewer', 'success');
        onLogin(fallbackRes.data);
      } catch (fbErr) {
        showToast(err.response?.data?.error || fbErr.response?.data?.error || 'Could not launch Public Viewer', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Signup
  const handleSignup = async (e) => {
    e.preventDefault();
    if (!signupForm.name.trim() || !signupForm.username.trim() || !signupForm.password) {
      showToast('Please fill out all required fields', 'error');
      return;
    }

    if (signupForm.password.length < 6) {
      showToast('Password must be at least 6 characters long', 'error');
      return;
    }

    if (selectedRole === 'contractor' && !signupForm.walletAddress.trim()) {
      showToast('Contractor accounts require a valid Ethereum wallet address', 'error');
      return;
    }

    if (signupForm.walletAddress && !WALLET_REGEX.test(signupForm.walletAddress.trim())) {
      showToast('Wallet address must be a valid 0x... 40-character Ethereum address', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await api.signup({
        role: selectedRole,
        name: signupForm.name.trim(),
        email: signupForm.email.trim() || null,
        username: signupForm.username.trim().toLowerCase(),
        password: signupForm.password,
        companyName: selectedRole === 'contractor' ? (signupForm.companyName.trim() || signupForm.name.trim()) : '',
        walletAddress: signupForm.walletAddress.trim() || null,
      });
      showToast('Account successfully created!', 'success');
      onLogin(res.data);
    } catch (err) {
      showToast(err.response?.data?.error || 'Registration failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bf-auth-page">
      {/* Background ambient lighting */}
      <div className="bf-auth-ambient-1" />
      <div className="bf-auth-ambient-2" />

      {/* Main Split Container */}
      <div className="bf-auth-container">
        
        {/* =========================================
            LEFT PANEL: Infrastructure Hero Showcase
           ========================================= */}
        <div className="bf-hero-panel">
          <div className="bf-hero-bg-img" />
          <div className="bf-hero-gradient-overlay" />
          <div className="bf-hero-network-overlay" />

          {/* Top Bar: Brand & Nav */}
          <div className="bf-hero-topbar">
            <BlockFundLogo size={34} showText={true} textLight={true} subText="Transparent Infrastructure Funding" />
            <nav className="bf-hero-nav">
              {onBackToHome && (
                <>
                  <span className="bf-hero-nav-item" onClick={onBackToHome}>HOME</span>
                  <span className="bf-hero-nav-sep">|</span>
                </>
              )}
              <span className="bf-hero-nav-item">PEOPLE</span>
              <span className="bf-hero-nav-sep">|</span>
              <span className="bf-hero-nav-item">PROJECTS</span>
              <span className="bf-hero-nav-sep">|</span>
              <span className="bf-hero-nav-item">PROGRESS</span>
            </nav>
          </div>

          {/* Hero Main Headline */}
          <div className="bf-hero-headline-wrap">
            <h1 className="bf-hero-headline">
              Transparent funding.
              <span className="bf-hero-headline-highlight">Visible progress.</span>
            </h1>
            <p className="bf-hero-subhead">
              Blockchain-based, milestone-driven funding for a better tomorrow.
            </p>
          </div>

          {/* Floating Interactive Network Badges */}
          {/* Badge 1: Top Right - Real-time Tracking */}
          <div className="bf-floating-badge badge-tracking">
            <div className="bf-badge-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
            <div className="bf-badge-content">
              <div className="bf-badge-title">Real-time Tracking</div>
              <div className="bf-badge-sub">Publicly Verifiable</div>
            </div>
            <span className="bf-badge-pulse" />
          </div>

          {/* Badge 2: Mid-Left - Funds Released */}
          <div className="bf-floating-badge badge-funds">
            <div className="bf-badge-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div className="bf-badge-content">
              <div className="bf-badge-title">Funds Released</div>
              <div className="bf-badge-sub">On Milestone Completion</div>
            </div>
            <span className="bf-badge-pulse" />
          </div>

          {/* Badge 3: Lower-Left - Tamper-Proof Records */}
          <div className="bf-floating-badge badge-tamper">
            <div className="bf-badge-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div className="bf-badge-content">
              <div className="bf-badge-title">Tamper-Proof Records</div>
              <div className="bf-badge-sub">On Blockchain</div>
            </div>
            <span className="bf-badge-pulse" />
          </div>

          {/* Badge 4: Center-Bottom - Stronger Communities */}
          <div className="bf-floating-badge badge-community">
            <div className="bf-badge-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div className="bf-badge-content">
              <div className="bf-badge-title">Stronger Communities</div>
              <div className="bf-badge-sub">Through Transparency</div>
            </div>
            <span className="bf-badge-pulse" />
          </div>

          {/* Hero Bottom Bar */}
          <div className="bf-hero-bottom-bar">
            <div className="bf-hero-motto">
              <span className="bf-hero-motto-line" />
              <span>INFRASTRUCTURE TODAY. A BRIGHTER TOMORROW.</span>
            </div>

            <div className="bf-hero-pillars">
              <div className="bf-pillar-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 22s5.5-2.5 8-8c1.5-3.3 2-6 2-9 0 0 3 0 5 2 2 2 3 5 3 5s-2.5.5-5.5 2c-4 2-6 5.5-7.5 8" />
                </svg>
                <span>Sustainable Development</span>
              </div>
              <div className="bf-pillar-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <polyline points="16 11 18 13 22 9" />
                </svg>
                <span>Accountable Governance</span>
              </div>
              <div className="bf-pillar-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
                <span>Inclusive Growth</span>
              </div>
            </div>
          </div>
        </div>


        {/* =========================================
            RIGHT PANEL: Clean Authentication Card
           ========================================= */}
        <div className="bf-auth-panel">
          
          {/* Top subtle tagline */}
          <div className="bf-auth-top-tagline">
            {onBackToHome && (
              <button
                type="button"
                className="bf-back-home-link"
                onClick={onBackToHome}
              >
                ← Public Overview
              </button>
            )}
            <span className="bf-tagline-bar" />
            <span>Building Trust for a Better Tomorrow</span>
          </div>

          <div className="bf-auth-card-inner">
            {/* Logo in Card */}
            <div className="bf-card-logo-wrap">
              <BlockFundLogo size={42} showText={true} subText="Transparent Infrastructure Funding" />
            </div>

            {/* Title / Subtitle */}
            <div className="bf-card-header">
              <h2 className="bf-card-title">
                {mode === 'login' ? 'Welcome back' : 'Create an Account'}
              </h2>
              <p className="bf-card-subtitle">
                {mode === 'login'
                  ? 'Sign in to continue to your dashboard'
                  : 'Join the transparent blockchain infrastructure ecosystem'}
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="bf-mode-tabs">
              <button
                type="button"
                data-testid="signin-tab"
                className={`bf-mode-tab ${mode === 'login' ? 'active' : ''}`}
                onClick={() => setMode('login')}
              >
                Sign In
              </button>
              <button
                type="button"
                data-testid="signup-tab"
                className={`bf-mode-tab ${mode === 'signup' ? 'active' : ''}`}
                onClick={() => setMode('signup')}
              >
                Sign Up
              </button>
            </div>

            {/* Quick Demo Fill Pills (For instantaneous testing of Authority, Contractor, Public) */}
            {mode === 'login' && (
              <div className="bf-demo-quick-bar">
                <span className="bf-demo-quick-label">Instant Demo Login:</span>
                <div className="bf-demo-pills">
                  {DEMO_PRESETS.map((p) => (
                    <button
                      key={p.role}
                      type="button"
                      className={`bf-demo-pill ${loginEmail === p.email ? 'active' : ''}`}
                      onClick={() => handleQuickDemo(p)}
                      title={`Load ${p.label} credentials`}
                    >
                      <span className="bf-demo-pill-dot" style={{ background: p.color }} />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* --------------------------------------
                LOGIN FORM: Clean Email + Password
               -------------------------------------- */}
            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="bf-form">
                {/* Email Field */}
                <div className="bf-input-group">
                  <label className="bf-label" htmlFor="bf-email">Email or Username</label>
                  <div className="bf-input-wrapper">
                    <span className="bf-input-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                    </span>
                    <input
                      id="bf-email"
                      type="text"
                      className="bf-input"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="username"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="bf-input-group">
                  <label className="bf-label" htmlFor="bf-password">Password</label>
                  <div className="bf-input-wrapper">
                    <span className="bf-input-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </span>
                    <input
                      id="bf-password"
                      type={showPassword ? 'text' : 'password'}
                      className="bf-input bf-input-has-suffix"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="bf-input-toggle"
                      onClick={() => setShowPassword((prev) => !prev)}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="bf-form-options">
                  <label className="bf-checkbox-label">
                    <input
                      type="checkbox"
                      className="bf-checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>Remember me</span>
                  </label>
                  <button
                    type="button"
                    className="bf-forgot-link"
                    onClick={() => showToast('Demo note: default accounts use password Authority@123, Contractor@123, or Public@123', 'info')}
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Sign In Primary Button */}
                <button
                  type="submit"
                  data-testid="login-submit-btn"
                  className="bf-primary-btn"
                  disabled={loading}
                >
                  <span>{loading ? 'Signing in...' : 'Sign In'}</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>

                {/* Divider: or */}
                <div className="bf-divider">
                  <span className="bf-divider-line" />
                  <span className="bf-divider-text">or</span>
                  <span className="bf-divider-line" />
                </div>

                {/* Secondary Action: Continue as Public Viewer */}
                <button
                  type="button"
                  className="bf-secondary-btn"
                  onClick={handlePublicViewerAccess}
                  disabled={loading}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <span>Continue as Public Viewer</span>
                </button>
              </form>
            ) : (
              /* --------------------------------------
                  SIGN UP FORM: Role selection here
                 -------------------------------------- */
              <form onSubmit={handleSignup} className="bf-form">
                {/* Role Selection Cards */}
                <div className="bf-signup-roles">
                  <label className="bf-label">Select Your Role</label>
                  <div className="bf-role-grid">
                    {ROLE_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`bf-role-card ${selectedRole === opt.id ? 'active' : ''}`}
                        onClick={() => setSelectedRole(opt.id)}
                      >
                        <div className="bf-role-icon">{opt.icon}</div>
                        <div className="bf-role-name">{opt.name}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Full Name */}
                <div className="bf-input-group">
                  <label className="bf-label">Full Name *</label>
                  <div className="bf-input-wrapper">
                    <span className="bf-input-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      className="bf-input"
                      value={signupForm.name}
                      onChange={(e) => setSignupForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Rahul Sharma"
                      required
                    />
                  </div>
                </div>

                {/* Two Column: Email & Username */}
                <div className="bf-form-row">
                  <div className="bf-input-group">
                    <label className="bf-label">Email Address</label>
                    <div className="bf-input-wrapper">
                      <input
                        type="email"
                        className="bf-input"
                        value={signupForm.email}
                        onChange={(e) => setSignupForm((prev) => ({ ...prev, email: e.target.value }))}
                        placeholder="you@domain.com"
                      />
                    </div>
                  </div>
                  <div className="bf-input-group">
                    <label className="bf-label">Username *</label>
                    <div className="bf-input-wrapper">
                      <input
                        type="text"
                        className="bf-input"
                        value={signupForm.username}
                        onChange={(e) => setSignupForm((prev) => ({ ...prev, username: e.target.value }))}
                        placeholder="username"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Password */}
                <div className="bf-input-group">
                  <label className="bf-label">Password * (Min 6 chars)</label>
                  <div className="bf-input-wrapper">
                    <input
                      type="password"
                      className="bf-input"
                      value={signupForm.password}
                      onChange={(e) => setSignupForm((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                {/* Contractor-specific fields */}
                {selectedRole === 'contractor' && (
                  <>
                    <div className="bf-input-group">
                      <label className="bf-label">Company / Firm Name</label>
                      <div className="bf-input-wrapper">
                        <input
                          type="text"
                          className="bf-input"
                          value={signupForm.companyName}
                          onChange={(e) => setSignupForm((prev) => ({ ...prev, companyName: e.target.value }))}
                          placeholder="e.g. Apex Infrastructure Ltd"
                        />
                      </div>
                    </div>

                    <div className="bf-input-group">
                      <label className="bf-label">Ethereum Wallet Address *</label>
                      <div className="bf-input-wrapper">
                        <input
                          type="text"
                          className="bf-input font-mono"
                          value={signupForm.walletAddress}
                          onChange={(e) => setSignupForm((prev) => ({ ...prev, walletAddress: e.target.value }))}
                          placeholder="0x..."
                          required
                        />
                      </div>
                      <div className="bf-help-text">
                        Funds from the smart contract will be released directly to this address.
                      </div>
                    </div>

                    {/* Ganache Wallet Quick Pick */}
                    <div className="bf-input-group">
                      <label className="bf-label">Or select available Ganache test wallet</label>
                      <select
                        className="bf-select"
                        value={walletOptions.includes(signupForm.walletAddress) ? signupForm.walletAddress : ''}
                        onChange={(e) => setSignupForm((prev) => ({ ...prev, walletAddress: e.target.value }))}
                        disabled={walletOptionsLoading}
                      >
                        <option value="">
                          {walletOptionsLoading
                            ? 'Detecting local Ganache wallets...'
                            : walletOptions.length > 0
                              ? 'Pick a local Ganache wallet'
                              : 'No Ganache test wallets detected'}
                        </option>
                        {walletOptions.map((addr) => (
                          <option key={addr} value={addr}>
                            {addr}
                          </option>
                        ))}
                      </select>
                      {walletInfo.connected && (
                        <div className="bf-help-text text-green">
                          ✓ Ganache connected ({walletInfo.ganacheUrl || 'local RPC'})
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Submit Sign Up Button */}
                <button
                  type="submit"
                  className="bf-primary-btn"
                  disabled={loading}
                >
                  <span>{loading ? 'Registering...' : `Create Account as ${ROLE_OPTIONS.find((r) => r.id === selectedRole)?.name}`}</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </form>
            )}

            {/* Bottom Security Badges */}
            <div className="bf-security-footer">
              <div className="bf-security-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span>Secure access</span>
              </div>
              <div className="bf-security-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
                <span>Role-based permissions</span>
              </div>
              <div className="bf-security-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                <span>Blockchain audit trail</span>
              </div>
            </div>

            {/* Bottom-right watermark script */}
            <div className="bf-script-watermark">
              Infrastructure Built for People
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
