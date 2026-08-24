import * as fs from 'fs';
import * as path from 'path';
import { ProcessingMetadata, SessionData } from './types.js';

export const SESSION_FILE_NAME = '.session.json';
export const SESSION_VERSION = 1;

/**
 * Returns the absolute path to the session file in the given mixdown directory.
 */
export const getSessionFilePath = (mixdownDir: string): string => {
  return path.join(mixdownDir, SESSION_FILE_NAME);
};

/**
 * Creates an empty/initial SessionData object.
 */
export const createInitialSession = (
  eventName: string,
  targetSubFolderName?: string,
): SessionData => {
  return {
    version: SESSION_VERSION,
    eventName,
    targetSubFolderName,
    updatedAt: new Date().toISOString(),
    files: {},
  };
};

/**
 * Loads and validates a session file from the mixdown directory.
 * Returns null if the file does not exist, is unreadable, or contains invalid data.
 */
export const loadSession = (mixdownDir: string): SessionData | null => {
  const sessionPath = getSessionFilePath(mixdownDir);
  if (!fs.existsSync(sessionPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(sessionPath, 'utf8');
    const parsed = JSON.parse(content);

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      parsed.version !== SESSION_VERSION ||
      typeof parsed.eventName !== 'string' ||
      typeof parsed.files !== 'object' ||
      parsed.files === null
    ) {
      console.warn(
        '⚠️ Ungültige oder veraltete Sitzungsdatei gefunden. Wird ignoriert.',
      );
      return null;
    }

    return parsed as SessionData;
  } catch (err) {
    console.warn(
      '⚠️ Fehler beim Lesen der Sitzungsdatei. Wird ignoriert:',
      err,
    );
    return null;
  }
};

/**
 * Saves session data to the session file in the mixdown directory.
 */
export const saveSession = (
  mixdownDir: string,
  sessionData: SessionData,
): void => {
  const sessionPath = getSessionFilePath(mixdownDir);
  sessionData.updatedAt = new Date().toISOString();
  fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2), 'utf8');
};

/**
 * Updates a file entry in the session data and saves it immediately to disk.
 */
export const updateFileInSession = (
  mixdownDir: string,
  sessionData: SessionData,
  filename: string,
  metadata: ProcessingMetadata,
): SessionData => {
  sessionData.files[filename] = metadata;
  saveSession(mixdownDir, sessionData);
  return sessionData;
};

/**
 * Deletes the session file from the mixdown directory if it exists.
 */
export const deleteSession = (mixdownDir: string): void => {
  const sessionPath = getSessionFilePath(mixdownDir);
  if (fs.existsSync(sessionPath)) {
    try {
      fs.unlinkSync(sessionPath);
    } catch (err) {
      console.error('Fehler beim Löschen der Sitzungsdatei:', err);
    }
  }
};
