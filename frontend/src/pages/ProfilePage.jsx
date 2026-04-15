import { useEffect, useState } from 'react';
import { api, formatINR } from '../utils/api';

function roleLabel(role) {
  if (role === 'authority') return 'Authority';
  if (role === 'contractor') return 'Contractor';
  return 'Public User';
}

export default function ProfilePage({ currentUser, showToast }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getStats()
      .then((res) => setStats(res.data.stats || null))
      .catch(() => showToast('Failed to load profile stats', 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  const roleStats = stats?.roleStats || {};
  const isAuthority = currentUser?.role === 'authority';
  const isContractor = currentUser?.role === 'contractor';
  const isPublic = currentUser?.role === 'public';

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">My Profile</div>
          <div className="section-subtitle">Role-based account details and activity summary</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 20 }}>
        <div className="form-card" style={{ maxWidth: '100%' }}>
          <div className="form-title" style={{ marginBottom: 14 }}>Account Details</div>
          <div className="profile-grid">
            <div className="profile-item">
              <div className="profile-label">Full Name</div>
              <div className="profile-value">{currentUser?.name || '-'}</div>
            </div>
            <div className="profile-item">
              <div className="profile-label">Username</div>
              <div className="profile-value">{currentUser?.username || '-'}</div>
            </div>
            <div className="profile-item">
              <div className="profile-label">Role</div>
              <div className="profile-value">{roleLabel(currentUser?.role)}</div>
            </div>
            <div className="profile-item">
              <div className="profile-label">Wallet Address</div>
              <div className="profile-value profile-wallet">{currentUser?.walletAddress || 'Not set'}</div>
            </div>
          </div>
        </div>

        <div className="form-card" style={{ maxWidth: '100%' }}>
          <div className="form-title" style={{ marginBottom: 14 }}>Role Activity</div>
          {loading ? (
            <div className="spinner" />
          ) : (
            <div className="profile-grid">
              {isAuthority && (
                <>
                  <div className="profile-item">
                    <div className="profile-label">Projects Created</div>
                    <div className="profile-value">{roleStats.totalProjectsCreated ?? 0}</div>
                  </div>
                  <div className="profile-item">
                    <div className="profile-label">Funds Allocated</div>
                    <div className="profile-value">{formatINR(roleStats.totalFundsAllocated ?? 0)}</div>
                  </div>
                  <div className="profile-item">
                    <div className="profile-label">Funds Released</div>
                    <div className="profile-value">{formatINR(roleStats.totalFundsReleased ?? 0)}</div>
                  </div>
                  <div className="profile-item">
                    <div className="profile-label">Pending Requests</div>
                    <div className="profile-value">{stats?.pendingFundingRequests ?? 0}</div>
                  </div>
                </>
              )}

              {isContractor && (
                <>
                  <div className="profile-item">
                    <div className="profile-label">Projects Assigned</div>
                    <div className="profile-value">{roleStats.projectsAssigned ?? 0}</div>
                  </div>
                  <div className="profile-item">
                    <div className="profile-label">Funds Requested</div>
                    <div className="profile-value">{formatINR(roleStats.totalFundsRequested ?? 0)}</div>
                  </div>
                  <div className="profile-item">
                    <div className="profile-label">Funds Received</div>
                    <div className="profile-value">{formatINR(roleStats.totalFundsReceived ?? 0)}</div>
                  </div>
                  <div className="profile-item">
                    <div className="profile-label">Pending Requests</div>
                    <div className="profile-value">{stats?.pendingFundingRequests ?? 0}</div>
                  </div>
                </>
              )}

              {isPublic && (
                <>
                  <div className="profile-item">
                    <div className="profile-label">Projects Verified</div>
                    <div className="profile-value">{roleStats.projectsVerified ?? 0}</div>
                  </div>
                  <div className="profile-item">
                    <div className="profile-label">Funds Tracked</div>
                    <div className="profile-value">{formatINR(roleStats.totalFundsTracked ?? 0)}</div>
                  </div>
                  <div className="profile-item">
                    <div className="profile-label">Public Verifications</div>
                    <div className="profile-value">{stats?.totalVerifications ?? 0}</div>
                  </div>
                  <div className="profile-item">
                    <div className="profile-label">Tracked Projects</div>
                    <div className="profile-value">{stats?.totalProjects ?? 0}</div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
