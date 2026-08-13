import { describe, expect, it } from 'bun:test';
import { makeSafeFilename, validateFilenameInput } from './utils.js';

describe('Filename Validation & Sanitization', () => {
  it('should return true for valid filenames', () => {
    expect(validateFilenameInput('2025_10_31 30 JAHRE JUBILÄUM')).toBe(true);
    expect(validateFilenameInput('Gottesdienst - Lied 01')).toBe(true);
  });

  it('should detect invalid Windows filename characters', () => {
    const result = validateFilenameInput('Test?Folder');
    expect(typeof result).toBe('string');
    expect(result).toContain('Ungültiges Zeichen');
  });

  it('should sanitize filename properly', () => {
    expect(makeSafeFilename('2025_10_31 30 JAHRE? JUBILÄUM')).toBe(
      '2025_10_31 30 JAHRE JUBILAEUM',
    );
    expect(makeSafeFilename('Ordner <mit> Sonderzeichen*')).toBe(
      'Ordner mit Sonderzeichen',
    );
  });
});
