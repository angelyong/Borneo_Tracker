// /data-sources — the long form of the integrity chip.
//
// Everything here is designed to be checkable by the reader rather than believed:
// the hashes are recomputed in their own browser, the commands can be pasted into
// their own terminal, and the block height links out to a block explorer we do
// not control.
//
// Laid out as a ledger rather than a marketing page: the fingerprint is the hero
// because the fingerprint IS the content, evidence is set in mono against prose
// in sans, figures are tabular, and rules are hairlines. The status colour runs
// down the left edge of the hero so the state is legible before a word is read.
//
// The "what this does not prove" panel gets the same width as the proof, on
// purpose. A page of green ticks would imply that being anchored makes the
// numbers true, which is exactly the reasoning that made tokenised carbon
// credits worthless.

import { useTranslation } from 'react-i18next';
import { INTEGRITY_STATE, servedUrl, useAnchorHistory, useIntegrity } from '../../data/useIntegrity';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

const TONE = {
  [INTEGRITY_STATE.VERIFIED]: { fg: 'var(--color-green)', bg: 'var(--color-green-soft)' },
  [INTEGRITY_STATE.PENDING]: { fg: 'var(--color-amber-dark)', bg: 'var(--color-yellow-soft)' },
  [INTEGRITY_STATE.MISMATCH]: { fg: 'var(--color-red)', bg: 'var(--color-red-soft)' },
  [INTEGRITY_STATE.UNVERIFIED]: { fg: 'var(--color-muted)', bg: 'var(--color-grey-soft)' },
};

const toneOf = (status) => TONE[status] || TONE[INTEGRITY_STATE.UNVERIFIED];

const surface = {
  background: 'var(--color-card)',
  border: '1px solid var(--color-border)',
  borderRadius: 14,
};

function Pill({ status, children, size = 'sm' }) {
  const tone = toneOf(status);
  const big = size === 'lg';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: big ? 7 : 5,
        padding: big ? '5px 12px' : '2px 9px',
        borderRadius: 999,
        background: tone.bg,
        color: tone.fg,
        fontWeight: 600,
        fontSize: big ? 12.5 : 11,
        letterSpacing: '.01em',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: big ? 7 : 6,
          height: big ? 7 : 6,
          borderRadius: '50%',
          background: tone.fg,
          flex: 'none',
        }}
      />
      {children}
    </span>
  );
}

function Eyebrow({ children }) {
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '.13em',
        textTransform: 'uppercase',
        color: 'var(--color-faint)',
      }}
    >
      {children}
    </span>
  );
}

function Section({ eyebrow, title, hint, children, pad = 22 }) {
  return (
    <section style={{ ...surface, overflow: 'hidden' }}>
      <div
        style={{
          padding: `18px ${pad}px 14px`,
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h2 style={{ margin: 0, fontSize: 16.5, fontWeight: 600, color: 'var(--color-ink)', letterSpacing: '-.01em' }}>
          {title}
        </h2>
        {hint ? (
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--color-muted)', maxWidth: '68ch' }}>{hint}</p>
        ) : null}
      </div>
      <div style={{ padding: pad }}>{children}</div>
    </section>
  );
}

export default function DataVerification() {
  const { t } = useTranslation();
  const { status, loading, manifest, manifestSha256, anchor, files } = useIntegrity();
  const history = useAnchorHistory();

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const state = status || INTEGRITY_STATE.UNVERIFIED;
  const tone = toneOf(state);
  const confirmed = anchor?.status === 'confirmed';
  const blocks = anchor?.bitcoinBlocks || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 0 40px', maxWidth: 1020 }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <Eyebrow>{t('verify.eyebrow')}</Eyebrow>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--color-ink)' }}>
          {t('verify.title')}
        </h1>
        <p style={{ margin: 0, maxWidth: '64ch', color: 'var(--color-muted)', fontSize: 14.5, lineHeight: 1.65 }}>
          {t('verify.lede')}
        </p>
      </header>

      {/* Hero — the fingerprint is the content, so it is the largest thing here. */}
      <div style={{ ...surface, display: 'flex', overflow: 'hidden' }}>
        <div aria-hidden="true" style={{ width: 4, background: tone.fg, flex: 'none' }} />
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0, flex: 1 }}>
          {loading ? (
            <p style={{ margin: 0, color: 'var(--color-muted)' }}>{t('verify.checking')}</p>
          ) : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                <Pill status={state} size="lg">{t(`integrity.${state}.label`)}</Pill>
                <span style={{ fontSize: 13, color: 'var(--color-muted)', maxWidth: '60ch', lineHeight: 1.5 }}>
                  {t(`integrity.${state}.detail`)}
                </span>
              </div>

              {manifestSha256 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <Eyebrow>{t('verify.colHash')}</Eyebrow>
                  <code
                    style={{
                      fontFamily: MONO,
                      fontSize: 15,
                      lineHeight: 1.55,
                      wordBreak: 'break-all',
                      color: 'var(--color-ink)',
                    }}
                  >
                    {manifestSha256}
                  </code>
                </div>
              ) : null}

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px 26px',
                  fontSize: 12.5,
                  color: 'var(--color-muted)',
                  borderTop: '1px solid var(--color-border)',
                  paddingTop: 12,
                }}
              >
                {manifest?.generatedAt ? (
                  <span>
                    {t('verify.built')}{' '}
                    <b style={{ fontFamily: MONO, fontWeight: 500, color: 'var(--color-ink)' }}>
                      {manifest.generatedAt}
                    </b>
                  </span>
                ) : null}
                {anchor?.ledgerEntries ? (
                  <span>{t('verify.versionsPublished', { count: anchor.ledgerEntries })}</span>
                ) : null}
                {blocks.length ? (
                  <span>
                    {t('verify.block')}{' '}
                    <b style={{ fontFamily: MONO, fontWeight: 500, color: 'var(--color-ink)' }}>{blocks[0]}</b>
                  </span>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Files -------------------------------------------------------------- */}
      <Section eyebrow={t('verify.currentTitle')} title={t('verify.filesTitle')} hint={t('verify.filesHint')} pad={0}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {[t('verify.colFile'), t('verify.colHash'), t('verify.colSize'), t('verify.colStatus')].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      textAlign: i === 2 ? 'right' : 'left',
                      padding: '10px 22px',
                      fontSize: 10.5,
                      letterSpacing: '.1em',
                      textTransform: 'uppercase',
                      color: 'var(--color-faint)',
                      fontWeight: 700,
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
                  <td colSpan={4} style={{ padding: '16px 22px', color: 'var(--color-muted)' }}>
                    {loading ? t('verify.checking') : t('verify.noManifest')}
                  </td>
                </tr>
              ) : (
                files.map((file) => {
                  const fileState =
                    file.match === true
                      ? INTEGRITY_STATE.VERIFIED
                      : file.match === false
                        ? INTEGRITY_STATE.MISMATCH
                        : INTEGRITY_STATE.UNVERIFIED;
                  const cell = {
                    padding: '11px 22px',
                    borderBottom: '1px solid var(--color-border)',
                    whiteSpace: 'nowrap',
                  };
                  return (
                    <tr key={file.path}>
                      <td style={{ ...cell, fontFamily: MONO, fontSize: 12.5, color: 'var(--color-ink)' }}>
                        {servedUrl(file.path)}
                      </td>
                      <td style={{ ...cell, fontFamily: MONO, fontSize: 12, color: 'var(--color-muted)' }}>
                        {(file.actual || file.expected || '').slice(0, 20)}…
                      </td>
                      <td
                        style={{
                          ...cell,
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          color: 'var(--color-muted)',
                        }}
                      >
                        {file.bytes ? `${file.bytes.toLocaleString()} B` : '—'}
                      </td>
                      <td style={cell}>
                        <Pill status={fileState}>
                          {file.match === true
                            ? t('verify.fileMatch')
                            : file.match === false
                              ? t('verify.fileMismatch')
                              : t('verify.fileUnreachable')}
                        </Pill>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Witnesses ---------------------------------------------------------- */}
      <Section eyebrow={t('verify.eyebrow')} title={t('verify.witnessTitle')} hint={t('verify.witnessHint')}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(232px, 1fr))', gap: 14 }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        <Claim
          tone="var(--color-green)"
          bg="var(--color-green-soft)"
          mark="✓"
          title={t('verify.provesTitle')}
          body={t('verify.provesBody')}
        />
        <Claim
          tone="var(--color-red)"
          bg="var(--color-red-soft)"
          mark="✕"
          title={t('verify.notProvesTitle')}
          body={t('verify.notProvesBody')}
        />
      </div>

      {/* Verify it yourself -------------------------------------------------- */}
      <Section eyebrow={t('verify.eyebrow')} title={t('verify.yourselfTitle')} hint={t('verify.yourselfHint')}>
        <pre
          style={{
            margin: 0,
            padding: '15px 17px',
            borderRadius: 10,
            border: '1px solid var(--color-border)',
            background: 'var(--color-page-bg)',
            overflowX: 'auto',
            fontFamily: MONO,
            fontSize: 12.5,
            lineHeight: 1.75,
            color: 'var(--color-ink)',
          }}
        >
{`$ curl -s ${origin}/data/manifest.json | sha256sum
`}
          <span style={{ color: 'var(--color-green)' }}>{manifestSha256 || '…'}</span>
{`

$ ots verify manifest.json.ots
$ gh attestation verify manifest.json --repo angelyong/Borneo_Tracker`}
        </pre>
      </Section>

      {/* History ------------------------------------------------------------ */}
      <Section eyebrow={t('verify.eyebrow')} title={t('verify.historyTitle')} hint={t('verify.historyHint')} pad={0}>
        <div style={{ padding: '4px 22px 14px' }}>
          {history.loading ? (
            <p style={{ margin: '12px 0', color: 'var(--color-muted)' }}>{t('verify.checking')}</p>
          ) : history.events.length === 0 ? (
            <p style={{ margin: '12px 0', color: 'var(--color-muted)' }}>{t('verify.noHistory')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {history.events.slice(0, 20).map((event, index) => (
                <div
                  key={`${event.manifestSha256}-${event.ts}-${index}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(92px, auto) 1fr auto',
                    gap: 16,
                    alignItems: 'center',
                    padding: '10px 0',
                    borderBottom:
                      index === Math.min(history.events.length, 20) - 1
                        ? 'none'
                        : '1px solid var(--color-border)',
                    fontSize: 12.5,
                  }}
                >
                  <span style={{ color: 'var(--color-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {String(event.manifestGeneratedAt || event.ts).slice(0, 10)}
                  </span>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 11.5,
                      color: 'var(--color-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {String(event.manifestSha256 || '').slice(0, 44)}…
                  </span>
                  <Pill status={event.status === 'confirmed' ? INTEGRITY_STATE.VERIFIED : INTEGRITY_STATE.PENDING}>
                    {event.status === 'confirmed' ? t('verify.confirmed') : t('verify.awaitingBlock')}
                  </Pill>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

function Claim({ tone, bg, mark, title, body }) {
  return (
    <div style={{ ...surface, display: 'flex', overflow: 'hidden' }}>
      <div aria-hidden="true" style={{ width: 4, background: tone, flex: 'none' }} />
      <div style={{ padding: '18px 20px' }}>
        <h3
          style={{
            margin: '0 0 8px',
            fontSize: 14,
            fontWeight: 600,
            color: tone,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: bg,
              fontSize: 12,
              flex: 'none',
            }}
          >
            {mark}
          </span>
          {title}
        </h3>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: 'var(--color-muted)' }}>{body}</p>
      </div>
    </div>
  );
}

function WitnessCard({ name, via, status, label, rows, link, muted }) {
  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        padding: '15px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        background: 'var(--color-page-bg)',
        opacity: muted ? 0.6 : 1,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-ink)' }}>{name}</div>
          <div style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>{via}</div>
        </div>
        <Pill status={status}>{label}</Pill>
      </div>
      <dl
        style={{
          margin: 0,
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: '5px 12px',
          fontSize: 11.5,
          borderTop: '1px solid var(--color-border)',
          paddingTop: 10,
        }}
      >
        {rows.map(([term, value]) => (
          <div key={term} style={{ display: 'contents' }}>
            <dt style={{ color: 'var(--color-faint)' }}>{term}</dt>
            <dd
              style={{
                margin: 0,
                fontFamily: MONO,
                fontSize: 11.5,
                wordBreak: 'break-all',
                color: 'var(--color-ink)',
                textAlign: 'right',
              }}
            >
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
