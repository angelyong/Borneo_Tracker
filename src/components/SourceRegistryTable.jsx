import { useTranslation } from 'react-i18next';
import { CADENCE_DAYS, registrySources, safeOfficialUrl } from '../utils/sourceRegistry';

function cadenceText(source, t) {
  const cadence = source.cadence || 'irregular';
  const standard = CADENCE_DAYS[cadence];
  if (standard && source.expected_interval_days === standard) return t(`sourceRegistry.cadence.${cadence}`);
  if (Number.isInteger(source.expected_interval_days) && source.expected_interval_days > 0) {
    return t('sourceRegistry.cadence.custom', { cadence: t(`sourceRegistry.cadence.${cadence}`), days: source.expected_interval_days });
  }
  return t(`sourceRegistry.cadence.${cadence}`);
}

function formatGeneratedAt(value, language) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  // Date accepts and normalises impossible dates (e.g. 2026-02-30). Require
  // a round-trip match so a registry never appears freshly generated on a
  // different day than the publisher recorded.
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) return null;
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeZone: 'UTC' }).format(parsed);
}

export default function SourceRegistryTable({ payload, loading, error, generatedAt, onRetry }) {
  const { t, i18n } = useTranslation();
  const sources = registrySources(payload);
  const date = formatGeneratedAt(generatedAt, i18n.language);
  const freshness = <p style={{ margin: '0 0 12px', color: 'var(--color-muted)', fontSize: 12.5 }}>{date ? t('sourceRegistry.generatedAt', { date }) : t('sourceRegistry.generatedAtUnknown')}</p>;

  if (loading) return <p role="status" style={{ margin: 0, color: 'var(--color-muted)' }}>{t('sourceRegistry.loading')}</p>;
  if (error) {
    return (
      <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', color: 'var(--color-muted)' }}>
        <span>{t('sourceRegistry.error')}</span>
        <button type="button" onClick={onRetry}>{t('common.retry')}</button>
      </div>
    );
  }
  if (!sources.length) return <div>{freshness}<p style={{ margin: 0, color: 'var(--color-muted)' }}>{t('sourceRegistry.empty')}</p></div>;

  return (
    <div>
      {freshness}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <caption style={{ textAlign: 'left', padding: '0 0 12px', color: 'var(--color-muted)' }}>{t('sourceRegistry.caption')}</caption>
        <thead>
          <tr>
            {[t('sourceRegistry.source'), t('sourceRegistry.cadenceLabel'), t('sourceRegistry.coverage'), t('sourceRegistry.licence')].map((label) => (
              <th key={label} scope="col" style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--color-border)', color: 'var(--color-faint)', fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase' }}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sources.map((source, index) => {
            const url = safeOfficialUrl(source.official_url);
            const cell = { padding: '13px 12px', verticalAlign: 'top', borderBottom: index === sources.length - 1 ? 'none' : '1px solid var(--color-border)' };
            return (
              <tr key={source.source_id}>
                <td style={cell}>
                  {url ? <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-navy)', fontWeight: 600 }}>{source.display_name} <span aria-hidden="true">↗</span><span style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}> ({t('sourceRegistry.opensOfficialSite')})</span></a> : <span style={{ fontWeight: 600 }}>{source.display_name}</span>}
                  <div style={{ marginTop: 3, color: 'var(--color-muted)', fontSize: 11.5 }}>{source.publisher}</div>
                </td>
                <td style={{ ...cell, whiteSpace: 'nowrap' }}>{cadenceText(source, t)}</td>
                <td style={cell}>
                  <div>{(source.territories || []).join(' · ') || '—'}</div>
                  <div style={{ marginTop: 3, color: 'var(--color-muted)', fontSize: 11.5 }}>{(source.pillars || []).join(' · ') || '—'}</div>
                </td>
                <td style={{ ...cell, color: 'var(--color-muted)', minWidth: 180 }}>{source.licence || '—'}</td>
              </tr>
            );
          })}
        </tbody>
        </table>
      </div>
    </div>
  );
}
