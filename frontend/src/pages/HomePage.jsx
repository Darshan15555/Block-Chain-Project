import { useState, useEffect } from 'react';
import { api, formatINR, getPercent } from '../utils/api';
import BlockFundLogo from '../components/BlockFundLogo';
import StatusBadge from '../components/ui/StatusBadge';

export default function HomePage({ onEnterPortal, onLoginPublicViewer }) {
  const [stats, setStats] = useState(null);
  const [featuredProjects, setFeaturedProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getStats(), api.getProjects()])
      .then(([statsRes, projRes]) => {
        setStats(statsRes.data?.stats || null);
        setFeaturedProjects((projRes.data?.projects || []).slice(0, 3));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalFund = stats?.totalFund || 18500000;
  const releasedFund = stats?.totalReleasedFund || 7200000;
  const totalProjects = stats?.totalProjects || 4;
  const totalUpdates = stats?.totalUpdates || 12;

  return (
    <div className="bf-landing-page">
      {/* Top Navbar */}
      <header className="bf-landing-nav">
        <div className="bf-landing-nav-inner">
          <BlockFundLogo size={36} showText={true} subText="Transparent Infrastructure Funding" />

          <nav className="bf-landing-links">
            <a href="#how-it-works" className="bf-landing-link">How It Works</a>
            <a href="#projects" className="bf-landing-link">Public Projects</a>
            <a href="#transparency" className="bf-landing-link">Blockchain Proof</a>
            <a href="#roles" className="bf-landing-link">Governance</a>
          </nav>

          <div className="bf-landing-actions">
            <button
              type="button"
              className="bf-secondary-btn bf-landing-guest-btn"
              onClick={onLoginPublicViewer}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>Public Portal</span>
            </button>

            <button
              type="button"
              className="bf-primary-btn bf-landing-login-btn"
              onClick={onEnterPortal}
            >
              <span>Sign In</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bf-landing-hero">
        <div className="bf-landing-hero-bg" />
        <div className="bf-landing-hero-overlay" />

        <div className="bf-landing-hero-content">
          <div className="bf-landing-hero-badge">
            <span className="bf-badge-pulse" style={{ position: 'static', display: 'inline-block' }} />
            <span>DECENTRALIZED PUBLIC INFRASTRUCTURE TREASURY</span>
          </div>

          <h1 className="bf-landing-hero-title">
            Transparent funding.
            <span className="bf-landing-hero-highlight">Visible progress.</span>
          </h1>

          <p className="bf-landing-hero-subtitle">
            Blockchain-based, milestone-driven funding for national and civic infrastructure.
            Every rupee tracked from treasury allocation to on-site concrete pouring.
          </p>

          <div className="bf-landing-hero-buttons">
            <button
              type="button"
              className="bf-primary-btn bf-btn-lg"
              onClick={onLoginPublicViewer}
            >
              <span>Explore Public Projects</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>

            <button
              type="button"
              className="bf-secondary-btn bf-btn-lg bf-landing-outline-btn"
              onClick={onEnterPortal}
            >
              <span>Official Stakeholder Login</span>
            </button>
          </div>

          {/* Live Ecosystem Metrics Strip */}
          <div className="bf-landing-metrics-strip">
            <div className="bf-landing-metric">
              <span className="bf-landing-metric-val">{formatINR(totalFund)}</span>
              <span className="bf-landing-metric-lbl">Total Funds Committed</span>
            </div>
            <div className="bf-landing-metric-divider" />
            <div className="bf-landing-metric">
              <span className="bf-landing-metric-val">{formatINR(releasedFund)}</span>
              <span className="bf-landing-metric-lbl">Milestone Funds Released</span>
            </div>
            <div className="bf-landing-metric-divider" />
            <div className="bf-landing-metric">
              <span className="bf-landing-metric-val">{totalProjects} Projects</span>
              <span className="bf-landing-metric-lbl">Active Public Works</span>
            </div>
            <div className="bf-landing-metric-divider" />
            <div className="bf-landing-metric">
              <span className="bf-landing-metric-val">100% On-Chain</span>
              <span className="bf-landing-metric-lbl">Publicly Verifiable</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="bf-landing-section">
        <div className="bf-section-header-center">
          <div className="bf-section-eyebrow">THE PROTOCOL</div>
          <h2 className="bf-section-main-title">How BlockFund Enforces Accountability</h2>
          <p className="bf-section-lead">
            Eliminating leakages, delays, and ghost contracts through an automated 4-stage smart contract lifecycle.
          </p>
        </div>

        <div className="bf-steps-grid">
          <div className="bf-step-card">
            <div className="bf-step-number">01</div>
            <div className="bf-step-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <h3 className="bf-step-title">Project Registration</h3>
            <p className="bf-step-text">
              Central Authority locks total fund in smart contract escrow and binds the project to a vetted contractor's Ethereum wallet.
            </p>
          </div>

          <div className="bf-step-card">
            <div className="bf-step-number">02</div>
            <div className="bf-step-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <h3 className="bf-step-title">Milestone Progress Proof</h3>
            <p className="bf-step-text">
              Contractor logs physical work updates with labor count, materials, expense amounts, and cryptographic SHA-256 photo hashes.
            </p>
          </div>

          <div className="bf-step-card">
            <div className="bf-step-number">03</div>
            <div className="bf-step-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
            </div>
            <h3 className="bf-step-title">Citizen Verification</h3>
            <p className="bf-step-text">
              Public citizens and civic auditors inspect progress photos, cross-reference hashes, and cast on-chain verification votes.
            </p>
          </div>

          <div className="bf-step-card">
            <div className="bf-step-number">04</div>
            <div className="bf-step-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            </div>
            <h3 className="bf-step-title">Cryptographic Fund Release</h3>
            <p className="bf-step-text">
              Upon milestone confirmation, funds are released directly to contractor's wallet. Every transaction is immutable on the public ledger.
            </p>
          </div>
        </div>
      </section>

      {/* Featured Public Infrastructure Projects */}
      <section id="projects" className="bf-landing-section bf-bg-alt">
        <div className="bf-section-header-center">
          <div className="bf-section-eyebrow">TRANSPARENCY IN ACTION</div>
          <h2 className="bf-section-main-title">Active Public Infrastructure Works</h2>
          <p className="bf-section-lead">
            Explore live government-funded civil projects tracked in real-time.
          </p>
        </div>

        <div className="bf-landing-projects-grid">
          {featuredProjects.map((p) => {
            const pct = getPercent(p.spentFund, p.totalFund);
            return (
              <div key={p.projectId} className="bf-landing-project-card">
                <div className="bf-project-card-top">
                  <span className={`project-type-badge type-${p.type?.toLowerCase().replace(/\s+/g, '')}`}>
                    {p.type}
                  </span>
                  <StatusBadge status={p.status || 'Active'} size="sm" />
                </div>

                <h3 className="bf-landing-proj-name">{p.name}</h3>
                <div className="bf-landing-proj-loc">📍 {p.location}</div>

                <div className="bf-landing-proj-funds">
                  <div>
                    <span className="bf-proj-fund-lbl">Total Allocated</span>
                    <span className="bf-proj-fund-val">{formatINR(p.totalFund)}</span>
                  </div>
                  <div>
                    <span className="bf-proj-fund-lbl">Released</span>
                    <span className="bf-proj-fund-val text-blue">{formatINR(p.releasedFund || 0)}</span>
                  </div>
                </div>

                <div className="fund-bar-container">
                  <div className="fund-bar-label">
                    <span>Budget Utilized</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="fund-bar-track">
                    <div className="fund-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <button
                  type="button"
                  className="bf-secondary-btn bf-proj-card-btn"
                  onClick={onLoginPublicViewer}
                >
                  Inspect Milestone Proof →
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: 'center', marginTop: 36 }}>
          <button
            type="button"
            className="bf-primary-btn bf-btn-lg"
            onClick={onLoginPublicViewer}
          >
            <span>View All Public Projects</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </section>

      {/* Blockchain Proof & Governance */}
      <section id="transparency" className="bf-landing-section">
        <div className="bf-landing-split">
          <div className="bf-landing-split-text">
            <div className="bf-section-eyebrow">IMMUTABLE ARCHITECTURE</div>
            <h2 className="bf-section-main-title">Zero Embezzlement. Tamper-Proof Audit Trails.</h2>
            <p className="bf-landing-body">
              Traditional infrastructure funding suffers from delayed reporting, opaque subcontractor billing, and missing paperwork. BlockFund solves this with Ethereum smart contracts.
            </p>

            <div className="bf-feature-checklist">
              <div className="bf-feature-check-item">
                <span className="bf-check-icon">✓</span>
                <div>
                  <strong>Cryptographic Milestone Hashing:</strong> Every update description, cost breakdown, and photo is hashed via SHA-256 and committed on-chain.
                </div>
              </div>
              <div className="bf-feature-check-item">
                <span className="bf-check-icon">✓</span>
                <div>
                  <strong>Direct Wallet Disbursements:</strong> Eliminates middleman escrow delays by transferring funds directly to verified contractor addresses.
                </div>
              </div>
              <div className="bf-feature-check-item">
                <span className="bf-check-icon">✓</span>
                <div>
                  <strong>Open Public Ledger:</strong> Every citizen can audit transaction hashes, block timestamps, and expenditure summaries in real time.
                </div>
              </div>
            </div>
          </div>

          <div className="bf-landing-split-visual">
            <div className="bf-mock-audit-card">
              <div className="bf-mock-audit-header">
                <span className="bf-chain-dot active" />
                <span>LIVE LEDGER AUDIT FEED</span>
              </div>
              <div className="bf-mock-tx-list">
                <div className="bf-mock-tx-row">
                  <span className="bf-mock-tx-badge release">RELEASE</span>
                  <span className="bf-mock-tx-hash">0x8f19...b7a2</span>
                  <span className="bf-mock-tx-amt">₹25,00,000</span>
                </div>
                <div className="bf-mock-tx-row">
                  <span className="bf-mock-tx-badge expense">EXPENSE</span>
                  <span className="bf-mock-tx-hash">0x4c21...89ee</span>
                  <span className="bf-mock-tx-amt">₹8,50,000</span>
                </div>
                <div className="bf-mock-tx-row">
                  <span className="bf-mock-tx-badge project">CREATE</span>
                  <span className="bf-mock-tx-hash">0x1a77...93f4</span>
                  <span className="bf-mock-tx-amt">₹50,00,000</span>
                </div>
              </div>
              <div className="bf-mock-audit-footer">
                <span>Verified by Ethereum Virtual Machine (Ganache Core)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="bf-landing-cta-banner">
        <div className="bf-cta-inner">
          <h2 className="bf-cta-title">Ready to Experience Transparent Governance?</h2>
          <p className="bf-cta-sub">
            Join the movement towards verifiable, corruption-free public infrastructure funding.
          </p>
          <div className="bf-cta-btns">
            <button
              type="button"
              className="bf-primary-btn bf-btn-lg"
              onClick={onLoginPublicViewer}
            >
              <span>Explore Public Portal</span>
            </button>
            <button
              type="button"
              className="bf-secondary-btn bf-btn-lg"
              onClick={onEnterPortal}
            >
              <span>Stakeholder Sign In</span>
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bf-landing-footer">
        <div className="bf-footer-inner">
          <div>
            <BlockFundLogo size={28} showText={true} subText="Transparent Infrastructure Funding" />
            <p className="bf-footer-copy">
              Built on Ethereum smart contracts. Designed for public accountability and citizen empowerment.
            </p>
          </div>

          <div className="bf-footer-links">
            <div className="bf-footer-col">
              <h4>PLATFORM</h4>
              <button type="button" onClick={onLoginPublicViewer}>Public Explorer</button>
              <button type="button" onClick={onEnterPortal}>Authority Login</button>
              <button type="button" onClick={onEnterPortal}>Contractor Hub</button>
            </div>
            <div className="bf-footer-col">
              <h4>TECHNOLOGY</h4>
              <span>Solidity Smart Contracts</span>
              <span>Ganache Local RPC</span>
              <span>Web3.js Integration</span>
              <span>SHA-256 Photo Proof</span>
            </div>
          </div>
        </div>
        <div className="bf-footer-bottom">
          <span>© 2026 BlockFund — Transparent Infrastructure Funding System. All rights reserved.</span>
          <span>Infrastructure Built for People</span>
        </div>
      </footer>
    </div>
  );
}
