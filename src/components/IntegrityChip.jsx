// Data-integrity chip — the visible end of ABCDE letter "B".
//
// Says whether the checked published files hash to the published Manifest.
// Page-level, like DataFreshness (which says how OLD the data is); this one says
// whether it has been ALTERED. Same visual language, same rule: colour is
// reinforcement only, every state is also spelled out in words.
//
// Four states, and the last two matter most. A badge that can only ever be green
// is decoration — the failure mode we set out to avoid. "Not verified" exists so
// that a missing anchor is never rendered as a passing one.

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { INTEGRITY_STATE, useIntegrity } from '../data/useIntegrity';

const STATUS_TONE = {
  [INTEGRITY_STATE.VERIFIED]: { fg: 'var(--color-green)', bg: 'var(--color-green-soft)' },
  [INTEGRITY_STATE.PENDING]: { fg: 'var(--color-amber-dark)', bg: 'var(--color-yellow-soft)' },
  [INTEGRITY_STATE.MISMATCH]: { fg: 'var(--color-red)', bg: 'var(--color-red-soft)' },
  [INTEGRITY_STATE.UNVERIFIED]: { fg: 'var(--color-muted)', bg: 'var(--color-grey-soft)' },
};

export default function IntegrityChip({ scope = 'overview', style }) {
  const { t } = useTranslation();
  const { status, loading, manifestSha256 } = useIntegrity(scope);

  // Nothing honest to claim while the check is still running — render nothing
  // rather than flashing a state and correcting it.
  if (loading || !status) return null;

  const tone = STATUS_TONE[status] || STATUS_TONE[INTEGRITY_STATE.UNVERIFIED];
  const label = t(`integrity.${status}.label`);
  const detail = t(`integrity.${status}.detail`);
  const short = manifestSha256 ? manifestSha256.slice(0, 8) : null;

  return (
    <Link
      to="/data-sources"
      title={detail}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        color: 'var(--color-muted)',
        textDecoration: 'none',
        minWidth: 0,
        ...style,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '2px 8px',
          borderRadius: 999,
          background: tone.bg,
          color: tone.fg,
          fontWeight: 600,
          fontSize: 10,
          whiteSpace: 'nowrap',
        }}
      >
        <span
          aria-hidden="true"
          style={{ width: 6, height: 6, borderRadius: '50%', background: tone.fg, flex: 'none' }}
        />
        {label}
      </span>
      {short ? (
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}>
          sha256 {short}…
        </span>
      ) : null}
    </Link>
  );
}
