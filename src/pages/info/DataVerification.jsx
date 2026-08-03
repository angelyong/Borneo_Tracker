// /data-sources — the long form of the integrity chip.
//
// Everything here is designed to be checkable by the reader rather than believed:
// the hashes are recomputed in their own browser, the commands can be pasted into
// their own terminal, and the block height links out to a block explorer we do
// not control.
//
// The "what this does not prove" panel is given the same weight as the proof
// itself, on purpose. A page that only lists green ticks would imply that being
// anchored makes the numbers true, which is exactly the mistake that made
// tokenised carbon credits worthless.

import { useTranslation } from 'react-i18next';
import { Card } from '../../components/ui';
import { INTEGRITY_STATE, servedUrl, useAnchorHistory, useIntegrity } from '../../data/useIntegrity';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

const TONE = {
  [INTEGRITY_STATE.VERIFIED]: { fg: 'var(--color-green)', bg: 'var(--color-green-soft)' },
  [INTEGRITY_STATE.PENDING]: { fg: 'var(--color-amber-dark)', bg: 'var(--color-yellow-soft)' },
  [INTEGRITY_STATE.MISMATCH]: { fg: 'var(--color-red)', bg: 'var(--color-red-soft)' },
  [INTEGRITY_STATE.UNVERIFIED]: { fg: 'var(--color-muted)', bg: 'var(--color-grey-soft)' },
};

function Pill({ status, children }) {
  const tone = TONE[status] || TONE[INTEGRITY_STATE.UNVERIFIED];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 9px',
        borderRadius: 999,
        background: tone.bg,
        color: tone.fg,
        fontWeight: 600,
        fontSize: 11,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden="true"
        style={{ width: 6, height: 6, borderRadius: '50%', background: tone.fg, flex: 'none' }}
      />
      {children}
    </span>
  );
}

function Section({ title, hint, children }) {
  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--color-ink)' }}>{title}</h2>
        {hint ? (
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--color-muted)' }}>{hint}</p>
        ) : null}
      </div>
      {children}
    </Card>
  );
}

export default function DataVerification() {
  const { t } = useTranslation();
  const { status, loading, manifest, manifestSha256, anchor, files } = useIntegrity();
  const history = useAnchorHistory();

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const state = status || INTEGRITY_STATE.UNVERIFIED;
  const confirmed = anchor?.status === 'confirmed';
  const blocks = anchor?.bitcoinBlocks || [];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        padding: '24px 0',
        maxWidth: 1000,
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            color: 'var(--color-muted)',
          }}
        >
          {t('verify.eyebrow')}
        </span>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, color: 'var(--color-ink)' }}>
          {t('verify.title')}
        </h1>
        <p style={{ margin: 0, maxWidth: '62ch', color: 'var(--color-muted)', fontSize: 15 }}>
          {t('verify.lede')}
        </p>
      </header>

      {/* Current version ---------------------------------------------------- */}
      <Section title={t('verify.currentTitle')} hint={t('verify.currentHint')}>
        {loading ? (
          <p style={{ margin: 0, color: 'var(--color-muted)' }}>{t('verify.checking')}</p>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <Pill status={state}>{t(`integrity.${state}.label`)}</Pill>
              <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                {t(`integrity.${state}.detail`)}
              </span>
            </div>
            {manifestSha256 ? (
              <div style={{ fontFamily: MONO, fontSize: 13, wordBreak: 'break-all', color: 'var(--color-ink)' }}>
                {manifestSha256}
              </div>
            ) : null}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 22px', fontSize: 12.5, color: 'var(--color-muted)' }}>
              {manifest?.generatedAt ? <span>{t('verify.built')}: {manifest.generatedAt}</span> : null}
              {anchor?.ledgerEntries ? (
                <span>{t('verify.versionsPublished', { count: anchor.ledgerEntries })}</span>
              ) : null}
            </div>
          </>
        )}
      </Section>

      {/* Files -------------------------------------------------------------- */}
      <Section title={t('verify.filesTitle')} hint={t('verify.filesHint')}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {[t('verify.colFile'), t('verify.colHash'), t('verify.colSize'), t('verify.colStatus')].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      textAlign: i === 2 ? 'right' : 'left',
                      padding: '9px 12px',
                      fontSize: 10.5,
                      letterSpacing: '.08em',
                      textTransform: 'uppercase',
                      color: 'var(--color-faint)',
                      borderBottom: '1px solid var(--color-border)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {files.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '12px', color: 'var(--color-muted)' }}>
                    {loading ? t('verify.checking') : t('verify.noManifest')}
                  </td>
                </tr>
              ) : (
                files.map((file) => (
                  <tr key={file.path}>
                    <td style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 12.5, borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                      {servedUrl(file.path)}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 12, color: 'var(--color-muted)', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                      {(file.actual || file.expected || '').slice(0, 16)}…
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-muted)', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                      {file.bytes ? `${file.bytes.toLocaleString()} B` : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-border)' }}>
                      <Pill status={file.match === true ? INTEGRITY_STATE.VERIFIED : file.match === false ? INTEGRITY_STATE.MISMATCH : INTEGRITY_STATE.UNVERIFIED}>
                        {file.match === true
                          ? t('verify.fileMatch')
                          : file.match === false
                            ? t('verify.fileMismatch')
                            : t('verify.fileUnreachable')}
                      </Pill>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Witnesses ---------------------------------------------------------- */}
      <Section title={t('verify.witnessTitle')} hint={t('verify.witnessHint')}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
          <WitnessCard
            name={t('verify.witnessBitcoin')}
            via="OpenTimestamps"
            status={confirmed ? INTEGRITY_STATE.VERIFIED : anchor ? INTEGRITY_STATE.PENDING : INTEGRITY_STATE.UNVERIFIED}
            label={confirmed ? t('verify.confirmed') : anchor ? t('verify.awaitingBlock') : t('verify.notAnchored')}
            rows={[
              [t('verify.block'), blocks.length ? blocks.join(', ') : '—'],
              [t('verify.proof'), anchor?.proof ? anchor.proof.split('/').pop() : '—'],
            ]}
            link={blocks.length ? { href: `https://mempool.space/block/${blocks[0]}`, text: t('verify.viewExplorer') } : null}
          />
          <WitnessCard
            name={t('verify.witnessSigstore')}
            via="Rekor transparency log"
            status={anchor?.sigstore ? INTEGRITY_STATE.VERIFIED : INTEGRITY_STATE.UNVERIFIED}
            label={anchor?.sigstore ? t('verify.logged') : t('verify.notAnchored')}
            rows={[
              [t('verify.entry'), anchor?.sigstore?.logIndex || '—'],
              [t('verify.signer'), anchor?.sigstore ? 'anchor.yml' : '—'],
            ]}
          />
          <WitnessCard
            name={t('verify.witnessPolygon')}
            via="Smart-contract anchor"
            status={INTEGRITY_STATE.UNVERIFIED}
            label={t('verify.notEnabled')}
            rows={[[t('verify.status'), '—'], [t('verify.cost'), '~$0.33 / yr']]}
            muted
          />
        </div>
      </Section>

      {/* Proves / does not prove -------------------------------------------- */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <div style={{ padding: 20, borderRight: '1px solid var(--color-border)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: 'var(--color-green)' }}>
              ✓ {t('verify.provesTitle')}
            </h3>
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-muted)' }}>{t('verify.provesBody')}</p>
          </div>
          <div style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: 'var(--color-red)' }}>
              ✕ {t('verify.notProvesTitle')}
            </h3>
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-muted)' }}>{t('verify.notProvesBody')}</p>
          </div>
        </div>
      </Card>

      {/* Verify it yourself -------------------------------------------------- */}
      <Section title={t('verify.yourselfTitle')} hint={t('verify.yourselfHint')}>
        <pre
          style={{
            margin: 0,
            padding: '13px 15px',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: 'var(--color-page-bg)',
            overflowX: 'auto',
            fontFamily: MONO,
            fontSize: 12.5,
            lineHeight: 1.7,
            color: 'var(--color-ink)',
          }}
        >
{`curl -s ${origin}/data/manifest.json | sha256sum
${manifestSha256 || ''}

ots verify manifest.json.ots
gh attestation verify manifest.json --repo angelyong/Borneo_Tracker`}
        </pre>
      </Section>

      {/* History ------------------------------------------------------------ */}
      <Section title={t('verify.historyTitle')} hint={t('verify.historyHint')}>
        {history.loading ? (
          <p style={{ margin: 0, color: 'var(--color-muted)' }}>{t('verify.checking')}</p>
        ) : history.events.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--color-muted)' }}>{t('verify.noHistory')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {history.events.slice(0, 20).map((event, index) => (
              <div
                key={`${event.manifestSha256}-${event.ts}-${index}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(90px, auto) 1fr auto',
                  gap: 14,
                  alignItems: 'center',
                  padding: '9px 0',
                  borderBottom: '1px solid var(--color-border)',
                  fontSize: 12.5,
                }}
              >
                <span style={{ color: 'var(--color-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {String(event.manifestGeneratedAt || event.ts).slice(0, 10)}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {String(event.manifestSha256 || '').slice(0, 40)}…
                </span>
                <Pill status={event.status === 'confirmed' ? INTEGRITY_STATE.VERIFIED : INTEGRITY_STATE.PENDING}>
                  {event.status === 'confirmed' ? t('verify.confirmed') : t('verify.awaitingBlock')}
                </Pill>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function WitnessCard({ name, via, status, label, rows, link, muted }) {
  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        padding: 15,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        opacity: muted ? 0.62 : 1,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-ink)' }}>{name}</div>
          <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{via}</div>
        </div>
        <Pill status={status}>{label}</Pill>
      </div>
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: 12 }}>
        {rows.map(([term, value]) => (
          <div key={term} style={{ display: 'contents' }}>
            <dt style={{ color: 'var(--color-faint)' }}>{term}</dt>
            <dd style={{ margin: 0, fontFamily: MONO, fontSize: 11.5, wordBreak: 'break-all', color: 'var(--color-ink)' }}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {link ? (
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-navy)', textDecoration: 'none' }}
        >
          {link.text} ↗
        </a>
      ) : null}
    </div>
  );
}
