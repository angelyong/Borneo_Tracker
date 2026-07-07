// Mock client-side auth for the redesign demo. No backend: users + session live in
// localStorage so registration, roles and profile edits survive reloads.
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const USERS_KEY = 'bt_users';
const SESSION_KEY = 'bt_session';

const SEED_USERS = [
  {
    id: '001',
    firstName: 'Json',
    lastName: 'Chen',
    email: 'json@gmail.com',
    password: 'user1234',
    role: 'user',
    status: 'Active',
    phone: '1812345678',
    phoneCode: '+60',
    address: '15, Jalan Permas 12/10, Bandar Baru Permas Jaya',
    city: 'Masai',
    state: "Johor Darul Ta'zim",
    postalCode: '81750',
  },
  {
    id: '002',
    firstName: 'Ivy',
    lastName: '',
    email: 'ivyivy@gmail.com',
    password: 'admin1234',
    role: 'admin',
    status: 'Active',
    phone: '',
    phoneCode: '+60',
    address: '',
    city: '',
    state: '',
    postalCode: '',
  },
  {
    id: '003',
    firstName: 'Irene',
    lastName: 'Teo',
    email: 'ireneTeo@gmail.com',
    password: 'user1234',
    role: 'user',
    status: 'Suspended',
    phone: '',
    phoneCode: '+60',
    address: '',
    city: '',
    state: '',
    postalCode: '',
  },
];

function loadUsers() {
  try {
    const raw = JSON.parse(localStorage.getItem(USERS_KEY));
    if (Array.isArray(raw) && raw.length) return raw;
  } catch {
    /* fall through to seed */
  }
  localStorage.setItem(USERS_KEY, JSON.stringify(SEED_USERS));
  return SEED_USERS;
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [users, setUsers] = useState(loadUsers);
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY));
    } catch {
      return null;
    }
  });

  useEffect(() => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }, [users]);
  useEffect(() => {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  }, [session]);

  const value = useMemo(() => {
    const user = session ? users.find((u) => u.id === session.userId) : null;
    return {
      user, // null = public visitor
      users,
      isAdmin: user?.role === 'admin',

      login(email, password) {
        const u = users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
        if (!u || u.password !== password) throw new Error('Invalid email or password.');
        if (u.status === 'Suspended') throw new Error('This account has been suspended.');
        setSession({ userId: u.id });
        return u;
      },

      register({ email, password, firstName, lastName }) {
        if (users.some((x) => x.email.toLowerCase() === email.trim().toLowerCase()))
          throw new Error('An account with this email already exists.');
        const u = {
          id: String(users.length + 1).padStart(3, '0'),
          firstName,
          lastName,
          email: email.trim(),
          password,
          role: 'user',
          status: 'Active',
          phone: '',
          phoneCode: '+60',
          address: '',
          city: '',
          state: '',
          postalCode: '',
        };
        setUsers((prev) => [...prev, u]);
        setSession({ userId: u.id });
        return u;
      },

      logout() {
        setSession(null);
      },

      updateProfile(patch) {
        if (!user) return;
        setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...patch } : u)));
      },

      resetPassword(email, newPassword) {
        setUsers((prev) =>
          prev.map((u) =>
            u.email.toLowerCase() === email.trim().toLowerCase()
              ? { ...u, password: newPassword }
              : u,
          ),
        );
      },

      // Admin: user management
      setUserStatus(id, status) {
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status } : u)));
      },
    };
  }, [users, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
