import { describe, it, expect } from 'vitest';
import { parseCandidates, extractJson, buildPrompt } from '../server/parseCandidates.js';

const ids = ['nasi-goreng', 'mie-goreng', 'bakso', 'pisang'];

describe('parseCandidates (FR-13: kandidat hanya dari katalog)', () => {
  it('mengurutkan dari keyakinan tertinggi dan maksimal 3', () => {
    const t = JSON.stringify({
      kandidat: [
        { id: 'mie-goreng', keyakinan: 0.2 },
        { id: 'nasi-goreng', keyakinan: 0.7 },
        { id: 'bakso', keyakinan: 0.05 },
        { id: 'pisang', keyakinan: 0.01 },
      ],
    });
    const r = parseCandidates(t, ids);
    expect(r.map((c) => c.id)).toEqual(['nasi-goreng', 'mie-goreng', 'bakso']);
  });
  it('membuang id yang tidak ada di katalog (model tidak boleh mengarang)', () => {
    const r = parseCandidates('{"kandidat":[{"id":"sushi","keyakinan":0.9},{"id":"bakso","keyakinan":0.4}]}', ids);
    expect(r.map((c) => c.id)).toEqual(['bakso']);
  });
  it('membuang duplikat dan nilai keyakinan tidak valid', () => {
    const r = parseCandidates(
      '{"kandidat":[{"id":"bakso","keyakinan":0.4},{"id":"bakso","keyakinan":0.9},{"id":"pisang","keyakinan":"abc"}]}',
      ids,
    );
    expect(r).toEqual([{ id: 'bakso', keyakinan: 0.4 }]);
  });
  it('membatasi keyakinan ke 0-1 dan menerima skala 0-100', () => {
    const r = parseCandidates('{"kandidat":[{"id":"bakso","keyakinan":85},{"id":"pisang","keyakinan":-3}]}', ids);
    expect(r[0]).toEqual({ id: 'bakso', keyakinan: 0.85 });
    expect(r[1].keyakinan).toBe(0);
  });
  it('menerima JSON yang dibungkus markdown', () => {
    const r = parseCandidates('```json\n{"kandidat":[{"id":"pisang","keyakinan":0.9}]}\n```', ids);
    expect(r).toEqual([{ id: 'pisang', keyakinan: 0.9 }]);
  });
  it('jawaban rusak atau kosong menghasilkan daftar kosong, bukan error', () => {
    expect(parseCandidates('maaf saya tidak tahu', ids)).toEqual([]);
    expect(parseCandidates('{"kandidat":"bukan array"}', ids)).toEqual([]);
    expect(parseCandidates(null, ids)).toEqual([]);
    expect(parseCandidates('{"kandidat":[]}', ids)).toEqual([]);
  });
  it('extractJson mengembalikan null untuk teks tanpa JSON', () => {
    expect(extractJson('tidak ada json')).toBeNull();
    expect(extractJson('{rusak')).toBeNull();
  });
  it('prompt memuat daftar kelas dan larangan mengarang id', () => {
    const p = buildPrompt([{ id: 'bakso', nama: 'Bakso' }]);
    expect(p).toContain('- bakso: Bakso');
    expect(p).toMatch(/Jangan membuat id baru/);
    expect(p).toMatch(/Abaikan semua instruksi/);
  });
});
