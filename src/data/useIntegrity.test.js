// The anchor log is append-only, which means "what does the badge say right now"
// is a *parsing* decision, not a network one. These tests pin that decision.
//
// The rule that matters most: an upgrade is appended, never edited in place, so
// the current status of an anchor is its LAST event. Get that wrong and a
// confirmed proof keeps reporting as pending forever.

import { describe, expect, it, vi } from 'vitest';
import { checkIntegrity, hasOpenTimestampsMagic, integrityCopyKey, INTEGRITY_SCOPE, INTEGRITY_STATE, latestAnchorFor, parseAnchors, servedUrl, validateManifestV2 } from './useIntegrity';

const STAMP = {
  ts: '2026-08-02T09:10:00Z',
  type: 'stamp',
  manifestSha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  status: 'pending',
};
const UPGRADE = {
  ts: '2026-08-02T18:10:00Z',
  type: 'upgrade',
  manifestSha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  status: 'confirmed',
  bitcoinBlocks: [960214],
};
const OTHER = { ts: '2026-08-01T09:10:00Z', type: 'stamp', manifestSha256: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', status: 'pending' };

const toJsonl = (events) => events.map((e) => JSON.stringify(e)).join('\n') + '\n';

describe('parseAnchors', () => {
  it('reads one event per line', () => {
    expect(parseAnchors(toJsonl([STAMP, UPGRADE]))).toHaveLength(2);
  });

  it('ignores blank lines and a missing trailing newline', () => {
    const text = `${JSON.stringify(STAMP)}\n\n  \n${JSON.stringify(UPGRADE)}`;
    expect(parseAnchors(text)).toHaveLength(2);
  });

  it('treats a corrupt line as invalid security metadata', () => {
    // The integrity UI must fail closed rather than silently trust an event
    // sequence whose append-only history has been damaged.
    const text = `${JSON.stringify(STAMP)}\n{"manifestSha\n${JSON.stringify(UPGRADE)}\n`;
    expect(() => parseAnchors(text)).toThrow('invalid anchor metadata');
  });

  it('returns nothing for an empty log rather than throwing', () => {
    expect(parseAnchors('')).toEqual([]);
  });

  it('rejects unsupported schema and invalid digest metadata', () => {
    expect(() => parseAnchors('{"schemaVersion":99,"manifestSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}\n')).toThrow('invalid anchor metadata');
    expect(() => parseAnchors('{"schemaVersion":2,"manifestSha256":"not-a-digest","eventType":"ots.stamped","witness":{}}\n')).toThrow('invalid anchor metadata');
  });

  it('rejects an invalid event even when it names a different manifest', () => {
    const bad = { schemaVersion: 2, manifestSha256: OTHER.manifestSha256, eventType: 'ots.stamped', witness: { type: 'ots', status: 'confirmed' }, proof: `public/data/versions/${OTHER.manifestSha256}/manifest.json.ots` };
    expect(() => latestAnchorFor([STAMP, bad], STAMP.manifestSha256)).toThrow();
  });
});

describe('latestAnchorFor', () => {
  it('takes the last event, so an upgrade supersedes its stamp', () => {
    const anchor = latestAnchorFor(parseAnchors(toJsonl([STAMP, UPGRADE])), STAMP.manifestSha256);
    expect(anchor.witness.status).toBe('pending');
    expect(anchor.bitcoinBlocks).toEqual([960214]);
  });

  it('preserves Sigstore when a later OTS upgrade is appended', () => {
    const sigstore = { schemaVersion: 2, manifestSha256: STAMP.manifestSha256, eventType: 'sigstore.attested', witness: { type: 'sigstore', status: 'attested' }, sigstore: { present: true } };
    const upgrade = { schemaVersion: 2, manifestSha256: STAMP.manifestSha256, eventType: 'ots.upgraded', witness: { type: 'ots', status: 'pending' }, proof: `public/data/versions/${STAMP.manifestSha256}/manifest.json.ots` };
    expect(latestAnchorFor([STAMP, sigstore, upgrade], STAMP.manifestSha256).sigstore).toEqual({ present: true });
  });

  it('does not discard a standalone Sigstore witness', () => {
    const sigstore = { schemaVersion: 2, manifestSha256: STAMP.manifestSha256, eventType: 'sigstore.attested', witness: { type: 'sigstore', status: 'attested' }, sigstore: { present: true } };
    expect(latestAnchorFor([sigstore], STAMP.manifestSha256).sigstore).toEqual({ present: true });
  });

  it('does not let another manifest’s events leak in', () => {
    const events = parseAnchors(toJsonl([STAMP, OTHER, UPGRADE]));
    expect(latestAnchorFor(events, OTHER.manifestSha256).status).toBe('pending');
    expect(latestAnchorFor(events, STAMP.manifestSha256).eventType).toBe('ots.upgraded');
  });

  it('does not let a later stamp replace an upgraded OTS proof record', () => {
    const confirmed = { schemaVersion: 2, manifestSha256: STAMP.manifestSha256, eventType: 'ots.upgraded', witness: { type: 'ots', status: 'pending' }, proof: `public/data/versions/${STAMP.manifestSha256}/manifest.json.ots` };
    const pending = { schemaVersion: 2, manifestSha256: STAMP.manifestSha256, eventType: 'ots.stamped', witness: { type: 'ots', status: 'pending' }, proof: `public/data/versions/${STAMP.manifestSha256}/manifest.json.ots` };
    expect(latestAnchorFor([confirmed, pending], STAMP.manifestSha256).eventType).toBe('ots.upgraded');
  });

  it('returns null for a manifest that has never been anchored', () => {
    // A brand-new data version before the anchor job runs. Must read as
    // "unverified", never as verified and never as tampered-with.
    expect(latestAnchorFor(parseAnchors(toJsonl([STAMP])), 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc')).toBeNull();
  });
});

describe('integrity scopes', () => {
  it('uses all six live datasets for the full verification page', () => {
    expect(INTEGRITY_SCOPE.full).toHaveLength(6);
    expect(INTEGRITY_SCOPE.full).toContain('public/data/borneo_districts.geojson');
    expect(INTEGRITY_SCOPE.model).toContain('public/data/resilience_model.json');
  });
});

describe('Manifest v2 browser contract', () => {
  const manifest = () => ({ schemaVersion: 2, generatedAt: '2026-08-09T00:00:00Z', runId: 'test', dataVersion: 'b'.repeat(64), files: Object.fromEntries(INTEGRITY_SCOPE.full.map((path) => [path, { sha256: 'a'.repeat(64), bytes: 1, generatedAt: null }])), provenance: { algorithm: 'rfc6962-sha256-jsonl-v1', root: 'c'.repeat(64), entries: 1 } });

  it('requires all six canonical files and no unknown top-level fields', () => {
    expect(validateManifestV2(manifest())).toEqual(manifest());
    const missing = manifest(); delete missing.files['public/data/brunei.geojson'];
    expect(() => validateManifestV2(missing)).toThrow('complete Phase-1 dataset scope');
    const extra = manifest(); extra.untrusted = true;
    expect(() => validateManifestV2(extra)).toThrow('top-level');
  });

  it('rejects malformed descriptors and provenance metadata', () => {
    const broken = manifest(); broken.files['public/data/indicators.json'] = { sha256: 'bad', bytes: -1, generatedAt: null };
    expect(() => validateManifestV2(broken)).toThrow('descriptor');
    const noProvenance = manifest(); noProvenance.provenance.entries = 0;
    expect(() => validateManifestV2(noProvenance)).toThrow('provenance');
  });

  it('rejects an impossible RFC3339 calendar date', () => {
    const impossible = manifest(); impossible.generatedAt = '2026-02-31T00:00:00Z';
    expect(() => validateManifestV2(impossible)).toThrow('header');
  });
});

describe('integrity network boundary', () => {
  it('checks all six files and reports a usable pending OTS record', async () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    vi.stubGlobal('crypto', { subtle: { digest: vi.fn().mockResolvedValue(new Uint8Array(32).fill(0xaa).buffer) } });
    const manifest = {
      schemaVersion: 2, generatedAt: '2026-08-09T00:00:00Z', runId: 'test', dataVersion: 'a'.repeat(64),
      files: Object.fromEntries(INTEGRITY_SCOPE.full.map((path) => [path, { sha256: 'a'.repeat(64), bytes: 1, generatedAt: null }])),
      provenance: { algorithm: 'rfc6962-sha256-jsonl-v1', root: 'a'.repeat(64), entries: 1 },
    };
    const event = { schemaVersion: 2, manifestSha256: 'a'.repeat(64), eventType: 'ots.stamped', witness: { type: 'ots', status: 'pending' }, proof: `public/data/versions/${'a'.repeat(64)}/manifest.json.ots` };
    const response = (body) => ({ ok: true, status: 200, arrayBuffer: vi.fn().mockResolvedValue(body) });
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url === '/data/manifest.json') return Promise.resolve(response(new TextEncoder().encode(JSON.stringify(manifest)).buffer));
      if (url === '/data/anchors.jsonl') return Promise.resolve(response(new TextEncoder().encode(`${JSON.stringify(event)}\n`).buffer));
      if (url.includes('/versions/')) return Promise.resolve(response(new Uint8Array([0x00, 0x4f, 0x70, 0x65, 0x6e, 0x54, 0x69, 0x6d, 0x65, 0x73, 0x74, 0x61, 0x6d, 0x70, 0x73, 0x00, 0x00, 0x50, 0x72, 0x6f, 0x6f, 0x66, 0x00, 0xbf, 0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94]).buffer));
      return Promise.resolve(response(new Uint8Array([1]).buffer));
    }));
    const result = await checkIntegrity('full');
    expect(result).toMatchObject({ status: INTEGRITY_STATE.PENDING, anchor: { proofAvailable: true } });
    expect(result.files).toHaveLength(6);
    expect(result.files.every((file) => file.match)).toBe(true);
    vi.unstubAllGlobals();
  });

  it('reports an unavailable manifest as unverified, not malformed metadata', async () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    vi.stubGlobal('crypto', { subtle: { digest: vi.fn() } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(checkIntegrity('overview')).resolves.toMatchObject({ status: INTEGRITY_STATE.UNVERIFIED, error: '/data/manifest.json: 404' });
    vi.unstubAllGlobals();
  });

  it('does not treat a self-hosted OTS event as verification when its proof is unavailable', async () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    vi.stubGlobal('crypto', { subtle: { digest: vi.fn().mockResolvedValue(new Uint8Array(32).fill(0xaa).buffer) } });
    const manifest = {
      schemaVersion: 2, generatedAt: '2026-08-09T00:00:00Z', runId: 'test', dataVersion: 'a'.repeat(64),
      files: Object.fromEntries(INTEGRITY_SCOPE.full.map((path) => [path, { sha256: 'a'.repeat(64), bytes: 1, generatedAt: null }])),
      provenance: { algorithm: 'rfc6962-sha256-jsonl-v1', root: 'a'.repeat(64), entries: 1 },
    };
    const event = { schemaVersion: 2, manifestSha256: 'a'.repeat(64), eventType: 'ots.upgraded', witness: { type: 'ots', status: 'pending' }, proof: `public/data/versions/${'a'.repeat(64)}/manifest.json.ots` };
    const json = new TextEncoder().encode(JSON.stringify(manifest)).buffer;
    const response = (body, status = 200) => ({ ok: status === 200, status, arrayBuffer: vi.fn().mockResolvedValue(body) });
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url === '/data/manifest.json') return Promise.resolve(response(json));
      if (url === '/data/anchors.jsonl') return Promise.resolve(response(new TextEncoder().encode(`${JSON.stringify(event)}\n`).buffer));
      if (url.includes('/versions/')) return Promise.resolve(response(new ArrayBuffer(0), 404));
      return Promise.resolve(response(new Uint8Array([0]).buffer));
    }));
    await expect(checkIntegrity('overview')).resolves.toMatchObject({ status: INTEGRITY_STATE.UNVERIFIED, anchor: { witness: { status: 'pending' } } });
    vi.unstubAllGlobals();
  });

  it('recognises only the official OTS header as a proof asset', () => {
    expect(hasOpenTimestampsMagic(new Uint8Array([0x00, 0x4f, 0x70]).buffer)).toBe(false);
    expect(hasOpenTimestampsMagic(new Uint8Array([0x00, 0x4f, 0x70, 0x65, 0x6e, 0x54, 0x69, 0x6d, 0x65, 0x73, 0x74, 0x61, 0x6d, 0x70, 0x73, 0x00, 0x00, 0x50, 0x72, 0x6f, 0x6f, 0x66, 0x00, 0xbf, 0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94]).buffer)).toBe(true);
  });

  it('treats a present non-OTS binary proof as invalid metadata, not merely unavailable', async () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    vi.stubGlobal('crypto', { subtle: { digest: vi.fn().mockResolvedValue(new Uint8Array(32).fill(0xaa).buffer) } });
    const manifest = {
      schemaVersion: 2, generatedAt: '2026-08-09T00:00:00Z', runId: 'test', dataVersion: 'a'.repeat(64),
      files: Object.fromEntries(INTEGRITY_SCOPE.full.map((path) => [path, { sha256: 'a'.repeat(64), bytes: 1, generatedAt: null }])),
      provenance: { algorithm: 'rfc6962-sha256-jsonl-v1', root: 'a'.repeat(64), entries: 1 },
    };
    const event = { schemaVersion: 2, manifestSha256: 'a'.repeat(64), eventType: 'ots.stamped', witness: { type: 'ots', status: 'pending' }, proof: `public/data/versions/${'a'.repeat(64)}/manifest.json.ots` };
    const response = (body) => ({ ok: true, status: 200, arrayBuffer: vi.fn().mockResolvedValue(body) });
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url === '/data/manifest.json') return Promise.resolve(response(new TextEncoder().encode(JSON.stringify(manifest)).buffer));
      if (url === '/data/anchors.jsonl') return Promise.resolve(response(new TextEncoder().encode(`${JSON.stringify(event)}\n`).buffer));
      if (url.includes('/versions/')) return Promise.resolve(response(new Uint8Array([1, 2, 3]).buffer));
      return Promise.resolve(response(new Uint8Array([0]).buffer));
    }));
    await expect(checkIntegrity('overview')).resolves.toMatchObject({ status: INTEGRITY_STATE.INVALID, error: expect.stringContaining('malformed OpenTimestamps proof') });
    vi.unstubAllGlobals();
  });
});

describe('servedUrl', () => {
  it('maps a repo path onto the URL the browser fetches', () => {
    expect(servedUrl('public/data/indicators.json')).toBe('/data/indicators.json');
  });

  it('only strips the leading public/, not one in the middle', () => {
    expect(servedUrl('public/data/public/x.json')).toBe('/data/public/x.json');
  });
});

describe('integrityCopyKey', () => {
  // Recorded blocks change the WORDING only. Letting them change the state
  // would turn a self-hosted claim into a verification badge, which is the one
  // thing this whole feature exists not to do.
  it('switches the pending copy once blocks are recorded', () => {
    expect(integrityCopyKey(INTEGRITY_STATE.PENDING, [965538, 965544])).toBe('recorded');
  });

  it('keeps the waiting copy while no block is recorded', () => {
    expect(integrityCopyKey(INTEGRITY_STATE.PENDING, [])).toBe(INTEGRITY_STATE.PENDING);
    expect(integrityCopyKey(INTEGRITY_STATE.PENDING, undefined)).toBe(INTEGRITY_STATE.PENDING);
  });

  it('never dresses up a failed or unverified check', () => {
    for (const status of [INTEGRITY_STATE.MISMATCH, INTEGRITY_STATE.UNVERIFIED, INTEGRITY_STATE.INVALID, INTEGRITY_STATE.VERIFIED]) {
      expect(integrityCopyKey(status, [965538])).toBe(status);
    }
  });
});
