// Report Tracking — the signed-in user's own reports: stat cards, filters, table
// with edit/delete actions and a details modal with resubmit.
import { useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import ReportDetailsModal from './ReportDetailsModal';
import { useAuth } from '../../auth/AuthContext';
import { COLORS } from '../../theme';
import { Badge, Card, Icons, Menu, Pagination, Select, StatCard, Table, TextInput } from '../../components/ui';
import { INCIDENT_TYPES, REGIONS, REPORT_STATUSES, useReports } from '../../data/reportsStore';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const PAGE_SIZE = 8;

export default function ReportTracking() {
  const { user } = useAuth();
  const { reports, updateReport, deleteReport } = useReports();
  const [month, setMonth] = useState('January');
  const [year, setYear] = useState('2026');
  const [type, setType] = useState('All Type');
  const [region, setRegion] = useState('All Region');
  const [status, setStatus] = useState('All Status');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const mine = useMemo(() => reports.filter((r) => r.userId === user?.id), [reports, user]);

  const filtered = useMemo(
    () =>
      mine.filter(
        (r) =>
          (type === 'All Type' || r.type === type) &&
          (region === 'All Region' || r.region === region) &&
          (status === 'All Status' || r.status === status) &&
          (!search.trim() ||
            [r.id, r.type, r.region, r.location, r.description]
              .join(' ')
              .toLowerCase()
              .includes(search.trim().toLowerCase())),
      ),
    [mine, type, region, status, search],
  );

  const pages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns = [
    { key: 'id', label: 'Report ID' },
    { key: 'type', label: 'Type' },
    { key: 'region', label: 'Region' },
    { key: 'date', label: 'Submitted Date' },
    { key: 'status', label: 'Status' },
    { key: 'action', label: 'Action' },
  ];

  return (
    <Layout>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '26px 20px 60px' }}>
        <h1 style={{ textAlign: 'center', fontSize: 26, fontWeight: 800, margin: '4px 0 18px' }}>
          Report Tracking
        </h1>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 22 }}>
          <Select options={MONTHS} value={month} onChange={setMonth} style={{ width: 140 }} />
          <Select options={['2026', '2025']} value={year} onChange={setYear} style={{ width: 110 }} />
        </div>

        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 26, flexWrap: 'wrap' }}>
          <StatCard label="Total Reports" value={mine.length} />
          <StatCard label="Verified" value={mine.filter((r) => r.status === 'Verified').length} />
          <StatCard label="Under Review" value={mine.filter((r) => r.status === 'Under Review').length} />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
          {[
            { label: 'Type', value: type, set: setType, options: ['All Type', ...INCIDENT_TYPES] },
            { label: 'Region', value: region, set: setRegion, options: ['All Region', ...REGIONS] },
            { label: 'Status', value: status, set: setStatus, options: ['All Status', ...REPORT_STATUSES] },
          ].map((f) => (
            <div key={f.label}>
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, marginBottom: 4 }}>
                {f.label}
              </div>
              <Select options={f.options} value={f.value} onChange={(v) => { f.set(v); setPage(1); }} style={{ width: 150 }} />
            </div>
          ))}
          <div style={{ flex: 1, minWidth: 200 }}>
            <TextInput
              placeholder="Search Report"
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
            keyFor={(r) => r.id}
            renderCell={(r, key) => {
              if (key === 'status') return <Badge status={r.status} />;
              if (key === 'action') {
                const canEdit = r.status === 'Under Review';
                return (
                  <Menu
                    trigger={
                      <button style={{ border: 'none', background: 'none', color: COLORS.ink, padding: 4 }}>
                        <Icons.Dots size={20} />
                      </button>
                    }
                    items={[
                      canEdit
                        ? { label: 'Edit', icon: <Icons.Edit size={16} />, onClick: () => setSelected({ ...r, _edit: true }) }
                        : { label: 'View', icon: <Icons.Eye size={16} />, onClick: () => setSelected(r) },
                      {
                        label: 'Delete Report',
                        icon: <Icons.Trash size={16} />,
                        danger: true,
                        onClick: () => deleteReport(r.id),
                      },
                    ]}
                  />
                );
              }
              return r[key];
            }}
          />
          <Pagination page={page} pages={pages} onPage={setPage} />
        </Card>
      </div>

      <ReportDetailsModal
        report={selected}
        editable={selected?._edit}
        onClose={() => setSelected(null)}
        onResubmit={(draft) => {
          const patch = { ...draft, status: 'Under Review' };
          delete patch._edit;
          updateReport(patch.id, patch);
        }}
      />
    </Layout>
  );
}
