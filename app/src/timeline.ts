// The edit: 120 BPM, bar = 2 s. Every boundary sits on a downbeat of the score (music/score.py).
import type { TimelineEntry } from './engine/engine';
import type { Lyrics } from './engine/lyrics';
import type { AudioData } from './engine/audio';
import type { SceneClass } from './engine/scene';
import { REG } from './scenes/_registry';

const scene = (name: string) => async () => {
  const m = REG[name];
  if (!m) throw new Error(`scene not registered: ${name}`);
  return { default: m };
};

export function makeTimeline(_ly: Lyrics, _au: AudioData): TimelineEntry[] {
  const E = (id: string, start: number, end: number, extra: Partial<TimelineEntry> = {}): TimelineEntry => ({ id, load: scene(id), start, end, ...extra });
  return [
    E('stone', 0, 8),
    E('bow', 8, 14.12),
    E('metal', 13.92, 20, { params: { tr: 1 } }), // iris from the impact field
    E('powder', 20, 26.1),
    E('guns', 25.86, 32, { params: { tr: 2 } }), // whip
    E('wars', 32, 40.14),
    E('modern', 39.9, 48.12, { params: { tr: 3 } }), // glitch slices
    E('arsenal', 47.86, 54, { params: { tr: 4 } }), // the picture dissolves into cells
    E('blast', 54, 58),
    E('finale', 58, 68),
  ].filter((e) => REG[e.id]);
}
