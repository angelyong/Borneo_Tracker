// Admin · User Management — account table with suspend/reactivate actions.
import { useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../auth/AuthContext';
import { COLORS } from '../../theme';
import { Badge, Card, Icons, Menu, Pagination, Select, Table, TextInput } from '../../components/ui';

const PAGE_SIZE = 8;

export default function UserManagement() {
  const { users, setUserStatus } = useAuth();
  const [status, setStatus] = useState('All Status');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () =>
      users.filter(
        (u) =>
          (status === 'All Status' || u.status === status) &&
          (!search.trim() ||
            `${u.firstName} ${u.lastName} ${u.email}`
              .toLowerCase()
              .includes(search.trim().toLowerCase())),
      ),
    [users, status, search],
  );

  const pages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns = [
    { key: 'id', label: 'User ID' },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' },
    { key: 'status', label: 'Account Status' },
    { key: 'action', label: 'Action' },
  ];

  return (
    <Layout>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '26px 20px 60px' }}>
        <h1 style={{ textAlign: 'center', fontSize: 26, fontWeight: 800, margin: '4px 0 24px' }}>
          User Management
        </h1>

        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, marginBottom: 4 }}>
              Account Status
            </div>
            <Select
              options={['All Status', 'Active', 'Suspended']}
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              style={{ width: 170 }}
            />
          </div>
          <div style={{ width: 260 }}>
            <TextInput
              placeholder="Search User"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{ fontStyle: 'italic' }}
            />
          </div>
        </div>

        <Card style={{ padding: '8px 10px' }}>
          <Table
            columns={columns}
            rows={pageRows}
            keyFor={(u) => u.id}
            renderCell={(u, key) => {
              if (key === 'name') return `${u.firstName} ${u.lastName}`.trim();
              if (key === 'role') return u.role === 'admin' ? 'Admin' : 'User';
              if (key === 'status') return <Badge status={u.status} />;
              if (key === 'action')
                return (
                  <Menu
                    trigger={
                      <button style={{ border: 'none', background: 'none', color: COLORS.ink, padding: 4 }}>
                        <Icons.Dots size={20} />
                      </button>
                    }
                    items={[
                      u.status === 'Suspended'
                        ? {
                            label: 'Reactive Account',
                            icon: <Icons.User size={16} />,
                            onClick: () => setUserStatus(u.id, 'Active'),
                          }
                        : {
                            label: 'Suspend',
                            icon: <Icons.Warn size={16} />,
                            danger: true,
                            onClick: () => setUserStatus(u.id, 'Suspended'),
                          },
                    ]}
                  />
                );
              return u[key];
            }}
          />
          <Pagination page={page} pages={pages} onPage={setPage} />
        </Card>
      </div>
    </Layout>
  );
}
