import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Logo from '../components/Logo.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-art" aria-hidden="true">
        <Logo size={160} />
        <p className="auth-art-line">PICK UP<br />WHERE YOU<br />LEFT OFF.</p>
      </div>
      <form className="auth-form" onSubmit={handleSubmit}>
        <p className="kicker">Log in</p>
        <h1 className="h1">Welcome back</h1>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="btn btn-signal btn-block" type="submit" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        {error && <p className="error-text">{error}</p>}
        <p className="auth-switch">No account? <Link to="/register">Register</Link></p>
      </form>
    </div>
  );
}
