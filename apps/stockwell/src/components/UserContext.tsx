'use client';
import type React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

export type AuthUser = { id: string; email: string; name: string; role: string } | null;
const UserContext = createContext<{
  user: AuthUser;
  setUser: (u: AuthUser) => void;
  isAdmin: boolean;
}>({ user: null, setUser: () => {}, isAdmin: false });

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser>(null);
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => setUser(d.user))
      .catch(() => {});
  }, []);
  return (
    <UserContext.Provider value={{ user, setUser, isAdmin: user?.role === 'admin' }}>
      {children}
    </UserContext.Provider>
  );
}
export const useUser = () => useContext(UserContext);
