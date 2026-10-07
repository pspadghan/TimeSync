import type { Scene } from './types';

export const SHOTS = [
  { id: 'wide', label: 'Wide establishing', scale: 1, x: 50, y: 50 },
  { id: 'two', label: 'Medium two-shot', scale: 1.35, x: 50, y: 62 },
  { id: 'os-shivaji', label: 'Over-shoulder Shivaji', scale: 1.7, x: 72, y: 58 },
  { id: 'os-ram', label: 'Reverse over-shoulder Ram Singh', scale: 1.7, x: 26, y: 58 },
  { id: 'high', label: 'High-angle room', scale: 1.15, x: 50, y: 20 },
];

export const scenes: Scene[] = [
  {
    id: 'agra-1666',
    eventId: 'agra-1666',
    title: 'After the audience',
    dateLabel: '12 May 1666',
    place: 'Agra',
    setting: 'Private residence or audience chamber · reconstructed; the room has not been identified',
    participants: 'Shivaji Maharaj ↔ Ram Singh of Amber',
    relationship: 'Ram Singh, son of Mirza Raja Jai Singh, was Shivaji’s host at Agra and stood surety for him.',
    image: '/assets/media/living-history/agra-1666-chamber.png',
    imageAlt: 'Illustrative reconstruction: two men seated facing each other across a low table in a Mughal chamber, attendants and a guard behind.',
    reconstructionNote:
      'The letters from Ram Singh’s camp establish what happened at court and that the two men conferred afterwards. They do not preserve dialogue. Faces, dress, seating and the room are illustration — no likeness is claimed.',
    hotspots: [
      { id: 'docs', label: 'Table documents', x: 37, y: 53, note: 'No paper from this meeting survives. The documents on the table are props.' },
      { id: 'light', label: 'Window / light', x: 76, y: 23, note: 'The audience was held during the day; the afternoon light here is a staging choice.' },
      { id: 'sambhaji', label: 'Young Sambhaji', x: 21, y: 40, note: 'Sambhaji, aged nine, travelled to Agra with his father and was presented at court — documented. His presence at this conversation is assumed.' },
      { id: 'guard', label: 'Guard presence', x: 80, y: 41, note: 'After the audience Shivaji’s quarters were watched by men of the city’s police chief, Faulad Khan — documented. A guard inside the room is assumed.' },
      { id: 'room', label: 'Open room map', x: 4, y: 84, note: 'No floor plan can be offered: the building is not identified in the sources.' },
    ],
    chapters: [
      { id: 'c1', title: 'Approach chamber', kind: 'known', shot: 'wide', setting: 'Agra · afternoon',
        paraphrase: 'He has left the audience hall before the ceremony ended.',
        interpretiveNote: 'Documented: Shivaji left his place in the line and refused the robe of honour.',
        narrator: 'At the birthday court Shivaji was stood among commanders of 5,000, behind men his armies had beaten. He protested aloud, moved out of the line and would not accept the robe offered to him.' },
      { id: 'c2', title: 'Conversation begins', kind: 'known', shot: 'two', setting: 'Agra · same chamber · afternoon',
        paraphrase: 'The audience has ended, but its meaning remains unsettled.',
        interpretiveNote: 'Interpretive tension · controlled anger is inferred from the political stakes, not recorded as fact.',
        narrator: 'After the audience Shivaji’s position in Agra was precarious. That he and Ram Singh talked is attested; the room, the seating and every gesture shown here are reconstruction.' },
      { id: 'c3', title: 'Shivaji’s concern', kind: 'known', shot: 'os-ram', setting: 'Agra · same chamber',
        paraphrase: 'He was promised honour on Jai Singh’s word, and has been shown the opposite.',
        interpretiveNote: 'The grievance is documented in the camp letters. This wording is a paraphrase.',
        narrator: 'Shivaji had come north under the Purandar settlement and Jai Singh’s personal assurances. The letters report that he said he would rather die than accept the rank he had been given.' },
      { id: 'c4', title: 'Ram Singh’s response', kind: 'known', shot: 'os-shivaji', setting: 'Agra · same chamber',
        paraphrase: 'He can vouch for his guest’s safety, but not change the emperor’s mind.',
        interpretiveNote: 'Ram Singh’s constrained position is documented; his words are not.',
        narrator: 'Ram Singh tried to calm his guest and to mediate at court. He later signed a bond making himself answerable for Shivaji’s conduct — protection that depended entirely on imperial favour.' },
      { id: 'c5', title: 'Conversation closes', kind: 'known', shot: 'high', setting: 'Agra · same chamber · evening',
        paraphrase: 'Nothing is resolved; he is to stay where he is.',
        interpretiveNote: 'Outcome documented. The moment of parting is reconstruction.',
        narrator: 'Within days a guard under Faulad Khan was posted around Shivaji’s quarters. Petitions to be allowed home went unanswered.' },
      { id: 'c6', title: 'Unknown interval', kind: 'unknown', shot: 'wide', setting: 'Agra · May to August 1666',
        paraphrase: '',
        interpretiveNote: 'No scene is shown for this period because none can be supported.',
        narrator: 'For the next three months the record thins to scattered reports: petitions, a tightening guard, an illness that may have been feigned. What was said and planned inside the house is not known. The next firm date is 17 August, when the quarters were found empty.' },
    ],
    sourceIds: ['jaipur-letters', 'maasir', 'sabhasad', 'sarkar-shivaji'],
  },
];

export const sceneById = Object.fromEntries(scenes.map((s) => [s.id, s]));
