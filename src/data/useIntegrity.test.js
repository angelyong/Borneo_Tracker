// The anchor log is append-only, which means "what does the badge say right now"
// is a *parsing* decision, not a network one. These tests pin that decision.
//
// The rule that matters most: an upgrade is appended, never edited in place, so
// the current status of an anchor is its LAST event. Get that wrong and a
// confirmed proof keeps reporting as pending forever.

import { describe, expect, it } from 'vitest';
import { latestAnchorFor, parseAnchors, servedUrl } from './useIntegrity';

const STAMP = {
  ts: '2026-08-02T09:10:00Z',
  type: 'stamp',
  manifestSha256: 'aaaa',
  status: 'pending',
};
const UPGRADE = {
  ts: '2026-08-02T18:10:00Z',
  type: 'upgrade',
  manifestSha256: 'aaaa',
  status: 'confirmed',
  bitcoinBlocks: [960214],
};
const OTHER = { ts: '2026-08-01T09:10:00Z', type: 'stamp', manifestSha256: 'bbbb', status: 'pending' };

const toJsonl = (events) => events.map((e) => JSON.stringify(e)).join('\n') + '\n';

describe('parseAnchors', () => {
  it('reads one event per line', () => {
    expect(parseAnchors(toJsonl([STAMP, UPGRADE]))).toHaveLength(2);
  });

  it('ignores blank lines and a missing trailing newline', () => {
    const text = `${JSON.stringify(STAMP)}\n\n  \n${JSON.stringify(UPGRADE)}`;
    expect(parseAnchors(text)).toHaveLength(2);
  });

  it('keeps the good lines when one is corrupt', () => {
    // A truncated write must not blind us to every other anchor in the log.
    const text = `${JSON.stringify(STAMP)}\n{"manifestSha\n${JSON.stringify(UPGRADE)}\n`;
    const events = parseAnchors(text);
    expect(events).toHaveLength(2);
    expect(events[1].status).toBe('confirmed');
  });

  it('returns nothing for an empty log rather than throwing', () => {
    expect(parseAnchors('')).toEqual([]);
  });
});

describe('latestAnchorFor', () => {
  it('takes the last event, so an upgrade supersedes its stamp', () => {
    const anchor = latestAnchorFor(parseAnchors(toJsonl([STAMP, UPGRADE])), 'aaaa');
    expect(anchor.status).toBe('confirmed');
    expect(anchor.bitcoinBlocks).toEqual([960214]);
  });

  it('does not let another manifest’s events leak in', () => {
    const events = parseAnchors(toJsonl([STAMP, OTHER, UPGRADE]));
    expect(latestAnchorFor(events, 'bbbb').status).toBe('pending');
    expect(latestAnchorFor(events, 'aaaa').status).toBe('confirmed');
  });

  it('returns null for a manifest that has never been anchored', () => {
    // A brand-new data version before the anchor job runs. Must read as
    // "unverified", never as verified and never as tampered-with.
    expect(latestAnchorFor(parseAnchors(toJsonl([STAMP])), 'cccc')).toBeNull();
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
