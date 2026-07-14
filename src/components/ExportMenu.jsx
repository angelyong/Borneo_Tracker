import { useState } from 'react';
import { Icons, Menu } from './ui';
import { COLORS, FONT, RADII } from '../theme';
import { downloadElementAsPng, downloadIndicatorsCsv } from '../utils/exportReport';

// Reused as-is on both the ESG and SDG pages — one "Export" control, same
// CSV/PNG behaviour everywhere a canonical-indicator table is shown.
const ExportMenu = ({ targetRef, filenameBase, rows }) => {
  const [exportingPng, setExportingPng] = useState(false);

  const handleExportCsv = () => {
    downloadIndicatorsCsv(`${filenameBase}.csv`, rows);
  };

  const handleExportPng = async () => {
    if (!targetRef.current || exportingPng) return;
    setExportingPng(true);
    try {
      await downloadElementAsPng(targetRef.current, `${filenameBase}.png`);
    } catch {
      // A failed snapshot (e.g. an untainted-canvas edge case) shouldn't crash
      // the page — the CSV export is unaffected and still works.
    } finally {
      setExportingPng(false);
    }
  };

  return (
    <Menu
      trigger={
        <button type="button" style={styles.trigger} disabled={exportingPng} data-export-ignore="true">
          <Icons.Download size={16} color={COLORS.ink} />
          {exportingPng ? 'Exporting…' : 'Export'}
          <Icons.Chevron size={14} color={COLORS.muted} />
        </button>
      }
      items={[
        { label: 'Export as CSV', icon: <Icons.FileArrow size={16} />, onClick: handleExportCsv },
        { label: 'Export as PNG', icon: <Icons.Frame size={16} />, onClick: handleExportPng },
      ]}
    />
  );
};

const styles = {
  trigger: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    borderRadius: RADII.md,
    border: `1px solid ${COLORS.border}`,
    background: COLORS.card,
    color: COLORS.ink,
    fontSize: 14,
    fontWeight: 600,
    fontFamily: FONT,
    cursor: 'pointer',
  },
};

export default ExportMenu;
