import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout, { AuthCard } from '../../components/AuthLayout';
import { Button, Field, PasswordInput, TextInput } from '../../components/ui';
import { COLORS, FONT } from '../../theme';

const EMPTY_FORM = { firstName: '', lastName: '', email: '', password: '', confirm: '' };

// Same honesty scope as LoginPage: no backend to actually store an account
// against, so this validates the fields and logs the demo session straight
// in, matching how the rest of the app treats "auth" as a token flag only.
const RegisterPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  const setField = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.password) {
      setError('Fill in every field to create an account.');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    localStorage.setItem('authToken', 'demo-session');
    navigate('/');
  };

  return (
    <AuthLayout>
      <AuthCard>
        <h1 style={styles.title}>Create your account</h1>
        <p style={styles.subtitle}>
          Already have an account? <Link to="/login" style={styles.link}>Login.</Link>
        </p>

        <form onSubmit={handleSubmit}>
          <div style={styles.row}>
            <Field label="First name" required style={styles.rowField}>
              <TextInput value={form.firstName} onChange={setField('firstName')} placeholder="Json" />
            </Field>
            <Field label="Last name" required style={styles.rowField}>
              <TextInput value={form.lastName} onChange={setField('lastName')} placeholder="Chen" />
            </Field>
          </div>

          <Field label="Email" required>
            <TextInput type="email" value={form.email} onChange={setField('email')} placeholder="you@example.com" />
          </Field>

          <Field label="Password" required>
            <PasswordInput value={form.password} onChange={setField('password')} placeholder="Create a password" />
          </Field>

          <Field label="Confirm password" required>
            <PasswordInput value={form.confirm} onChange={setField('confirm')} placeholder="Re-enter your password" />
          </Field>

          {error && <p style={styles.error}>{error}</p>}

          <Button type="submit" variant="primary" style={styles.submitBtn}>
            Register
          </Button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
};

const styles = {
  title: { fontSize: 26, fontWeight: 800, color: COLORS.ink, textAlign: 'center', margin: '0 0 8px', fontFamily: FONT },
  subtitle: { fontSize: 14, color: COLORS.muted, textAlign: 'center', margin: '0 0 28px', fontFamily: FONT },
  link: { color: COLORS.ink, fontWeight: 700, textDecoration: 'underline' },
  row: { display: 'flex', gap: 16 },
  rowField: { flex: 1 },
  error: { fontSize: 13.5, color: COLORS.red, margin: '-8px 0 14px', fontFamily: FONT },
  submitBtn: { width: '100%', marginTop: 8 },
};

export default RegisterPage;
