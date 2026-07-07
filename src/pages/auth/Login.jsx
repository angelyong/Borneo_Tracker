import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useAuth } from '../../auth/AuthContext';
import { COLORS } from '../../theme';
import { Button, Field, Modal, PasswordInput, TextInput } from '../../components/ui';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [findOpen, setFindOpen] = useState(false);
  const [findEmail, setFindEmail] = useState('');

  const submit = (e) => {
    e.preventDefault();
    try {
      login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Layout>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '34px 20px 60px' }}>
        <h1 style={{ textAlign: 'center', fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Login</h1>
        <p style={{ textAlign: 'center', fontSize: 13.5, color: COLORS.ink, marginTop: 0 }}>
          Don't have any account?{' '}
          <Link to="/register" style={{ fontWeight: 700, fontStyle: 'italic' }}>
            Register now.
          </Link>
        </p>

        <form
          onSubmit={submit}
          style={{
            background: '#fff',
            borderRadius: 18,
            boxShadow: '0 2px 12px rgba(15,42,30,0.08)',
            padding: '28px 30px',
            marginTop: 18,
          }}
        >
          <Field label="Email" required>
            <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Password" required>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>

          {error && (
            <div style={{ color: COLORS.red, fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
              {error}
            </div>
          )}

          <Button type="submit" style={{ width: '100%', marginTop: 4 }}>
            Sign In
          </Button>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button
              type="button"
              onClick={() => setFindOpen(true)}
              style={{
                border: 'none',
                background: 'none',
                fontSize: 13,
                fontStyle: 'italic',
                textDecoration: 'underline',
                color: COLORS.ink,
              }}
            >
              Forgotten your password?
            </button>
          </div>
        </form>
      </div>

      {/* Find your account (forgot password) */}
      <Modal open={findOpen} onClose={() => setFindOpen(false)} width={520}>
        <h2 style={{ textAlign: 'center', fontSize: 22, fontWeight: 800, marginTop: 4 }}>
          Find your account
        </h2>
        <p style={{ textAlign: 'center', fontSize: 13.5, color: COLORS.muted }}>
          Please enter the email address that you signed up with and we'll sent you a link to reset
          your password by email.
        </p>
        <TextInput
          type="email"
          value={findEmail}
          onChange={(e) => setFindEmail(e.target.value)}
          placeholder="Email address"
          style={{ background: '#F3F4F6', border: 'none', padding: '16px 14px', marginTop: 8 }}
        />
        <div style={{ textAlign: 'center', marginTop: 22 }}>
          <Button
            variant="navy"
            onClick={() => {
              setFindOpen(false);
              navigate('/reset-password', { state: { email: findEmail } });
            }}
            style={{ width: 220 }}
          >
            Submit
          </Button>
        </div>
      </Modal>
    </Layout>
  );
}
