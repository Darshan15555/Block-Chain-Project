import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import DemoChecklistPanel from './components/DemoChecklistPanel.jsx';
import { ToastContainer, useToast } from './components/Toast.jsx';
import { api, getAuthToken, registerUnauthorizedHandler, setAuthToken } from './utils/api';

const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const HomePage = lazy(() => import('./pages/HomePage.jsx'));
const AuthorityDashboard = lazy(() => import('./pages/AuthorityDashboard.jsx'));
const CreateProject = lazy(() => import('./pages/CreateProject.jsx'));
const AllProjects = lazy(() => import('./pages/AllProjects.jsx'));
const ReleaseFunds = lazy(() => import('./pages/ReleaseFunds.jsx'));
const ContractorDashboard = lazy(() => import('./pages/ContractorDashboard.jsx'));
const MyProjects = lazy(() => import('./pages/MyProjects.jsx'));
const SubmitUpdate = lazy(() => import('./pages/SubmitUpdate.jsx'));
const PublicDashboard = lazy(() => import('./pages/PublicDashboard.jsx'));
const VerifyWork = lazy(() => import('./pages/VerifyWork.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));
const BlockchainAudit = lazy(() => import('./pages/BlockchainAudit.jsx'));
const ManageContractors = lazy(() => import('./pages/ManageContractors.jsx'));

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  create: 'Create New Project',
  projects: 'All Infrastructure Projects',
  release: 'Release Funds On-Chain',
  contractors: 'Contractor Directory',
  myprojects: 'My Assigned Projects',
  update: 'Submit Milestone Update',
  verify: 'Citizen Work Verification',
  profile: 'Profile & Security',
  blockchain: 'Blockchain Proof & Ledger Audit',
};

const ROLE_PAGES = {
  authority: ['dashboard', 'create', 'projects', 'release', 'contractors', 'blockchain', 'profile'],
  contractor: ['dashboard', 'myprojects', 'update', 'blockchain', 'profile'],
  public: ['dashboard', 'projects', 'verify', 'blockchain', 'profile'],
};

const PAGE_STORE_KEY = 'blockfund_last_page_by_role';
const PRESENTATION_MODE_KEY = 'blockfund_presentation_mode';

function canUseStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function readRolePageMap() {
  if (!canUseStorage()) return {};
  try {
    return JSON.parse(localStorage.getItem(PAGE_STORE_KEY) || '{}');
  } catch {
    return {};
  }
}

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [contractorPendingCount, setContractorPendingCount] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);
  const [unauthView, setUnauthView] = useState('login'); // 'landing' | 'login'
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [presentationMode, setPresentationMode] = useState(
    canUseStorage() ? localStorage.getItem(PRESENTATION_MODE_KEY) === 'true' : false
  );
  const sessionExpiryLock = useRef(false);
  const { toasts, showToast } = useToast();
  const demoMode = String(import.meta.env.VITE_DEMO_MODE || '').toLowerCase() === 'true';

  const role = user?.role || null;

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setAuthLoading(false);
      return;
    }

    api.me()
      .then((res) => setUser(res.data.user))
      .catch(() => {
        setAuthToken(null);
        setUser(null);
      })
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    registerUnauthorizedHandler(() => {
      if (sessionExpiryLock.current) return;
      sessionExpiryLock.current = true;

      setAuthToken(null);
      setUser(null);
      setPage('dashboard');
      showToast('Session expired. Please login again.', 'info');

      setTimeout(() => {
        sessionExpiryLock.current = false;
      }, 1500);
    });

    return () => {
      registerUnauthorizedHandler(null);
    };
  }, [showToast]);

  useEffect(() => {
    if (!role) return;
    const allowedPages = ROLE_PAGES[role] || [];
    if (!allowedPages.includes(page)) {
      setPage('dashboard');
    }
  }, [role, page]);

  useEffect(() => {
    if (!role) return;
    const allowedPages = ROLE_PAGES[role] || [];
    const pageMap = readRolePageMap();
    const remembered = pageMap[role];
    if (remembered && allowedPages.includes(remembered)) {
      setPage(remembered);
    }
  }, [role]);

  useEffect(() => {
    if (!role) return;
    const pageMap = readRolePageMap();
    pageMap[role] = page;
    if (canUseStorage()) {
      localStorage.setItem(PAGE_STORE_KEY, JSON.stringify(pageMap));
    }
  }, [role, page]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('presentation-mode', presentationMode);
    if (canUseStorage()) {
      localStorage.setItem(PRESENTATION_MODE_KEY, String(presentationMode));
    }
  }, [presentationMode]);

  useEffect(() => {
    if (!role) return;

    const isFormElement = (node) => {
      if (!node) return false;
      const tag = String(node.tagName || '').toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || node.isContentEditable;
    };

    const onKeyDown = (event) => {
      if (!event.altKey) return;
      if (isFormElement(event.target)) return;

      const keyNum = Number(event.key);
      if (!Number.isInteger(keyNum) || keyNum < 1 || keyNum > 9) return;

      const allowedPages = ROLE_PAGES[role] || [];
      const pageId = allowedPages[keyNum - 1];
      if (!pageId) return;

      event.preventDefault();
      setPage(pageId);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [role]);

  useEffect(() => {
    if (role !== 'contractor') {
      setContractorPendingCount(0);
      return;
    }

    const loadPending = async () => {
      try {
        const res = await api.getStats();
        setContractorPendingCount(res.data?.stats?.pendingFundingRequests || 0);
      } catch {
        setContractorPendingCount(0);
      }
    };

    loadPending();
    const timer = setInterval(loadPending, 6000);
    return () => clearInterval(timer);
  }, [role]);

  const handleLogin = ({ token, user: loggedInUser }) => {
    setAuthToken(token);
    setUser(loggedInUser);
    setPage('dashboard');
  };

  const handleLogout = () => {
    setAuthToken(null);
    setUser(null);
    setPage('dashboard');
    showToast('Logged out successfully', 'success');
  };

  const handlePublicViewerDirect = async () => {
    try {
      const res = await api.loginPublicViewer();
      handleLogin(res.data);
      showToast('Entered Public Transparency Portal', 'success');
    } catch {
      // Fallback
      try {
        const fallbackRes = await api.login({
          email: 'citizen@public.org',
          password: 'Public@123',
        });
        handleLogin(fallbackRes.data);
        showToast('Entered Public Transparency Portal', 'success');
      } catch (err) {
        showToast(err.response?.data?.error || 'Could not launch Public Viewer', 'error');
      }
    }
  };

  const handleDemoReset = () => {
    setPage('dashboard');
    window.location.reload();
  };

  const roleLabel = useMemo(() => {
    if (role === 'authority') return 'Central Authority';
    if (role === 'contractor') return 'Contractor';
    return 'Public Citizen';
  }, [role]);

  if (authLoading) {
    return (
      <div className="bf-app-loading-screen">
        <div className="spinner" />
        <div className="bf-loading-caption">Connecting to BlockFund Core...</div>
        <ToastContainer toasts={toasts} />
      </div>
    );
  }

  // Unauthenticated experience: Landing or Login
  if (!user) {
    return (
      <>
        <Suspense fallback={<div className="spinner" />}>
          {unauthView === 'landing' ? (
            <HomePage
              onEnterPortal={() => setUnauthView('login')}
              onLoginPublicViewer={handlePublicViewerDirect}
            />
          ) : (
            <LoginPage
              onLogin={handleLogin}
              showToast={showToast}
              onBackToHome={() => setUnauthView('landing')}
            />
          )}
        </Suspense>
        <ToastContainer toasts={toasts} />
      </>
    );
  }

  const sharedProps = { showToast, currentUser: user, onNavigate: setPage };

  const renderPage = () => {
    if (role === 'authority') {
      if (page === 'dashboard') return <AuthorityDashboard {...sharedProps} />;
      if (page === 'create') return <CreateProject {...sharedProps} />;
      if (page === 'projects') return <AllProjects {...sharedProps} />;
      if (page === 'release') return <ReleaseFunds {...sharedProps} />;
      if (page === 'contractors') return <ManageContractors {...sharedProps} />;
      if (page === 'blockchain') return <BlockchainAudit {...sharedProps} />;
      if (page === 'profile') return <ProfilePage {...sharedProps} />;
    }

    if (role === 'contractor') {
      if (page === 'dashboard') return <ContractorDashboard {...sharedProps} />;
      if (page === 'myprojects') return <MyProjects {...sharedProps} />;
      if (page === 'update') return <SubmitUpdate {...sharedProps} />;
      if (page === 'blockchain') return <BlockchainAudit {...sharedProps} />;
      if (page === 'profile') return <ProfilePage {...sharedProps} />;
    }

    if (role === 'public') {
      if (page === 'dashboard') return <PublicDashboard {...sharedProps} />;
      if (page === 'projects') return <PublicDashboard {...sharedProps} />;
      if (page === 'verify') return <VerifyWork {...sharedProps} />;
      if (page === 'blockchain') return <BlockchainAudit {...sharedProps} />;
      if (page === 'profile') return <ProfilePage {...sharedProps} />;
    }

    return (
      <div className="bf-not-found-card">
        <h3>Page Not Found</h3>
        <p>The requested view is not available for your current permission level.</p>
        <button type="button" className="bf-primary-btn" onClick={() => setPage('dashboard')}>
          Return to Dashboard
        </button>
      </div>
    );
  };

  return (
    <div className="bf-app-shell">
      {/* Responsive Enterprise Sidebar */}
      <Sidebar
        role={role}
        activePage={page}
        onNavigate={setPage}
        onLogout={handleLogout}
        pendingCount={contractorPendingCount}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="bf-main-layout">
        {/* Modern Top Header Bar matching Reference */}
        <header className="bf-topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', background: '#ffffff', borderBottom: '1px solid var(--border)' }}>
          <div className="bf-topbar-left" style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, maxWidth: 640 }}>
            <button
              type="button"
              className="bf-mobile-menu-btn"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            {/* Global Search Input with Ctrl K Shortcut */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: '#f8fafc',
                border: '1px solid var(--border)',
                borderRadius: 999,
                padding: '8px 16px',
                width: '100%',
                maxWidth: 460,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search projects, locations, or keywords..."
                style={{
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontSize: 13,
                  width: '100%',
                  color: 'var(--text-primary)',
                }}
              />
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  background: '#ffffff',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '2px 6px',
                  whiteSpace: 'nowrap',
                }}
              >
                Ctrl K
              </span>
            </div>
          </div>

          <div className="bf-topbar-right" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Theme Toggle Icon */}
            <button
              type="button"
              className="bf-icon-btn"
              title="Toggle Day/Night Mode"
              onClick={() => showToast('Switched to high-clarity daylight theme', 'info')}
              style={{ width: 34, height: 34, borderRadius: '50%' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            </button>

            {/* User Profile Pill matching Reference Design */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 999,
                transition: 'background 0.15s ease',
              }}
              onClick={() => setPage('profile')}
              title="View User Profile & Security"
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: '#e0e7ff',
                  color: '#4f46e5',
                  fontWeight: 800,
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {(user.name || user.username || 'D').charAt(0).toUpperCase()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                  {user.name || 'Darshan B'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {roleLabel}
                </span>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
        </header>

        {/* Page Content Container */}
        <main className="bf-page-container">
          <Suspense fallback={<div className="spinner" />}>
            {renderPage()}
          </Suspense>
        </main>
      </div>

      {demoMode && user && (
        <DemoChecklistPanel
          currentUser={user}
          activePage={page}
          showToast={showToast}
          onDemoReset={handleDemoReset}
        />
      )}
      <ToastContainer toasts={toasts} />
    </div>
  );
}
