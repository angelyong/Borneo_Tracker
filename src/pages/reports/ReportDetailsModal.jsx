// Report Details modal — view (community/admin) or edit + resubmit (own reports).
import { useState } from 'react';
import { COLORS, RADII } from '../../theme';
import { Badge, Button, Modal, Select, TextArea, TextInput } from '../../components/ui';
import { INCIDENT_TYPES, SEVERITIES } from '../../data/reportsStore';

export default function ReportDetailsModal({ report, onClose, editable, onResubmit }) {
  const [draft, setDraft] = useState(report);
  const [prevReport, setPrevReport] = useState(report);
  if (report !== prevReport) {
    // reset draft when a different report is opened (render-phase state sync)
    setPrevReport(report);
    setDraft(report);
  }
  if (!report || !draft) return null;

  const set = (k) => (v) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <Modal open={!!report} onClose={onClose} width={640}>
      <h2 style={{ fontSize: 24, fontWeight: 800, margin: '2px 0 18px' }}>Report Details</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', rowGap: 14, alignItems: 'center' }}>
        <div style={{ fontWeight: 700 }}>Report ID</div>
        <div>{report.id}</div>

        <div style={{ fontWeight: 700 }}>Report Status</div>
        <div>
          <Badge status={report.status} />
        </div>

        <div style={{ fontWeight: 700 }}>Submitted By</div>
        <div>{report.submittedBy}</div>

        <div style={{ fontWeight: 700 }}>Incident Type</div>
        <div>
          {editable ? (
            <Select options={INCIDENT_TYPES} value={draft.type} onChange={set('type')} style={{ width: 180 }} />
          ) : (
            report.type
          )}
        </div>

        <div style={{ fontWeight: 700 }}>Severity</div>
        <div>
          {editable ? (
            <Select options={SEVERITIES} value={draft.severity} onChange={set('severity')} style={{ width: 180 }} />
          ) : (
            <Badge status={report.severity} />
          )}
        </div>
      </div>

      {/* Photo evidence */}
      <div style={{ margin: '18px 0' }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Photo Evidence</div>
        <div
          style={{
            background: '#E8E8E8',
            borderRadius: RADII.lg,
            padding: 22,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          {draft.photo ? (
            <img
              src={draft.photo}
              alt="Report evidence"
              style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8 }}
            />
          ) : (
            <div style={{ color: COLORS.muted, fontSize: 14, padding: '30px 0' }}>
              No photo attached.
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', rowGap: 12, alignItems: 'center' }}>
        <div style={{ fontWeight: 700 }}>Location</div>
        {editable ? (
          <TextInput value={draft.location} onChange={(e) => set('location')(e.target.value)} />
        ) : (
          <div>{report.location}</div>
        )}

        <div style={{ fontWeight: 700 }}>Region</div>
        <div>{report.region}</div>

        <div style={{ fontWeight: 700 }}>Description</div>
        {editable ? (
          <TextArea rows={2} value={draft.description} onChange={(e) => set('description')(e.target.value)} />
        ) : (
          <div>{report.description}</div>
        )}

        <div style={{ fontWeight: 700 }}>Incident Time</div>
        <div>
          {report.date} &nbsp; {report.time}
        </div>

        {report.extra && (
          <>
            <div style={{ fontWeight: 700 }}>Details</div>
            <div>{report.extra}</div>
          </>
        )}
      </div>

      {editable && (
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Button
            onClick={() => {
              onResubmit(draft);
              onClose();
            }}
            style={{ width: 260 }}
          >
            Resubmit Report
          </Button>
        </div>
      )}
    </Modal>
  );
}
