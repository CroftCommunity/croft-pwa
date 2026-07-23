import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GUIDE } from '../../src/pages/guide-content';

describe('user guide content', () => {
  it('has entries, each with a stable testid, title, and toc label', () => {
    expect(GUIDE.length).toBeGreaterThan(0);
    for (const entry of GUIDE) {
      expect(entry.testid, 'testid').toMatch(/^guide-[a-z-]+$/);
      expect(entry.title.trim().length, `title of ${entry.testid}`).toBeGreaterThan(0);
      expect(entry.toc.trim().length, `toc of ${entry.testid}`).toBeGreaterThan(0);
      expect(entry.blocks.length, `blocks of ${entry.testid}`).toBeGreaterThan(0);
    }
  });

  it('has unique testids (each anchors a TOC link)', () => {
    const ids = GUIDE.map((e) => e.testid);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has no empty prose/note text and no empty step lists', () => {
    for (const entry of GUIDE) {
      for (const block of entry.blocks) {
        if (block.kind === 'prose' || block.kind === 'note') {
          expect(block.text.trim().length, `${entry.testid} ${block.kind}`).toBeGreaterThan(0);
        }
        if (block.kind === 'steps') {
          expect(block.items.length, `${entry.testid} steps`).toBeGreaterThan(0);
          for (const item of block.items) expect(item.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('every screenshot it references exists on disk (rerun `npm run guide:shots`)', () => {
    for (const entry of GUIDE) {
      for (const block of entry.blocks) {
        if (block.kind !== 'shot') continue;
        const path = fileURLToPath(new URL(`../../assets/guide/${block.name}.jpg`, import.meta.url));
        expect(existsSync(path), `missing screenshot assets/guide/${block.name}.jpg`).toBe(true);
      }
    }
  });
});
