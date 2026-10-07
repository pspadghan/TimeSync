import rows from './records/events.json';
import type { HistEvent } from './types';

// Dated events for the subcontinent, densest for 1500–1800. Each row in
// records/events.json is an attested event with its evidence grade, the works it rests on
// and the people present. The same file feeds the database (server/api.mjs).
export const events = rows as HistEvent[];
export const eventById = Object.fromEntries(events.map((e) => [e.id, e]));
