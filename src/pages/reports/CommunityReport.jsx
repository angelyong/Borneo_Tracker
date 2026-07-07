// Community Report — public view of verified community reports with stats, filters
// and a read-only details modal.
import { useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import ReportDetailsModal from './ReportDetailsModal';
import { COLORS } from '../../theme';
import { Badge, Card, Icons, Pagination, Select, StatCard, Table } from '../../components/ui';
import { INCIDENT_TYPES, REGIONS, useReports } from '../../data/reportsStore';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const PAGE_SIZE = 8;

export default function CommunityReport() {
  const { reports } = useReports();
  const [month, setMonth] = useState('January');
  const [year, setYear] = useState('2026');
  const [type, setType] = useState('All Type');
  const [region, setRegion] = useState('All Region');
  const [status, setStatus] = useState('All Status');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  // Public feed: verified + under-review reports (rejected/duplicates hidden)
  const visible = useMemo(
    () => reports.filter((r) => ['Verified', 'Under Review'].includes(r.status)),
    [reports],
  );

  const filtered = useMemo(
    () =>
      visible.filter(
        (r) =>
          (type === 'All Type' || r.type === type) &&
          (region === 'All Region' || r.region === region) &&
          (status === 'All Status' || r.status === status),
      ),
    [visible, type, region, status],
  );

  const pages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const thisMonth = visible.filter((r) => r.date?.startsWith('2026-01')).length;

  const columns = [
    { key: 'submittedBy', label: 'Submitted By' },
    { key: 'type', label: 'Type' },
    { key: 'region', label: 'Region' },
    { key: 'date', label: 'Date' },
    { key: 'status', label: 'Status' },
    { key: 'severity', label: 'Severity' },
    { key: 'view', label: '' },
  ];

  return (
    <Layout>
      <div style={{ maxWidth: 1060, margin: '0 auto', padding: '26px 20px 60px' }}>
        <h1 style={{ textAlign: 'center', fontSize: 26, fontWeight: 800, margin: '4px 0 18px' }}>
          Community Report
        </h1>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 22 }}>
          <Select options={MONTHS} value={month} onChange={setMonth} style={{ width: 140 }} />
          <Select options={['2026', '2025']} value={year} onChange={setYear} style={{ width: 110 }} />
        </div>

        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 26, flexWrap: 'wrap' }}>
          <StatCard label="Total Reports" value={visible.length} />
          <StatCard label="Verified" value={visible.filter((r) => r.status === 'Verified').length} />
          <StatCard label="Under Review" value={visible.filter((r) => r.status === 'Under Review').length} />
          <StatCard label="This Month" value={thisMonth} />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          {[
            { label: 'Type', value: type, set: setType, options: ['All Type', ...INCIDENT_TYPES] },
            { label: 'Region', value: region, set: setRegion, options: ['All Region', ...REGIONS] },
            { label: 'Status', value: status, set: setStatus, options: ['All Status', 'Verified', 'Under Review'] },
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
                style={{ width: 150 }}
              />
            </div>
          ))}
        </div>

        <Card style={{ padding: '8px 10px' }}>
          <Table
            columns={columns}
            rows={pageRows}
            keyFor={(r) => r.id}
            renderCell={(r, key) => {
              if (key === 'status') return <Badge status={r.status} />;
              if (key === 'severity') return <Badge status={r.severity} />;
              if (key === 'view')
                return (
                  <button
                    onClick={() => setSelected(r)}
                    title="View report"
                    style={{ border: 'none', background: 'none', color: COLORS.ink, padding: 4 }}
                  >
                    <Icons.FileArrow size={20} />
                  </button>
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
