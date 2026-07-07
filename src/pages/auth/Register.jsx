import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useAuth } from '../../auth/AuthContext';
import { COLORS } from '../../theme';
import { Button, Field, PasswordInput, SuccessModal, TextInput } from '../../components/ui';

const cardStyle = {
  background: '#fff',
  borderRadius: 18,
  boxShadow: '0 2px 12px rgba(15,42,30,0.08)',
  padding: '28px 30px',
  marginTop: 18,
};

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1 = sign up, 2 = complete profile
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const finish = (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    try {
      register({ email, password, firstName, lastName });
      setDone(true);
      setTimeout(() => navigate('/'), 1600);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Layout>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '34px 20px 60px' }}>
        {step === 1 ? (
          <>
            <h1 style={{ textAlign: 'center', fontSize: 26, fontWeight: 800, marginBottom: 18 }}>
              Sign Up
            </h1>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setStep(2);
              }}
              style={cardStyle}
            >
              <Field label="Email" required>
                <TextInput
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>
              <Button type="submit" style={{ width: '100%', marginTop: 4 }}>
                Register
              </Button>
              <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, fontStyle: 'italic' }}>
                <Link to="/login" style={{ color: COLORS.ink }}>
                  Already have an account? Log in
                </Link>
              </div>
            </form>
          </>
        ) : (
          <>
            <h1 style={{ textAlign: 'center', fontSize: 26, fontWeight: 800, marginBottom: 2 }}>
              Complete your profile
            </h1>
            <p
              style={{
                textAlign: 'center',
                fontSize: 13.5,
                fontStyle: 'italic',
                fontWeight: 700,
                marginTop: 4,
              }}
            >
              Almost there! Please add a few more details to continue.
            </p>
            <form onSubmit={finish} style={cardStyle}>
              <Field label="First Name" required>
                <TextInput
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  style={{ maxWidth: 300 }}
                />
              </Field>
              <Field label="Last Name" required>
                <TextInput
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  style={{ maxWidth: 300 }}
                />
              </Field>
              <Field label="Password" required>
                <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required />
              </Field>
              <Field label="Confirm Password" required>
                <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </Field>

              {error && (
                <div style={{ color: COLORS.red, fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                  {error}
                </div>
              )}

              <Button type="submit" style={{ width: '100%', marginTop: 4 }}>
                Continue
              </Button>
            </form>
          </>
        )}
      </div>

      <SuccessModal open={done} message="Account created successfully." />
    </Layout>
  );
}
