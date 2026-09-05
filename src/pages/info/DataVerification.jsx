// /data-sources — the long form of the integrity chip.
//
// DESIGN NOTE
//   The page is a ledger, not a marketing page, and its boldness is spent in
//   exactly one place: the hero band, in the brand teal, carrying the fingerprint
//   as display type. That fingerprint IS the content of this page — everything
//   else is either a summary of it or a way to check it — so it gets the weight,
//   and every other surface stays quiet and precise around it.
//
//   Evidence is set in mono, prose in sans; figures are tabular so columns line
//   up; rules are hairlines. The status colour appears as a rail and a pill
//   rather than as a wash, so the state reads at a glance without colour being
//   the only carrier — every state is also spelled out in words.
//
//   The "what this does not prove" card is given exactly the same width and
//   weight as the proof, on purpose. A page of green ticks would imply that
//   being anchored makes the numbers true, which is the reasoning that destroyed
//   the credibility of earlier blockchain sustainability projects.

import { useTranslation } from 'react-i18next';
import SourceRegistryTable from '../../components/SourceRegistryTable';
import { useSourceRegistry } from '../../data/useIndicators';
import { attestationUrlOf, blockExplorerUrl, claimedBitcoinBlocks, integrityCopyKey, INTEGRITY_STATE, servedUrl, useAnchorHistory, useIntegrity } from '../../data/useIntegrity';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

// The one dark surface on the page. Brand teal in both themes: against the light
// canvas it is the boldest thing here, against the dark canvas it still reads as
// a distinct, cooler panel.
const INK_SURFACE = {
  background: 'linear-gradient(135deg, #003641 0%, #04252c 100%)',
  color: '#f3f6f1',
};
const ON_INK_MUTED = 'rgba(243, 246, 241, 0.62)';
const ON_INK_RULE = 'rgba(243, 246, 241, 0.14)';

const TONE = {
  [INTEGRITY_STATE.VERIFIED]: { fg: 'var(--color-green)', bg: 'var(--color-green-soft)', on: '#5fd39b' },
  [INTEGRITY_STATE.PENDING]: { fg: 'var(--color-amber-dark)', bg: 'var(--color-yellow-soft)', on: '#f4c542' },
  [INTEGRITY_STATE.MISMATCH]: { fg: 'var(--color-red)', bg: 'var(--color-red-soft)', on: '#f8827f' },
  [INTEGRITY_STATE.UNVERIFIED]: { fg: 'var(--color-muted)', bg: 'var(--color-grey-soft)', on: ON_INK_MUTED },
};
const toneOf = (status) => TONE[status] || TONE[INTEGRITY_STATE.UNVERIFIED];

const card = {
  background: 'var(--color-card)',
  border: '1px solid var(--color-border)',
  borderRadius: 16,
};

function Pill({ status, children, size = 'sm', onInk = false }) {
  const tone = toneOf(status);
  const big = size === 'lg';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: big ? 7 : 5,
        padding: big ? '6px 13px' : '3px 9px',
        borderRadius: 999,
        background: onInk ? 'rgba(243, 246, 241, 0.10)' : tone.bg,
        color: onInk ? tone.on : tone.fg,
        border: onInk ? `1px solid ${ON_INK_RULE}` : '1px solid transparent',
        fontWeight: 600,
        fontSize: big ? 12.5 : 11,
        letterSpacing: '.02em',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: big ? 7 : 6,
          height: big ? 7 : 6,
          borderRadius: '50%',
          background: onInk ? tone.on : tone.fg,
          flex: 'none',
        }}
      />
      {children}
    </span>
  );
}

function Eyebrow({ children, color = 'var(--color-faint)' }) {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.15em', textTransform: 'uppercase', color }}>
      {children}
    </span>
  );
}

function Section({ eyebrow, title, hint, children, flush = false }) {
  return (
    <section style={{ ...card, overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--color-border)' }}>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h2
          style={{
            margin: eyebrow ? '6px 0 0' : 0,
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: '-.01em',
            color: 'var(--color-ink)',
          }}
        >
          {title}
        </h2>
        {hint ? (
          <p style={{ margin: '5px 0 0', fontSize: 13, lineHeight: 1.6, color: 'var(--color-muted)', maxWidth: '70ch' }}>
            {hint}
          </p>
        ) : null}
      </div>
      <div style={{ padding: flush ? 0 : 24 }}>{children}</div>
    </section>
  );
}

function StatTile({ label, value, sub }) {
  return (
    <div style={{ ...card, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Eyebrow>{label}</Eyebrow>
      <div
        style={{
          fontSize: 26,
          fontWeight: 650,
          letterSpacing: '-.02em',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--color-ink)',
          lineHeight: 1.15,
          marginTop: 4,
        }}
      >
        {value}
      </div>
      {sub ? <div style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>{sub}</div> : null}
    </div>
  );
}

export default function DataVerification() {
  const { t } = useTranslation();
  // This is the only page that deliberately hashes the full six-file scope.
  const { status, loading, manifest, manifestSha256, anchor, files } = useIntegrity('full');
  const history = useAnchorHistory();
  const registry = useSourceRegistry();

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const state = status || INTEGRITY_STATE.UNVERIFIED;
  const tone = toneOf(state);
  const otsRecord = anchor?.witnesses?.ots;
  const matched = files.filter((f) => f.match === true).length;
  const activeWitnesses = (anchor?.witnesses?.ots ? 1 : 0) + (anchor?.sigstore ? 1 : 0);
  // Claims recorded by our own pipeline, surfaced so the reader has something
  // concrete to look up elsewhere. They are never rendered as confirmation.
  const blocks = claimedBitcoinBlocks(otsRecord);
  const attestationUrl = attestationUrlOf(anchor);
  // Colour still comes from `state`; only the wording follows the recorded blocks.
  const copyKey = integrityCopyKey(state, blocks);
  // `anchor.ledgerEntries` only ever existed on three legacy rows, so this tile
  // read "—" on every current version. Count witnessed digests instead.
  const versionCount = new Set(history.events.map((event) => event.manifestSha256)).size;

  return (
    <div style={{ padding: '26px 20px 56px' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

        <header style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: '64ch' }}>
          <Eyebrow color="var(--color-muted)">{t('verify.eyebrow')}</Eyebrow>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 600, letterSpacing: '-.025em', lineHeight: 1.15, color: 'var(--color-ink)', textWrap: 'balance' }}>
            {t('verify.title')}
          </h1>
          <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: 15, lineHeight: 1.65 }}>
            {t('verify.lede')}
          </p>
        </header>

        {/* ── HERO ──────────────────────────────────────────────────────────
            The one bold surface. The fingerprint is the page's subject, so it
            is set as display type on the brand ground. */}
        <div style={{ ...INK_SURFACE, borderRadius: 18, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0, 32, 24, .18)' }}>
          <div style={{ padding: '24px 28px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                <Eyebrow color={ON_INK_MUTED}>{t('verify.heroLabel')}</Eyebrow>
                <code
                  style={{
                    fontFamily: MONO,
                    fontSize: 'clamp(14px, 2.3vw, 21px)',
                    lineHeight: 1.5,
                    letterSpacing: '-.01em',
                    wordBreak: 'break-all',
                    color: '#f3f6f1',
                  }}
                >
                  {loading ? '…' : manifestSha256 || '—'}
                </code>
              </div>
              {!loading ? <Pill status={state} size="lg" onInk>{t(`integrity.${copyKey}.label`)}</Pill> : null}
            </div>

            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: ON_INK_MUTED, maxWidth: '72ch' }}>
              {loading ? t('verify.checking') : t(`integrity.${copyKey}.detail`, { blocks: blocks.join(', ') })}
            </p>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px 32px',
                paddingTop: 14,
                borderTop: `1px solid ${ON_INK_RULE}`,
                fontSize: 12.5,
                color: ON_INK_MUTED,
              }}
            >
              {manifest?.generatedAt ? (
                <span>
                  {t('verify.built')}{' '}
                  <b style={{ fontFamily: MONO, fontWeight: 500, color: '#f3f6f1' }}>{manifest.generatedAt}</b>
                </span>
              ) : null}
              {anchor?.ledgerRoot ? (
                <span>
                  {t('verify.historyTitle')}{' '}
                  <b style={{ fontFamily: MONO, fontWeight: 500, color: '#f3f6f1' }}>
                    {anchor.ledgerRoot.slice(0, 12)}…
                  </b>
                </span>
              ) : null}
            </div>
          </div>
          <div aria-hidden="true" style={{ height: 3, background: tone.on, opacity: 0.9 }} />
        </div>

        {/* Summary before detail. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          <StatTile label={t('verify.statFiles')} value={loading ? '—' : `${matched}/${files.length || 0}`} sub={t('verify.fileMatch')} />
          <StatTile label={t('verify.statVersions')} value={history.loading || !versionCount ? '—' : versionCount} sub={t('verify.historyTitle')} />
          <StatTile label={t('verify.statWitnesses')} value={`${activeWitnesses}/2`} sub="OpenTimestamps · Sigstore" />
          <StatTile label={t('verify.statCost')} value="$0" sub={t('verify.noDirectWitnessFee')} />
        </div>

        {/* This is deliberately separate from the cryptographic ledger below.
            A registry tells a reviewer who published data and how often; a
            fingerprint only tells them whether published bytes changed. */}
        <Section eyebrow={t('sourceRegistry.eyebrow')} title={t('sourceRegistry.title')} hint={t('sourceRegistry.hint')}>
          <SourceRegistryTable payload={registry.data} loading={registry.loading} error={registry.error} generatedAt={registry.generatedAt} onRetry={registry.retry} />
        </Section>

        {/* Files ---------------------------------------------------------- */}
        <Section eyebrow={t('verify.currentTitle')} title={t('verify.filesTitle')} hint={t('verify.filesHint')} flush>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {[t('verify.colFile'), t('verify.colHash'), t('verify.colSize'), t('verify.colStatus')].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        textAlign: i === 2 ? 'right' : 'left',
                        padding: '11px 24px',
                        fontSize: 10.5,
                        letterSpacing: '.11em',
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
                    <td colSpan={4} style={{ padding: '18px 24px', color: 'var(--color-muted)' }}>
                      {loading ? t('verify.checking') : t('verify.noManifest')}
                    </td>
                  </tr>
                ) : (
                  files.map((file, index) => {
                    const fileState =
                      file.match === true
                        ? INTEGRITY_STATE.VERIFIED
                        : file.match === false
                          ? INTEGRITY_STATE.MISMATCH
                          : INTEGRITY_STATE.UNVERIFIED;
                    const cell = {
                      padding: '13px 24px',
                      borderBottom: index === files.length - 1 ? 'none' : '1px solid var(--color-border)',
                      whiteSpace: 'nowrap',
                    };
                    return (
                      <tr key={file.path}>
                        <td style={{ ...cell, fontFamily: MONO, fontSize: 12.5, color: 'var(--color-ink)' }}>
                          {servedUrl(file.path)}
                        </td>
                        <td style={{ ...cell, fontFamily: MONO, fontSize: 12, color: 'var(--color-muted)' }}>
                          {(file.actual || file.expected || '').slice(0, 24)}…
                        </td>
                        <td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-muted)' }}>
                          {file.bytes ? file.bytes.toLocaleString() : '—'}
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

        {/* Witnesses ------------------------------------------------------ */}
        <Section eyebrow={t('verify.eyebrow')} title={t('verify.witnessTitle')} hint={t('verify.witnessHint')}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <WitnessCard
              name={t('verify.witnessBitcoin')}
              via="OpenTimestamps · independently verify with official OTS tooling"
              status={anchor?.proofAvailable ? INTEGRITY_STATE.PENDING : INTEGRITY_STATE.UNVERIFIED}
              label={anchor?.proofAvailable ? 'OTS proof available — independently verify Bitcoin inclusion' : t('verify.notAnchored')}
              rows={[
                [t('verify.proof'), anchor?.proofAvailable && otsRecord?.proof ? otsRecord.proof.split('/').pop() : '—'],
                [t('verify.blocksClaimed'), blocks.length ? <BlockLinks blocks={blocks} /> : '—'],
              ]}
              link={null}
            />
            <WitnessCard
              name={t('verify.witnessSigstore')}
              via="Rekor transparency log · verify signer identity with gh"
              status={anchor?.sigstore ? INTEGRITY_STATE.PENDING : INTEGRITY_STATE.UNVERIFIED}
              label={anchor?.sigstore ? 'Attestation available — identity not checked here' : t('verify.notAnchored')}
              rows={[
                [t('verify.entry'), anchor?.sigstore?.logIndex || '—'],
                [t('verify.signer'), anchor?.sigstore ? 'anchor.yml' : '—'],
              ]}
              link={attestationUrl ? { href: attestationUrl, text: t('verify.step3Action') } : null}
            />
          </div>
        </Section>

        {/* Proves / does not prove ---------------------------------------- */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          <Claim tone="var(--color-green)" bg="var(--color-green-soft)" mark="✓" title={t('verify.provesTitle')} body={t('verify.provesBody')} />
          <Claim tone="var(--color-red)" bg="var(--color-red-soft)" mark="✕" title={t('verify.notProvesTitle')} body={t('verify.notProvesBody')} />
        </div>

        {/* Verify it yourself ---------------------------------------------- */}
        {/* Every step here must be completable with nothing installed, using a
            tool that is not ours — otherwise the page asks the reader to trust
            us in the middle of proving that they do not have to. The terminal
            commands are kept but demoted: `ots` and `gh` are separate installs
            and the OpenTimestamps client does not build on every platform (see
            ots.py), so printing them as the primary instruction stranded most
            readers, including us. */}
        <Section eyebrow={t('verify.eyebrow')} title={t('verify.yourselfTitle')} hint={t('verify.yourselfHint')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Step
              n="1"
              title={t('verify.step1Title')}
              body={t('verify.step1Body')}
              actions={[{ href: '/data/manifest.json', text: t('verify.step1Action'), download: 'manifest.json' }]}
            />
            <Step
              n="2"
              title={t('verify.step2Title')}
              body={t('verify.step2Body')}
              empty={t('verify.noProof')}
              actions={
                anchor?.proofAvailable && otsRecord?.proof
                  ? [
                      { href: servedUrl(otsRecord.proof), text: t('verify.step2Proof'), download: 'manifest.json.ots' },
                      { href: 'https://opentimestamps.org', text: t('verify.step2Action'), external: true, primary: true },
                    ]
                  : []
              }
            />
            <Step
              n="3"
              title={t('verify.step3Title')}
              body={t('verify.step3Body')}
              empty={t('verify.notEnabled')}
              actions={attestationUrl ? [{ href: attestationUrl, text: t('verify.step3Action'), external: true, primary: true }] : []}
            />
          </div>

          <details style={{ marginTop: 16 }}>
            <summary style={{ cursor: 'pointer', padding: '4px 0', fontSize: 12.5, fontWeight: 600, color: 'var(--color-muted)' }}>
              {t('verify.cliToggle')}
            </summary>
            <p style={{ margin: '8px 0 12px', fontSize: 12.5, lineHeight: 1.65, color: 'var(--color-muted)', maxWidth: '72ch' }}>
              {t('verify.cliNote')}
            </p>
            <div style={{ ...INK_SURFACE, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'flex', gap: 6, padding: '10px 14px', borderBottom: `1px solid ${ON_INK_RULE}` }}>
                {['#f8827f', '#f4c542', '#5fd39b'].map((dot) => (
                  <span key={dot} aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: dot, opacity: 0.75 }} />
                ))}
              </div>
              {/* Anything printed here must actually run against what we actually
                  publish, and must say plainly when it needs an install — an
                  instruction that fails would undo the point of the page. */}
              <pre
                style={{
                  margin: 0,
                  padding: '16px 18px',
                  overflowX: 'auto',
                  fontFamily: MONO,
                  fontSize: 12.5,
                  lineHeight: 1.8,
                  color: '#f3f6f1',
                }}
              >
                <span style={{ color: ON_INK_MUTED }}>{'# 1 · recompute the fingerprint — no install needed\n'}</span>
                <span style={{ color: ON_INK_MUTED }}>$ </span>
                {`curl -sO ${origin}/data/manifest.json\n`}
                <span style={{ color: ON_INK_MUTED }}>$ </span>
                {'sha256sum manifest.json\n'}
                <span style={{ color: '#5fd39b' }}>{manifestSha256 || '…'}</span>
                {'\n\n'}
                <span style={{ color: ON_INK_MUTED }}>{'# on Windows PowerShell\n'}</span>
                <span style={{ color: ON_INK_MUTED }}>&gt; </span>
                {`curl.exe -sO ${origin}/data/manifest.json\n`}
                <span style={{ color: ON_INK_MUTED }}>&gt; </span>
                {'(Get-FileHash manifest.json -Algorithm SHA256).Hash.ToLower()'}
                {anchor?.proofAvailable && otsRecord?.proof ? (
                  <>
                    {'\n\n'}
                    <span style={{ color: ON_INK_MUTED }}>{'# 2 · check the Bitcoin proof — requires the OpenTimestamps client\n'}</span>
                    <span style={{ color: ON_INK_MUTED }}>$ </span>
                    {`curl -sO ${origin}${servedUrl(otsRecord.proof)}\n`}
                    <span style={{ color: ON_INK_MUTED }}>$ </span>
                    {'ots verify manifest.json.ots'}
                  </>
                ) : null}
                {anchor?.sigstore ? (
                  <>
                    {'\n\n'}
                    <span style={{ color: ON_INK_MUTED }}>{'# 3 · check the signer — requires the GitHub CLI\n'}</span>
                    <span style={{ color: ON_INK_MUTED }}>$ </span>
                    {'gh attestation verify manifest.json --repo angelyong/Borneo_Tracker --signer-workflow angelyong/Borneo_Tracker/.github/workflows/anchor.yml --source-ref refs/heads/master'}
                  </>
                ) : null}
              </pre>
            </div>
          </details>
        </Section>

        {/* History --------------------------------------------------------- */}
        <Section eyebrow={t('verify.eyebrow')} title={t('verify.historyTitle')} hint={t('verify.historyHint')} flush>
          <div style={{ padding: '6px 24px 18px' }}>
            {history.loading ? (
              <p style={{ margin: '14px 0', color: 'var(--color-muted)' }}>{t('verify.checking')}</p>
            ) : history.events.length === 0 ? (
              <p style={{ margin: '14px 0', color: 'var(--color-muted)' }}>{t('verify.noHistory')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {history.events.slice(0, 20).map((event, index, shown) => (
                  <div
                    key={`${event.manifestSha256}-${event.ts}-${index}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(96px, auto) 1fr auto',
                      gap: 18,
                      alignItems: 'center',
                      padding: '12px 0',
                      borderBottom: index === shown.length - 1 ? 'none' : '1px solid var(--color-border)',
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
                      {String(event.manifestSha256 || '').slice(0, 48)}…
                    </span>
                    <Pill status={INTEGRITY_STATE.PENDING}>
                      {event.witness?.type === 'sigstore'
                        ? `${t('verify.witnessSigstore')} · ${t('verify.logged')}`
                        : `${t('verify.witnessBitcoin')} · attestation record`}
                    </Pill>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Claim({ tone, bg, mark, title, body }) {
  return (
    <div style={{ ...card, display: 'flex', overflow: 'hidden' }}>
      <div aria-hidden="true" style={{ width: 4, background: tone, flex: 'none' }} />
      <div style={{ padding: '20px 22px' }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 14.5, fontWeight: 600, color: tone, display: 'flex', alignItems: 'center', gap: 9 }}>
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 22,
              height: 22,
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
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, color: 'var(--color-muted)' }}>{body}</p>
      </div>
    </div>
  );
}

function WitnessCard({ name, via, status, label, rows, link, muted }) {
  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 13,
        padding: '16px 17px',
        display: 'flex',
        flexDirection: 'column',
        gap: 13,
        background: 'var(--color-page-bg)',
        opacity: muted ? 0.58 : 1,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--color-ink)', letterSpacing: '-.01em' }}>{name}</div>
          <div style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>{via}</div>
        </div>
        <Pill status={status}>{label}</Pill>
      </div>
      <dl
        style={{
          margin: 0,
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: '6px 12px',
          fontSize: 11.5,
          borderTop: '1px solid var(--color-border)',
          paddingTop: 12,
        }}
      >
        {rows.map(([term, value]) => (
          <div key={term} style={{ display: 'contents' }}>
            <dt style={{ color: 'var(--color-faint)' }}>{term}</dt>
            <dd style={{ margin: 0, fontFamily: MONO, fontSize: 11.5, wordBreak: 'break-all', color: 'var(--color-ink)', textAlign: 'right' }}>
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

function BlockLinks({ blocks }) {
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
      {blocks.map((height) => (
        <a
          key={height}
          href={blockExplorerUrl(height)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: MONO,
            fontSize: 11.5,
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--color-navy)',
            textDecoration: 'underline',
            textDecorationStyle: 'dotted',
            textUnderlineOffset: 3,
          }}
        >
          {height.toLocaleString()}
        </a>
      ))}
    </span>
  );
}

function Step({ n, title, body, actions = [], empty }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: 14,
        alignItems: 'start',
        border: '1px solid var(--color-border)',
        borderRadius: 13,
        padding: '16px 18px',
        background: 'var(--color-page-bg)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: 'var(--color-card)',
          border: '1px solid var(--color-border)',
          fontSize: 12.5,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--color-muted)',
          flex: 'none',
        }}
      >
        {n}
      </span>
      <div style={{ minWidth: 0 }}>
        <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 600, letterSpacing: '-.01em', color: 'var(--color-ink)' }}>{title}</h3>
        <p style={{ margin: '5px 0 0', fontSize: 13, lineHeight: 1.65, color: 'var(--color-muted)', maxWidth: '70ch' }}>{body}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {actions.length === 0 ? (
            <span style={{ fontSize: 12.5, color: 'var(--color-faint)' }}>{empty}</span>
          ) : (
            actions.map((action) => (
              <a
                key={action.href}
                href={action.href}
                {...(action.download ? { download: action.download } : { target: '_blank', rel: 'noopener noreferrer' })}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 13px',
                  borderRadius: 999,
                  fontSize: 12.5,
                  fontWeight: 600,
                  textDecoration: 'none',
                  background: action.primary ? 'var(--color-navy)' : 'var(--color-card)',
                  color: action.primary ? '#f3f6f1' : 'var(--color-ink)',
                  border: `1px solid ${action.primary ? 'transparent' : 'var(--color-border)'}`,
                }}
              >
                {action.text}
                {action.external ? ' ↗' : ''}
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
