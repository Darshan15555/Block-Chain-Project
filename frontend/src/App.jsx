import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import DemoChecklistPanel from './components/DemoChecklistPanel.jsx';
import { ToastContainer, useToast } from './components/Toast.jsx';
import { api, getAuthToken, registerUnauthorizedHandler, setAuthToken } from './utils/api';

const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
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

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  create: 'Create New Project',
  projects: 'All Projects',
  release: 'Release Funds',
  myprojects: 'My Assigned Projects',
  update: 'Submit Work Update',
  verify: 'Verify Work',
  profile: 'My Profile',
  blockchain: 'Blockchain Proof',
};

const ROLE_PAGES = {
  authority: ['dashboard', 'create', 'projects', 'release', 'blockchain', 'profile'],
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
    showToast('Logged out', 'success');
  };

  const handleDemoReset = () => {
    setPage('dashboard');
    window.location.reload();
  };

  const roleLabel = useMemo(() => {
    if (role === 'authority') return 'Authority';
    if (role === 'contractor') return 'Contractor';
    return 'Public';
  }, [role]);

  if (authLoading) {
    return (
      <>
        <div className="spinner" />
        <ToastContainer toasts={toasts} />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Suspense fallback={<div className="spinner" />}>
          <LoginPage onLogin={handleLogin} showToast={showToast} />
        </Suspense>
        <ToastContainer toasts={toasts} />
      </>
    );
  }

  const sharedProps = { showToast, currentUser: user };

  const renderPage = () => {
    if (role === 'authority') {
      if (page === 'dashboard') return <AuthorityDashboard {...sharedProps} />;
      if (page === 'create') return <CreateProject {...sharedProps} />;
      if (page === 'projects') return <AllProjects {...sharedProps} />;
      if (page === 'release') return <ReleaseFunds {...sharedProps} />;
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

    return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Page not found</div>;
  };

  return (
    <div className="app-layout">
      <Sidebar
        role={role}
        activePage={page}
        onNavigate={setPage}
        onLogout={handleLogout}
        pendingCount={contractorPendingCount}
      />
      <div className="main-content">
        <div className="topbar">
          <div className="topbar-title">{PAGE_TITLES[page] || 'Dashboard'}</div>
          <div className="topbar-right">
            {demoMode && (
              <>
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  title="Toggle presentation mode"
                  onClick={() => {
                    setPresentationMode((prev) => !prev);
                    showToast(
                      presentationMode ? 'Presentation mode disabled' : 'Presentation mode enabled',
                      'info'
                    );
                  }}
                >
                  {presentationMode ? 'Presenter On' : 'Presenter Off'}
                </button>
                <span title="Use Alt+1..Alt+6 to switch pages quickly" style={{ color: 'var(--text-secondary)' }}>
                  Shortcuts: Alt+1..6
                </span>
              </>
            )}
            <span>BlockFund</span>
            <span style={{ color: 'var(--border-bright)' }}>|</span>
            <span style={{ color: 'var(--accent)' }}>{roleLabel}</span>
            <span style={{ color: 'var(--text-muted)' }}>({user.name})</span>
          </div>
        </div>
        <div className="page-content">
          <Suspense fallback={<div className="spinner" />}>
            {renderPage()}
          </Suspense>
        </div>
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
