import { useState } from 'react';
import { readProfile } from './account';

// An append-only record of every review decision: who decided what, when, and why.
export interface AuditEntry {
  at: number;
  who: string;
  role: string;
  kind: 'source' | 'proposal';
  subject: string;
  decision: 'approved' | 'returned';
  note?: string;
}

const KEY = 'chronoscope.audit';
const read = (): AuditEntry[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
};

export function logDecision(entry: Omit<AuditEntry, 'at' | 'who' | 'role'>) {
  const p = readProfile();
  try {
    localStorage.setItem(KEY, JSON.stringify([{ ...entry, at: Date.now(), who: p.name, role: p.role }, ...read()]));
  } catch {
    // storage unavailable: the decision still took effect
  }
}

export const useAudit = () => useState<AuditEntry[]>(read)[0];
