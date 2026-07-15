import { createContext } from 'react';

// Shared auth context. Consumed via the useAuth() hook; provided by AuthProvider.
export const AuthContext = createContext(null);
