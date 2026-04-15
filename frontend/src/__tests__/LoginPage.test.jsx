import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../utils/api', () => ({
  api: {
    login: vi.fn(),
    signup: vi.fn(),
    getWalletOptions: vi.fn(),
  },
}));

import LoginPage from '../pages/LoginPage.jsx';
import { api } from '../utils/api';

describe('LoginPage', () => {
  test('shows validation error when login fields are empty', async () => {
    const onLogin = vi.fn();
    const showToast = vi.fn();

    render(<LoginPage onLogin={onLogin} showToast={showToast} />);

    fireEvent.click(screen.getByRole('button', { name: /login as authority/i }));

    expect(showToast).toHaveBeenCalledWith('Enter username and password', 'error');
    expect(onLogin).not.toHaveBeenCalled();
  });

  test('logs in with selected role credentials', async () => {
    const onLogin = vi.fn();
    const showToast = vi.fn();

    api.login.mockResolvedValue({
      data: {
        token: 'demo-token',
        user: { id: '1', role: 'contractor', name: 'Contractor One', username: 'c1' },
      },
    });

    render(<LoginPage onLogin={onLogin} showToast={showToast} />);

    fireEvent.click(screen.getByRole('button', { name: /contractor/i }));
    fireEvent.change(screen.getByPlaceholderText(/enter username/i), { target: { value: 'c1' } });
    fireEvent.change(screen.getByPlaceholderText(/enter password/i), { target: { value: 'Secret@123' } });
    fireEvent.click(screen.getByRole('button', { name: /login as contractor/i }));

    await waitFor(() => expect(api.login).toHaveBeenCalledWith({
      role: 'contractor',
      username: 'c1',
      password: 'Secret@123',
    }));

    expect(onLogin).toHaveBeenCalledWith({
      token: 'demo-token',
      user: { id: '1', role: 'contractor', name: 'Contractor One', username: 'c1' },
    });
  });
});
