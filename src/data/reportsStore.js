// Community incident reports — mock store backed by localStorage.
import { useCallback, useEffect, useState } from 'react';

const KEY = 'bt_reports';

export const INCIDENT_TYPES = ['Pollution', 'Fire', 'Flood'];
export const SEVERITIES = ['Low', 'Moderate', 'High'];
export const REGIONS = ['Sabah', 'Sarawak', 'Brunei', 'Kalimantan'];
export const REPORT_STATUSES = ['Under Review', 'Verified', 'Rejected', 'Duplicate'];

// Extra per-type detail field (per design: different report types have different extra fields)
export const TYPE_EXTRA_FIELDS = {
  Pollution: { label: 'Pollution type', options: ['Air', 'Water', 'Land', 'Noise'] },
  Fire: { label: 'Fire type', options: ['Forest fire', 'Open burning', 'Industrial fire'] },
  Flood: { label: 'Flood level', options: ['Ankle', 'Knee', 'Waist', 'Road blocked'] },
};

const SEED = [
  {
    id: 'R-001',
    type: 'Fire',
    extra: 'Forest fire',
    region: 'Brunei',
    location: 'Kampong Ayer, Bandar Seri Begawan',
    description: 'Smoke visible from the highway',
    severity: 'Low',
    status: 'Verified',
    submittedBy: 'Rei',
    userId: '003',
    date: '2026-01-15',
    time: '10:15 am',
    photo: null,
  },
  {
    id: 'R-002',
    type: 'Flood',
    extra: 'Knee',
    region: 'Sabah',
    location: 'Jalan Lintas, Kota Kinabalu',
    description: 'Road partially flooded after heavy rain',
    severity: 'Moderate',
    status: 'Verified',
    submittedBy: 'Ivy',
    userId: '002',
    date: '2026-01-18',
    time: '3:40 pm',
    photo: null,
  },
  {
    id: 'R-003',
    type: 'Pollution',
    extra: 'Water',
    region: 'Sarawak',
    location: 'Jln Wawasan, 96400 Mukah, Sarawak',
    description: 'really bad odour',
    severity: 'High',
    status: 'Under Review',
    submittedBy: 'Json.C',
    userId: '001',
    date: '2026-01-20',
    time: '8:45 pm',
    photo: null,
  },
];

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(raw) && raw.length) return raw;
  } catch {
    /* ignore */
  }
  localStorage.setItem(KEY, JSON.stringify(SEED));
  return SEED;
}

let listeners = [];
let cache = null;

function emit() {
  localStorage.setItem(KEY, JSON.stringify(cache));
  listeners.forEach((l) => l([...cache]));
}

export function useReports() {
  const [reports, setReports] = useState(() => {
    if (!cache) cache = load();
    return [...cache];
  });

  useEffect(() => {
    const l = (r) => setReports(r);
    listeners.push(l);
    return () => {
      listeners = listeners.filter((x) => x !== l);
    };
  }, []);

  const addReport = useCallback((report) => {
    const nextNum = cache.length + 1;
    const r = {
      id: `R-${String(nextNum).padStart(3, '0')}`,
      status: 'Under Review',
      ...report,
    };
    cache = [r, ...cache];
    emit();
    return r;
  }, []);

  const updateReport = useCallback((id, patch) => {
    cache = cache.map((r) => (r.id === id ? { ...r, ...patch } : r));
    emit();
  }, []);

  const deleteReport = useCallback((id) => {
    cache = cache.filter((r) => r.id !== id);
    emit();
  }, []);

  return { reports, addReport, updateReport, deleteReport };
}
