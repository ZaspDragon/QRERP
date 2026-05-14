import { useState } from 'react';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import { useERP } from '../context/ERPContext';

export default function LoginPage() {
  const { firebaseReady, firebaseError, authLoading, signIn, sendPasswordReset } = useERP();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  async function handleLogin() {
    setStatus('');
    setError('');
    setIsWorking(true);

    try {
      await signIn(email.trim(), password);
      setStatus('Signed in. Loading warehouse data...');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to sign in.');
    } finally {
      setIsWorking(false);
    }
  }

  async function handleResetPassword() {
    setStatus('');
    setError('');

    if (!email.trim()) {
      setError('Enter your email before sending a password reset.');
      return;
    }

    setIsWorking(true);

    try {
      await sendPasswordReset(email.trim());
      setStatus('Password reset email sent.');
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Unable to send the password reset email.');
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <PageHeader
          eyebrow="Warehouse Auth"
          title="QR Warehouse ERP"
          description="Sign in with Firebase Auth to access receiving, put away, cycle count, order picking, inventory lookup, pull confirmations, employees, and history in one merged app."
        />

        <SectionCard title="Sign In" description="Use the same Firebase-backed login used by the Warehouse Ops module.">
          <div className="stack-form">
            <label>
              <span>Email</span>
              <input className="text-input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" />
            </label>
            <label>
              <span>Password</span>
              <input
                className="text-input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
              />
            </label>
            {!firebaseReady ? <div className="info-banner warning-banner">{firebaseError}</div> : null}
            {status ? <div className="info-banner success-banner">{status}</div> : null}
            {error ? <div className="info-banner danger-banner">{error}</div> : null}
            <div className="button-row">
              <button className="primary-button" type="button" disabled={!firebaseReady || isWorking || authLoading} onClick={() => void handleLogin()}>
                {authLoading ? 'Checking session...' : isWorking ? 'Signing In...' : 'Sign In'}
              </button>
              <button className="secondary-button" type="button" disabled={!firebaseReady || isWorking} onClick={() => void handleResetPassword()}>
                Reset Password
              </button>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
