// Browser verification of published bytes. This is deliberately a D+E claim:
// it verifies downloaded files against a downloaded Manifest, not source truth
// or independent Bitcoin inclusion.
import { useEffect, useMemo, useState } from 'react';

export const INTEGRITY_SCOPE = {
  overview: ['public/data/indicators.json', 'public/data/resilience.json'],
  district: ['public/data/indicators.json', 'public/data/resilience.json', 'public/data/districts.json', 'public/data/borneo_districts.geojson', 'public/data/brunei.geojson'],
  model: ['public/data/indicators.json', 'public/data/resilience.json', 'public/data/resilience_model.json'],
  full: ['public/data/indicators.json', 'public/data/resilience.json', 'public/data/resilience_model.json', 'public/data/districts.json', 'public/data/borneo_districts.geojson', 'public/data/brunei.geojson'],
};
const DATASET_PATHS = INTEGRITY_SCOPE.full;
const HEX64 = /^[0-9a-f]{64}$/;
const RFC3339_UTC = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/;
const PROOF_PATH = /^public\/data\/versions\/[0-9a-f]{64}\/manifest\.json\.ots$/;
const EVENT_WITNESS = { 'ots.stamped':['ots','pending'], 'ots.upgraded':['ots','pending'], 'sigstore.attested':['sigstore','attested'], 'legacy.migrated':['ots','pending'] };
const OTS_MAGIC = new Uint8Array([0x00, 0x4f, 0x70, 0x65, 0x6e, 0x54, 0x69, 0x6d, 0x65, 0x73, 0x74, 0x61, 0x6d, 0x70, 0x73, 0x00, 0x00, 0x50, 0x72, 0x6f, 0x6f, 0x66, 0x00, 0xbf, 0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94]);

export const INTEGRITY_STATE = { VERIFIED:'verified', PENDING:'pending', MISMATCH:'mismatch', UNVERIFIED:'unverified', INVALID:'invalid' };
export function servedUrl(path) { return `/${path.replace(/^public\//, '')}`; }

// Block heights our own pipeline recorded when it upgraded the proof, and the
// GitHub attestation page for the signing identity. Both are read out of a
// self-hosted ledger, so they are CLAIMS, not verified facts: this browser
// cannot read Bitcoin headers or the Rekor log. They exist so a reader has
// something concrete to look up with somebody else's tooling, and callers must
// present them as such. Both are validated strictly — an href taken from a data
// file is a phishing vector the moment that file is tampered with.
const BITCOIN_CLAIM_KIND = 'bitcoin-attestation-present';
const ATTESTATION_URL = /^https:\/\/github\.com\/[A-Za-z0-9._-]{1,100}\/[A-Za-z0-9._-]{1,100}\/attestations\/[0-9]{1,20}$/;

export function claimedBitcoinBlocks(event) {
  const claim = event?.otsAttestationClaim;
  if (!claim || typeof claim !== 'object' || Array.isArray(claim)) return [];
  if (claim.kind !== BITCOIN_CLAIM_KIND || !Array.isArray(claim.blocks) || !claim.blocks.length) return [];
  // A single malformed height discards the whole claim rather than rendering a
  // partially trustworthy list.
  if (!claim.blocks.every((height) => Number.isInteger(height) && height > 0)) return [];
  return [...new Set(claim.blocks)].sort((a, b) => a - b);
}

export function attestationUrlOf(anchor) {
  const url = anchor?.sigstore?.attestationUrl;
  return typeof url === 'string' && ATTESTATION_URL.test(url) ? url : null;
}

export function blockExplorerUrl(height) {
  if (!Number.isInteger(height) || height <= 0) throw new Error('invalid block height');
  return `https://blockstream.info/block-height/${height}`;
}

class UnavailableError extends Error {}
async function sha256Hex(buffer) { const digest = await crypto.subtle.digest('SHA-256', buffer); return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join(''); }
function canHash() { return typeof crypto !== 'undefined' && crypto.subtle && typeof window !== 'undefined' && window.isSecureContext; }
function canonicalProofPath(sha) { return `public/data/versions/${sha}/manifest.json.ots`; }
function isSafeProofPath(path, sha) { return typeof path === 'string' && path === canonicalProofPath(sha) && PROOF_PATH.test(path); }
function isTimestamp(value) {
  if (typeof value !== 'string' || !RFC3339_UTC.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().replace('.000Z', 'Z') === value;
}

export async function fetchBytes(url) {
  let response;
  try { response = await fetch(url, { cache:'no-store' }); }
  catch (error) { throw new UnavailableError(`${url}: ${error.message}`); }
  if (!response.ok) throw new UnavailableError(`${url}: ${response.status}`);
  return response.arrayBuffer();
}

// This is deliberately only a format-presence check. The browser does not
// verify OTS operations or Bitcoin headers; it merely refuses to render a
// self-hosted event record as usable proof when the proof asset is absent or
// is an SPA/HTML fallback.
export function hasOpenTimestampsMagic(buffer) {
  const bytes = new Uint8Array(buffer);
  return bytes.length >= OTS_MAGIC.length && OTS_MAGIC.every((byte, index) => bytes[index] === byte);
}

async function fetchOtsProof(url) {
  const proof = await fetchBytes(url);
  if (hasOpenTimestampsMagic(proof)) return proof;
  const prefix = new TextDecoder().decode(proof.slice(0, 96)).trimStart().toLowerCase();
  if (prefix.startsWith('<!doctype') || prefix.startsWith('<html')) {
    throw new UnavailableError(`${url}: proof asset was not served`);
  }
  throw new Error(`${url}: malformed OpenTimestamps proof`);
}

export function validateManifestV2(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('Manifest must be an object');
  const required = ['schemaVersion','generatedAt','runId','dataVersion','files','provenance'];
  if (Object.keys(manifest).length !== required.length || !required.every((key) => Object.hasOwn(manifest, key))) throw new Error('Manifest has missing or unknown top-level fields');
  if (manifest.schemaVersion !== 2 || !isTimestamp(manifest.generatedAt) || typeof manifest.runId !== 'string' || !manifest.runId) throw new Error('Manifest v2 header is invalid');
  if (!HEX64.test(manifest.dataVersion || '') || !manifest.files || typeof manifest.files !== 'object' || Array.isArray(manifest.files)) throw new Error('Manifest files are invalid');
  if (Object.keys(manifest.files).length !== DATASET_PATHS.length || !DATASET_PATHS.every((path) => Object.hasOwn(manifest.files, path))) throw new Error('Manifest does not contain the complete Phase-1 dataset scope');
  for (const path of DATASET_PATHS) {
    const entry = manifest.files[path];
    if (!entry || typeof entry !== 'object' || Object.keys(entry).length !== 3 || !Object.hasOwn(entry,'sha256') || !Object.hasOwn(entry,'bytes') || !Object.hasOwn(entry,'generatedAt') || !HEX64.test(entry.sha256 || '') || !Number.isInteger(entry.bytes) || entry.bytes < 0 || (entry.generatedAt !== null && typeof entry.generatedAt !== 'string')) throw new Error(`Manifest descriptor is invalid: ${path}`);
  }
  const provenance = manifest.provenance;
  if (!provenance || typeof provenance !== 'object' || Object.keys(provenance).length !== 3 || provenance.algorithm !== 'rfc6962-sha256-jsonl-v1' || !HEX64.test(provenance.root || '') || !Number.isInteger(provenance.entries) || provenance.entries <= 0) throw new Error('Manifest provenance is invalid');
  return manifest;
}

async function canonicalDataVersion(files) {
  const descriptors=Object.keys(files).sort().map((path) => ({ bytes:files[path].bytes, path, sha256:files[path].sha256 }));
  return sha256Hex(new TextEncoder().encode(JSON.stringify(descriptors)));
}

function normalizeAnchor(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error();
  const legacy = raw.schemaVersion === undefined;
  const normalizedLegacy = raw.schemaVersion === 1 && raw.legacy;
  if (legacy && !['stamp','upgrade'].includes(raw.type)) throw new Error();
  if (!legacy && !normalizedLegacy && raw.schemaVersion !== 2) throw new Error();
  if (!HEX64.test(raw.manifestSha256 || '')) throw new Error();
  const status = legacy ? 'pending' : raw.witness?.status;
  const eventType = legacy ? (raw.status === 'confirmed' ? 'ots.upgraded' : 'ots.stamped') : raw.eventType;
  const witnessType = legacy ? 'ots' : raw.witness?.type;
  const expected = EVENT_WITNESS[eventType];
  if (!expected || witnessType !== expected[0] || status !== expected[1]) throw new Error();
  const event = legacy ? { ...raw, schemaVersion:1, eventType, witness:{ type:witnessType, status }, proof:canonicalProofPath(raw.manifestSha256), legacy:raw } : raw;
  if (witnessType === 'ots' && !isSafeProofPath(event.proof, event.manifestSha256)) throw new Error();
  return event;
}

export function parseAnchors(text) {
  const events=[];
  for (const [index,line] of text.split('\n').entries()) {
    if (!line.trim()) continue;
    try { events.push(normalizeAnchor(JSON.parse(line))); }
    catch { throw new Error(`invalid anchor metadata at line ${index + 1}`); }
  }
  return events;
}

export function latestAnchorFor(events, sha) {
  if (!HEX64.test(sha)) throw new Error('invalid Manifest digest');
  const witnesses={ ots:null, sigstore:null };
  for (const raw of events) {
    const event=normalizeAnchor(raw); // validate unrelated rows as well.
    if (event.manifestSha256 !== sha) continue;
    const prior=witnesses[event.witness.type];
    if (event.witness.type !== 'ots' || !prior || event.eventType === 'ots.upgraded' || prior.eventType !== 'ots.upgraded') witnesses[event.witness.type]=event;
  }
  const primary=witnesses.ots || witnesses.sigstore;
  return primary ? { ...primary, sigstore:witnesses.sigstore?.sigstore, witnesses } : null;
}

function scopePaths(scope) { return Array.isArray(scope) ? scope : INTEGRITY_SCOPE[scope] || INTEGRITY_SCOPE.overview; }

export async function checkIntegrity(scope='overview') {
  const required=scopePaths(scope);
  if (!required.length || required.some((path) => !DATASET_PATHS.includes(path))) return { status:INTEGRITY_STATE.INVALID, error:'invalid verification scope', manifest:null, manifestSha256:null, anchor:null, files:[] };
  if (!canHash()) return { status:INTEGRITY_STATE.UNVERIFIED, error:'insecure-context', manifest:null, manifestSha256:null, anchor:null, files:[] };
  let manifest; let manifestSha256;
  try {
    const raw=await fetchBytes('/data/manifest.json');
    manifestSha256=await sha256Hex(raw);
    manifest=validateManifestV2(JSON.parse(new TextDecoder().decode(raw)));
    if (manifest.dataVersion !== await canonicalDataVersion(manifest.files)) throw new Error('Manifest dataVersion does not match canonical descriptors');
  } catch (error) {
    const status=error instanceof UnavailableError ? INTEGRITY_STATE.UNVERIFIED : INTEGRITY_STATE.INVALID;
    return { status, error:error.message, manifest:null, manifestSha256:null, anchor:null, files:[] };
  }
  const files=await Promise.all(required.map(async (path) => {
    const expected=manifest.files[path];
    try { const raw=await fetchBytes(servedUrl(path)); const actual=await sha256Hex(raw); return { path, expected:expected.sha256, actual, bytes:raw.byteLength, match:actual === expected.sha256 && raw.byteLength === expected.bytes }; }
    catch (error) { return { path, expected:expected.sha256, actual:null, bytes:null, match:null, error:error.message }; }
  }));
  if (!files.length) return { status:INTEGRITY_STATE.INVALID, error:'zero checked files', manifest, manifestSha256, anchor:null, files };
  if (files.some((file) => file.match === false)) return { status:INTEGRITY_STATE.MISMATCH, error:null, manifest, manifestSha256, anchor:null, files };
  let anchor;
  try { anchor=latestAnchorFor(parseAnchors(new TextDecoder().decode(await fetchBytes('/data/anchors.jsonl'))), manifestSha256); }
  catch (error) {
    const status=error instanceof UnavailableError ? INTEGRITY_STATE.UNVERIFIED : INTEGRITY_STATE.INVALID;
    return { status, error:error.message, manifest, manifestSha256, anchor:null, files };
  }
  if (files.some((file) => file.match === null) || !anchor) return { status:INTEGRITY_STATE.UNVERIFIED, error:null, manifest, manifestSha256, anchor, files };
  const ots = anchor.witnesses?.ots;
  if (!ots?.proof) return { status:INTEGRITY_STATE.UNVERIFIED, error:'no OTS proof record', manifest, manifestSha256, anchor, files };
  try {
    await fetchOtsProof(servedUrl(ots.proof));
  } catch (error) {
    const status = error instanceof UnavailableError ? INTEGRITY_STATE.UNVERIFIED : INTEGRITY_STATE.INVALID;
    return { status, error:error.message, manifest, manifestSha256, anchor, files };
  }
  const verifiedAnchor = { ...anchor, proofAvailable:true };
  return { status:ots.witness.status === 'pending' ? INTEGRITY_STATE.PENDING : INTEGRITY_STATE.VERIFIED, error:null, manifest, manifestSha256, anchor:verifiedAnchor, files };
}

export function useIntegrity(scope='overview') {
  const required=useMemo(() => scopePaths(scope), [scope]);
  const [state,setState]=useState({ status:null, loading:true, error:null, manifest:null, manifestSha256:null, anchor:null, files:[], checkedAt:null });
  useEffect(() => { let ignore=false; checkIntegrity(required).then((next) => { if (!ignore) setState({ ...next, loading:false, checkedAt:new Date().toISOString() }); }); return () => { ignore=true; }; }, [required]);
  return state;
}

export function useAnchorHistory() {
  const [state,setState]=useState({ events:[], loading:true, error:null });
  useEffect(() => { let ignore=false; fetchBytes('/data/anchors.jsonl').then((raw) => parseAnchors(new TextDecoder().decode(raw))).then((events) => !ignore && setState({ events:events.reverse(), loading:false, error:null })).catch((error) => !ignore && setState({ events:[], loading:false, error:error.message })); return () => { ignore=true; }; }, []);
  return state;
}
