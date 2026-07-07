// Admin · Report Verification — review queue with verify / reject / duplicate
// actions, stat cards and a read-only details modal.
import { useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import ReportDetailsModal from '../reports/ReportDetailsModal';
import { COLORS } from '../../theme';
import { Badge, Card, Icons, Menu, Pagination, Select, StatCard, Table } from '../../components/ui';
import { INCIDENT_TYPES, REGIONS, useReports } from '../../data/reportsStore';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Admin-facing status labels (design uses "Pending Review" wording)
const STATUS_LABEL = { 'Under Review': 'Pending Review' };

const PAGE_SIZE = 8;

export default function ReportVerification() {
  const { reports, updateReport } = useReports();
  const [month, setMonth] = useState('January');
  const [year, setYear] = useState('2026');
  const [category, setCategory] = useState('All Categories');
  const [status, setStatus] = useState('All Status');
  const [location, setLocation] = useState('All Location');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(
    () =>
      reports.filter(
        (r) =>
          (category === 'All Categories' || r.type === category) &&
          (location === 'All Location' || r.region === location) &&
          (status === 'All Status' || r.status === status),
      ),
    [reports, category, location, status],
  );

  const pages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns = [
    { key: 'id', label: 'Report ID' },
    { key: 'type', label: 'Type' },
    { key: 'region', label: 'Location' },
    { key: 'severity', label: 'Severity' },
    { key: 'submittedBy', label: 'Submitted By' },
    { key: 'status', label: 'Status' },
    { key: 'action', label: 'Action' },
  ];

  return (
    <Layout>
      <div style={{ maxWidth: 1060, margin: '0 auto', padding: '26px 20px 60px' }}>
        <h1 style={{ textAlign: 'center', fontSize: 26, fontWeight: 800, margin: '4px 0 18px' }}>
          Report Verification
        </h1>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 22 }}>
          <Select options={MONTHS} value={month} onChange={setMonth} style={{ width: 140 }} />
          <Select options={['2026', '2025']} value={year} onChange={setYear} style={{ width: 110 }} />
        </div>

        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 26, flexWrap: 'wrap' }}>
          <StatCard label="Pending Review" value={reports.filter((r) => r.status === 'Under Review').length} />
          <StatCard label="Verified Reports" value={reports.filter((r) => r.status === 'Verified').length} />
          <StatCard label="Rejected Reports" value={reports.filter((r) => r.status === 'Rejected').length} />
          <StatCard label="High Severity" value={reports.filter((r) => r.severity === 'High').length} />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          {[
            { label: 'Categories', value: category, set: setCategory, options: ['All Categories', ...INCIDENT_TYPES] },
            { label: 'Status', value: status, set: setStatus, options: ['All Status', 'Under Review', 'Verified', 'Rejected', 'Duplicate'] },
            { label: 'Location', value: location, set: setLocation, options: ['All Location', ...REGIONS] },
          ].map((f) => (
            <div key={f.label}>
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, marginBottom: 4 }}>
                {f.label}
              </div>
              <Select
                options={f.options}
                value={f.value}
                onChange={(v) => {
                  f.set(v);
                  setPage(1);
                }}
                style={{ width: 160 }}
              />
            </div>
          ))}
        </div>

        <Card style={{ padding: '8px 10px' }}>
          <Table
            columns={columns}
            rows={pageRows}
            keyFor={(r) => r.id + r.submittedBy}
            renderCell={(r, key) => {
              if (key === 'severity') return r.severity;
              if (key === 'status')
                return <Badge status={r.status}>{STATUS_LABEL[r.status] || r.status}</Badge>;
              if (key === 'action')
                return (
                  <Menu
                    trigger={
                      <button style={{ border: 'none', background: 'none', color: COLORS.ink, padding: 4 }}>
                        <Icons.Dots size={20} />
                      </button>
                    }
                    items={[
                      { label: 'View Details', icon: <Icons.Eye size={16} />, onClick: () => setSelected(r) },
                      { label: 'Verify', icon: <Icons.Check size={16} />, onClick: () => updateReport(r.id, { status: 'Verified' }) },
                      { label: 'Mark Duplicate', icon: <Icons.Table size={16} />, onClick: () => updateReport(r.id, { status: 'Duplicate' }) },
                      { label: 'Reject', icon: <Icons.Close size={16} />, danger: true, onClick: () => updateReport(r.id, { status: 'Rejected' }) },
                    ]}
                  />
                );
              return r[key];
            }}
          />
          <Pagination page={page} pages={pages} onPage={setPage} />
        </Card>
      </div>

      <ReportDetailsModal report={selected} onClose={() => setSelected(null)} />
    </Layout>
  );
}
