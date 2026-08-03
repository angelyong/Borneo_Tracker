// Data-integrity check — the browser-side half of ABCDE letter "B".
//
// The pipeline publishes a sha256 of every data file in manifest.json, and
// anchors manifest.json itself on Bitcoin (OpenTimestamps) and in Sigstore's
// transparency log. This hook re-computes those hashes IN THE VISITOR'S OWN
// BROWSER and compares. That is the whole point: if we computed the comparison
// on our server and reported the result, the visitor would still be trusting us.
//
// What a green result means: these bytes are exactly what was anchored, and
// nobody — including us — has altered them since. What it does NOT mean: that
// the numbers are correct. See components/IntegrityChip.jsx for the wording, and
// pages/info/DataVerification.jsx for the long form.
//
// Same shape as the five loaders in useIndicators.js: { ...state, loading }.

import { useEffect, useState } from 'react';

// Files whose hashes the visitor's browser re-computes. Deliberately not
// districts.json (562 KB) — it is only fetched on the district view, and hashing
// half a megabyte on every page load to verify something most visitors never see
// is a bad trade. The manifest still commits to it, and verify_anchor.py checks
// it in full.
const VERIFIED_FILES = ['public/data/indicators.json', 'public/data/resilience.json'];

// Repo-relative manifest keys map onto served URLs: public/data/x -> /data/x
export function servedUrl(repoRelativePath) {
  return `/${repoRelativePath.replace(/^public\//, '')}`;
}

export const INTEGRITY_STATE = {
  VERIFIED: 'verified',
  PENDING: 'pending',
  MISMATCH: 'mismatch',
  UNVERIFIED: 'unverified',
};

/**
 * SHA-256 of exactly the bytes the browser received.
 *
 * Must hash the raw response body. Going through response.json() and
 * re-stringifying would re-order keys, drop whitespace, reformat numbers and
 * lose the trailing newline — the hash would never match and the badge would be
 * permanently red for a reason that has nothing to do with integrity.
 */
async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// crypto.subtle only exists in a secure context (https, or localhost). On a plain
// http origin the honest answer is "cannot verify", never "verified".
function canHash() {
  return typeof crypto !== 'undefined' && crypto.subtle && window.isSecureContext;
}

async function fetchText(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url} -> ${response.status}`);
  return response.text();
}

// Exported for tests: this is the parsing that decides what the badge says, so
// it should be checkable without a browser, a network or a crypto engine.
export function parseAnchors(text) {
  const events = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      // A corrupt line is not a reason to discard the rest of the log.
    }
  }
  return events;
}

// The log is append-only, so an anchor's current state is its most recent event.
export function latestAnchorFor(events, manifestSha256) {
  let latest = null;
  for (const event of events) {
    if (event.manifestSha256 === manifestSha256) latest = event;
  }
  return latest;
}

export function useIntegrity() {
  const [state, setState] = useState({
    status: null,
    loading: true,
    error: null,
    manifest: null,
    manifestSha256: null,
    anchor: null,
    files: [],
    checkedAt: null,
  });

  useEffect(() => {
    let ignore = false;

    const settle = (next) => {
      if (!ignore) setState({ ...next, loading: false, checkedAt: new Date().toISOString() });
    };

    async function run() {
      if (!canHash()) {
        settle({
          status: INTEGRITY_STATE.UNVERIFIED,
          error: 'insecure-context',
          manifest: null,
          manifestSha256: null,
          anchor: null,
          files: [],
        });
        return;
      }

      let manifest;
      let manifestSha256;
      try {
        const response = await fetch('/data/manifest.json', { cache: 'no-store' });
        if (!response.ok) throw new Error(`manifest -> ${response.status}`);
        const buffer = await response.arrayBuffer();
        manifestSha256 = await sha256Hex(buffer);
        manifest = JSON.parse(new TextDecoder().decode(buffer));
      } catch (error) {
        // No manifest means nothing to verify against. Unverified, not a failure:
        // absence of proof is never rendered as proof, and never as tampering.
        settle({
          status: INTEGRITY_STATE.UNVERIFIED,
          error: error.message,
          manifest: null,
          manifestSha256: null,
          anchor: null,
          files: [],
        });
        return;
      }

      // Do the file hashes match what the manifest claims?
      const files = await Promise.all(
        VERIFIED_FILES.filter((path) => manifest?.files?.[path]).map(async (path) => {
          const expected = manifest.files[path].sha256;
          try {
            const response = await fetch(servedUrl(path), { cache: 'no-store' });
            if (!response.ok) throw new Error(String(response.status));
            const buffer = await response.arrayBuffer();
            const actual = await sha256Hex(buffer);
            return { path, expected, actual, bytes: buffer.byteLength, match: actual === expected };
          } catch (error) {
            return { path, expected, actual: null, bytes: null, match: null, error: error.message };
          }
        }),
      );

      if (files.some((file) => file.match === false)) {
        settle({
          status: INTEGRITY_STATE.MISMATCH,
          error: null,
          manifest,
          manifestSha256,
          anchor: null,
          files,
        });
        return;
      }

      // Then: is this manifest anchored, and has the anchor confirmed yet?
      let anchor;
      try {
        anchor = latestAnchorFor(parseAnchors(await fetchText('/data/anchors.jsonl')), manifestSha256);
      } catch {
        // No anchor log served yet — treated as "unverified" below, never as a pass.
        anchor = null;
      }

      const unreachable = files.some((file) => file.match === null);
      let status;
      if (unreachable || !anchor) {
        // Files are consistent with the manifest, but there is no anchor to
        // point at (or a file could not be fetched). Honest answer: unverified.
        status = INTEGRITY_STATE.UNVERIFIED;
      } else if (anchor.status === 'confirmed') {
        status = INTEGRITY_STATE.VERIFIED;
      } else {
        // Stamped, but no Bitcoin block yet. Normal for a few hours after a
        // refresh — not an error, and not a pass either.
        status = INTEGRITY_STATE.PENDING;
      }

      settle({ status, error: null, manifest, manifestSha256, anchor, files });
    }

    run();
    return () => {
      ignore = true;
    };
  }, []);

  return state;
}

/**
 * The full anchor log, newest first — for the verification page's history table.
 * Separate from useIntegrity() so the chip never pays for data only one page uses.
 */
export function useAnchorHistory() {
  const [state, setState] = useState({ events: [], loading: true, error: null });

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const events = parseAnchors(await fetchText('/data/anchors.jsonl'));
        if (!ignore) setState({ events: events.reverse(), loading: false, error: null });
      } catch (error) {
        if (!ignore) setState({ events: [], loading: false, error: error.message });
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, []);

  return state;
}
