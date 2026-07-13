// Vitest global setup. `fake-indexeddb/auto` installs an in-memory IndexedDB
// implementation onto the global scope so services that use IndexedDB can be
// tested deterministically without a real browser database.
import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';

// Keep tests isolated: clear browser storage between them so persisted overlays
// never leak across cases. Guarded because store tests run in the `node`
// environment, which has no localStorage.
afterEach(() => {
  if (typeof localStorage !== 'undefined') localStorage.clear();
});
