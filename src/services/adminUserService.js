// ADMIN user service — what the /admin/users page reads and writes.
// Same two-mode pattern as adminNewsService.js:
//  • Supabase configured → reads/writes the LIVE profiles table. RLS lets an
//    authenticated admin see every row (all statuses) and update them.
//  • NOT configured → a small in-memory mock, so local dev and the vitest
//    suite (which run with no keys) keep working with no login.
//
// Note: auth.users (email) isn't queryable from the client with the anon
// key, so this only surfaces what public.profiles actually has — no email
// column here, rather than fabricate one.

import { supabase } from './supabaseClient';

const TABLE = 'profiles';

const MOCK_USERS = [
  { id: '00000000-0000-0000-0000-000000000001', first_name: 'Json', last_name: 'Chen', role: 'user', status: 'active', created_at: '2025-02-11T00:00:00.000Z' },
  { id: '00000000-0000-0000-0000-000000000002', first_name: 'Ivy', last_name: '', role: 'admin', status: 'active', created_at: '2025-01-04T00:00:00.000Z' },
  { id: '00000000-0000-0000-0000-000000000003', first_name: 'Irene', last_name: 'Teo', role: 'user', status: 'suspended', created_at: '2025-03-22T00:00:00.000Z' },
];

function mapRow(row) {
  return {
    id: row.id,
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    role: row.role || 'user',
    status: row.status || 'active',
    createdAt: row.created_at,
  };
}

function orThrow(error) {
  if (error) throw new Error(error.message);
}

/** Every account, newest first — the roster an admin can act on. */
export async function getAllUsers() {
  if (supabase) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, first_name, last_name, role, status, created_at')
      .order('created_at', { ascending: false });
    orThrow(error);
    return (data || []).map(mapRow);
  }
  return MOCK_USERS.map(mapRow);
}

/** Suspend or reactivate one account. */
export async function setUserStatus(id, status) {
  if (supabase) {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ status })
      .eq('id', id)
      .select('id, first_name, last_name, role, status, created_at')
      .maybeSingle();
    orThrow(error);
    return data ? mapRow(data) : null;
  }
  const target = MOCK_USERS.find((u) => u.id === id);
  if (target) target.status = status;
  return target ? mapRow(target) : null;
}
