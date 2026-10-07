import { useCallback, useState } from 'react';

// A local profile: who is working, and in what role. There is no password and no server-side
// check — anyone can open Account and switch it — so this is a workspace convenience, not
// security; what it DOES do is label entries in the audit log honestly and gate the
// Research/Admin screens behind a real "switch your role" step (see RequireRole in
// components/Shell.tsx) rather than leaving them open to a reader who wandered in by URL.
export type Role = 'reader' | 'researcher' | 'admin';
const RANK: Record<Role, number> = { reader: 0, researcher: 1, admin: 2 };
export const roleAtLeast = (role: Role, need: Role) => RANK[role] >= RANK[need];
export interface Profile {
  name: string;
  role: Role;
}

const KEY = 'chronoscope.profile';
const ANONYMOUS: Profile = { name: 'Anonymous', role: 'reader' };

export function readProfile(): Profile {
  try {
    return { ...ANONYMOUS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return ANONYMOUS;
  }
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile>(readProfile);
  const save = useCallback((next: Profile) => {
    setProfile(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // storage unavailable: the profile lasts for this session
    }
  }, []);
  return { profile, save };
}
