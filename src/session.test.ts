import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import {
  createInitialSession,
  deleteSession,
  getSessionFilePath,
  loadSession,
  saveSession,
  SESSION_FILE_NAME,
  SESSION_VERSION,
  updateFileInSession,
} from './session.js';
import { ProcessingMetadata, SessionData } from './types.js';

describe('Session Management', () => {
  const testDir = path.resolve(process.cwd(), 'test-session-dir');

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should return correct session file path', () => {
    const sessionPath = getSessionFilePath(testDir);
    expect(sessionPath).toBe(path.join(testDir, SESSION_FILE_NAME));
  });

  it('should return null if no session file exists', () => {
    const session = loadSession(testDir);
    expect(session).toBeNull();
  });

  it('should create, save and load a session correctly', () => {
    const initial = createInitialSession(
      '2026_08_24 (Gottesdienst)',
      '2026_08_24_Gottesdienst',
    );
    expect(initial.version).toBe(SESSION_VERSION);
    expect(initial.eventName).toBe('2026_08_24 (Gottesdienst)');
    expect(initial.targetSubFolderName).toBe('2026_08_24_Gottesdienst');
    expect(initial.files).toEqual({});

    saveSession(testDir, initial);

    const loaded = loadSession(testDir);
    expect(loaded).not.toBeNull();
    expect(loaded?.eventName).toBe('2026_08_24 (Gottesdienst)');
    expect(loaded?.targetSubFolderName).toBe('2026_08_24_Gottesdienst');
    expect(loaded?.files).toEqual({});
  });

  it('should update files in session and persist them', () => {
    const session = createInitialSession('2026_08_24 (Gottesdienst)');
    saveSession(testDir, session);

    const metadata1: ProcessingMetadata = {
      title: 'ERÖFFNUNG',
      exportType: 'Begrüßung',
      preacherOrGroup: 'Leiter',
      trackNumber: 1,
    };

    updateFileInSession(testDir, session, '01_Intro.mp3', metadata1);

    let loaded = loadSession(testDir);
    expect(loaded?.files['01_Intro.mp3']).toEqual(metadata1);

    const metadata2: ProcessingMetadata = {
      title: 'HAUPTPREDIGT',
      exportType: 'Botschaft',
      preacherOrGroup: 'Gastprediger',
      trackNumber: 2,
    };

    updateFileInSession(testDir, session, '02_Predigt.mp3', metadata2);

    loaded = loadSession(testDir);
    expect(Object.keys(loaded!.files).length).toBe(2);
    expect(loaded?.files['01_Intro.mp3']).toEqual(metadata1);
    expect(loaded?.files['02_Predigt.mp3']).toEqual(metadata2);
  });

  it('should return null and warn for corrupted session files', () => {
    const sessionPath = getSessionFilePath(testDir);
    fs.writeFileSync(sessionPath, 'invalid json {{{', 'utf8');

    const loaded = loadSession(testDir);
    expect(loaded).toBeNull();
  });

  it('should return null for incompatible session versions', () => {
    const sessionPath = getSessionFilePath(testDir);
    fs.writeFileSync(
      sessionPath,
      JSON.stringify({
        version: 999,
        eventName: 'Test',
        files: {},
      }),
      'utf8',
    );

    const loaded = loadSession(testDir);
    expect(loaded).toBeNull();
  });

  it('should delete session file properly', () => {
    const session = createInitialSession('2026_08_24 (Gottesdienst)');
    saveSession(testDir, session);

    const sessionPath = getSessionFilePath(testDir);
    expect(fs.existsSync(sessionPath)).toBe(true);

    deleteSession(testDir);
    expect(fs.existsSync(sessionPath)).toBe(false);
  });
});
