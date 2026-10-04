import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';

vi.mock('../utils/api', () => ({
  api: {
    login: vi.fn(),
    signup: vi.fn(),
    loginPublicViewer: vi.fn(),
    getWalletOptions: vi.fn().mockResolvedValue({ data: { wallets: [], blockchain: {} } }),
  },
}));

import LoginPage from '../pages/LoginPage.jsx';
import { api } from '../utils/api';

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('shows validation error when login fields are empty', async () => {
    const onLogin = vi.fn();
    const showToast = vi.fn();

    render(<LoginPage onLogin={onLogin} showToast={showToast} />);

    // Clear default demo credentials
    const emailInput = screen.getByLabelText(/email or username/i);
    const passwordInput = screen.getByLabelText(/^password/i);
    fireEvent.change(emailInput, { target: { value: '' } });
    fireEvent.change(passwordInput, { target: { value: '' } });

    fireEvent.click(screen.getByTestId('login-submit-btn'));

    expect(showToast).toHaveBeenCalledWith(
      'Please enter your email/username and password',
      'error'
    );
    expect(onLogin).not.toHaveBeenCalled();
  });

  test('logs in successfully with email and password', async () => {
    const onLogin = vi.fn();
    const showToast = vi.fn();

    api.login.mockResolvedValue({
      data: {
        token: 'auth-jwt-token',
        user: { id: '1', role: 'authority', name: 'Central Authority', email: 'authority@blockfund.gov' },
      },
    });

    render(<LoginPage onLogin={onLogin} showToast={showToast} />);

    const emailInput = screen.getByLabelText(/email or username/i);
    const passwordInput = screen.getByLabelText(/^password/i);

    fireEvent.change(emailInput, { target: { value: 'authority@blockfund.gov' } });
    fireEvent.change(passwordInput, { target: { value: 'Authority@123' } });
    fireEvent.click(screen.getByTestId('login-submit-btn'));

    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith({
        email: 'authority@blockfund.gov',
        password: 'Authority@123',
      });
    });

    expect(onLogin).toHaveBeenCalledWith({
      token: 'auth-jwt-token',
      user: { id: '1', role: 'authority', name: 'Central Authority', email: 'authority@blockfund.gov' },
    });
  });

  test('supports one-click Continue as Public Viewer', async () => {
    const onLogin = vi.fn();
    const showToast = vi.fn();

    api.loginPublicViewer.mockResolvedValue({
      data: {
        token: 'public-token',
        user: { id: '99', role: 'public', name: 'Public Viewer' },
      },
    });

    render(<LoginPage onLogin={onLogin} showToast={showToast} />);

    fireEvent.click(screen.getByRole('button', { name: /continue as public viewer/i }));

    await waitFor(() => {
      expect(api.loginPublicViewer).toHaveBeenCalled();
    });

    expect(onLogin).toHaveBeenCalledWith({
      token: 'public-token',
      user: { id: '99', role: 'public', name: 'Public Viewer' },
    });
  });

  test('switches to Sign Up and shows role selection', async () => {
    const onLogin = vi.fn();
    const showToast = vi.fn();

    render(<LoginPage onLogin={onLogin} showToast={showToast} />);

    // Click Sign Up tab
    fireEvent.click(screen.getByTestId('signup-tab'));

    expect(screen.getByText(/select your role/i)).toBeInTheDocument();
    expect(screen.getAllByText(/authority/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/contractor/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/public citizen/i).length).toBeGreaterThan(0);
  });
});
