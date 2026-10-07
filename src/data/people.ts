import rows from './records/people.json';
import type { Person } from './types';

export const SHIVAJI_PHASES = ['Birth & childhood', 'Youth', 'Rise', 'Active campaigns', 'Expansion & administration', 'Final years'];

// Each person has a permanent id and a lifespan; those with a `journey` also have dated stages.
export const people = rows as Person[];
export const personById = Object.fromEntries(people.map((p) => [p.id, p]));
