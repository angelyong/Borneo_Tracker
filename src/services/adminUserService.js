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

/**
 * Suspend or reactivate one account.
 *
 * Goes through the `admin_set_user_status` RPC rather than a direct table
 * update, and that is not a style choice. `authenticated` has no UPDATE
 * privilege on profiles.status — deliberately, because profiles_update_own
 * covers a user's own row, so granting the column would let anyone lift their
 * own suspension. The RPC is SECURITY DEFINER and checks for admin internally.
 *
 * It also has to THROW rather than return null on failure. The previous version
 * used .update().maybeSingle(), and RLS silently matching zero rows is not an
 * error to Postgres — so a blocked write returned `null` with no error set and
 * the caller could not tell it apart from success. Every failure path here ends
 * in an exception so the UI has something to react to.
 */
export async function setUserStatus(id, status) {
  if (supabase) {
    const { data, error } = await supabase.rpc('admin_set_user_status', {
      target_id: id,
      new_status: status,
    });
    orThrow(error);
    // A composite return arrives as an object; tolerate an array just in case.
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('The account status was not updated.');
    return mapRow(row);
  }
  const target = MOCK_USERS.find((u) => u.id === id);
  if (!target) throw new Error(`No account with id ${id}.`);
  target.status = status;
  return mapRow(target);
}
