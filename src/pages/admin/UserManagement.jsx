import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { getAllUsers, setUserStatus } from '../../services/adminUserService';
import { Badge, Card, Icons, Menu, Pagination, Select, Table, TextInput } from '../../components/ui';
import { COLORS, FONT, RADII } from '../../theme';

// The route is gated by <RequireAdmin>, so this page can assume an
// authenticated admin and just does the roster work.

const PAGE_SIZE = 8;
const STATUS_FILTERS = ['All Status', 'Active', 'Suspended'];

const titleCase = (value) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'role', label: 'Role' },
  { key: 'status', label: 'Status' },
  { key: 'joined', label: 'Joined' },
  { key: 'action', label: 'Action' },
];

const UserManagement = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [status, setStatus] = useState('All Status');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    getAllUsers()
      .then((rows) => {
        if (!cancelled) setUsers(rows);
      })
      .catch(() => {
        if (!cancelled) setError('Accounts could not be loaded right now.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3000);
  };

  const handleSetStatus = async (id, nextStatus) => {
    try {
      await setUserStatus(id, nextStatus);
      setUsers((current) => current.map((u) => (u.id === id ? { ...u, status: nextStatus } : u)));
      showNotice(nextStatus === 'suspended' ? 'Account suspended.' : 'Account reactivated.');
    } catch {
      showNotice('Could not update this account — please try again.');
    }
  };

  const filtered = useMemo(
    () =>
      users
        .filter((u) => status === 'All Status' || titleCase(u.status) === status)
        .filter((u) => {
          if (!search.trim()) return true;
          const q = search.trim().toLowerCase();
          return `${u.firstName} ${u.lastName}`.toLowerCase().includes(q);
        }),
    [users, status, search]
  );

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>User Management</h1>
        <p style={styles.subtitle}>Every registered account, with the ability to suspend or reactivate access.</p>
      </header>

      <div style={styles.controlsRow}>
        <div>
          <div style={styles.controlLabel}>Account Status</div>
          <Select
            options={STATUS_FILTERS}
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            style={{ width: 170 }}
          />
        </div>
        <div style={{ width: 260 }}>
          <div style={styles.controlLabel}>Search</div>
          <TextInput
            placeholder="Search by name"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {notice && <div style={styles.notice}>{notice}</div>}

      {loading && <div style={styles.stateCard}>Loading accounts…</div>}
      {!loading && error && <div style={{ ...styles.stateCard, color: COLORS.red }}>{error}</div>}

      {!loading && !error && (
        <Card style={{ padding: '8px 10px' }}>
          <Table
            columns={columns}
            rows={pageRows}
            keyFor={(u) => u.id}
            renderCell={(u, key) => {
              if (key === 'name') return `${u.firstName} ${u.lastName}`.trim() || '—';
              if (key === 'role') return u.role === 'admin' ? 'Admin' : 'User';
              if (key === 'status') return <Badge status={titleCase(u.status)} />;
              if (key === 'joined') return formatDate(u.createdAt);
              if (key === 'action') {
                if (currentUser?.id === u.id) {
                  return <span style={{ color: COLORS.faint, fontSize: 12.5 }}>You</span>;
                }
                return (
                  <Menu
                    trigger={
                      <button
                        style={{ border: 'none', background: 'none', color: COLORS.ink, padding: 4, cursor: 'pointer' }}
                        aria-label="Account actions"
                      >
                        <Icons.Dots size={20} />
                      </button>
                    }
                    items={[
                      u.status === 'suspended'
                        ? {
                            label: 'Reactivate account',
                            icon: <Icons.User size={16} />,
                            onClick: () => handleSetStatus(u.id, 'active'),
                          }
                        : {
                            label: 'Suspend account',
                            icon: <Icons.Warn size={16} />,
                            danger: true,
                            onClick: () => handleSetStatus(u.id, 'suspended'),
                          },
                    ]}
                  />
                );
              }
              return u[key];
            }}
          />
          <Pagination page={page} pages={pages} onPage={setPage} />
        </Card>
      )}
    </div>
  );
};

const styles = {
  page: { padding: 28, maxWidth: 1000, margin: '0 auto', fontFamily: FONT },
  header: { marginBottom: 20 },
  title: { fontSize: 26, fontWeight: 800, color: COLORS.ink, margin: 0 },
  subtitle: { fontSize: 14.5, color: COLORS.muted, margin: '6px 0 0', maxWidth: 560, lineHeight: 1.5 },

  controlsRow: { display: 'flex', gap: 14, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' },
  controlLabel: { fontSize: 12, fontWeight: 700, color: COLORS.muted, marginBottom: 4 },

  notice: {
    background: COLORS.greenSoft,
    color: COLORS.green,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADII.md,
    padding: '10px 16px',
    fontSize: 13.5,
    fontWeight: 600,
    marginBottom: 16,
  },

  stateCard: {
    background: COLORS.card,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADII.lg,
    padding: 28,
    textAlign: 'center',
    color: COLORS.muted,
    fontSize: 14.5,
  },
};

export default UserManagement;
