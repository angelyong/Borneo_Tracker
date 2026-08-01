import { describe, it, expect, beforeEach, vi } from 'vitest';

// Pretend Supabase is configured so the service takes its live path instead of
// the in-memory mock. `from` is included purely so the test can assert that the
// service does NOT reach for a direct table update.
const rpc = vi.fn();
const from = vi.fn();
vi.mock('./supabaseClient', () => ({
  supabase: {
    rpc: (...args) => rpc(...args),
    from: (...args) => from(...args),
  },
  isSupabaseConfigured: true,
}));

import { setUserStatus } from './adminUserService';

const ROW = {
  id: 'af795ba2-5e6f-4946-94f6-4aaaaaaaaaaa',
  first_name: 'Henry',
  last_name: 'Chin',
  role: 'user',
  status: 'suspended',
  created_at: '2026-02-11T00:00:00.000Z',
};

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
});

describe('setUserStatus', () => {
  it('calls the admin_set_user_status RPC and maps the row it returns', async () => {
    rpc.mockResolvedValue({ data: ROW, error: null });

    const result = await setUserStatus(ROW.id, 'suspended');

    expect(rpc).toHaveBeenCalledWith('admin_set_user_status', {
      target_id: ROW.id,
      new_status: 'suspended',
    });
    expect(result).toEqual({
      id: ROW.id,
      firstName: 'Henry',
      lastName: 'Chin',
      role: 'user',
      status: 'suspended',
      createdAt: ROW.created_at,
    });
  });

  it('never writes to the profiles table directly', async () => {
    // A direct .update() is what the bug was: `authenticated` has no UPDATE
    // privilege on profiles.status, and RLS matching zero rows is not an error,
    // so the write silently did nothing while reporting success.
    rpc.mockResolvedValue({ data: ROW, error: null });

    await setUserStatus(ROW.id, 'suspended');

    expect(from).not.toHaveBeenCalled();
  });

  it('throws when the database rejects the call', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'not authorised' } });

    await expect(setUserStatus(ROW.id, 'suspended')).rejects.toThrow('not authorised');
  });

  // The regression test that matters: this is the exact shape the old code
  // returned when RLS blocked the write — no error, no row — and it used to be
  // reported to the user as a success.
  it('throws, rather than returning null, when no row comes back', async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    await expect(setUserStatus(ROW.id, 'suspended')).rejects.toThrow(/not updated/i);
  });

  it('tolerates the row arriving wrapped in an array', async () => {
    rpc.mockResolvedValue({ data: [ROW], error: null });

    const result = await setUserStatus(ROW.id, 'suspended');

    expect(result.status).toBe('suspended');
  });

  it('passes the requested status through unchanged when reactivating', async () => {
    rpc.mockResolvedValue({ data: { ...ROW, status: 'active' }, error: null });

    const result = await setUserStatus(ROW.id, 'active');

    expect(rpc).toHaveBeenCalledWith('admin_set_user_status', {
      target_id: ROW.id,
      new_status: 'active',
    });
    expect(result.status).toBe('active');
  });
});
