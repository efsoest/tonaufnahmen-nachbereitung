import * as fs from 'fs';
import * as path from 'path';
import { EventFolder, Mp3File } from './types.js';

/**
 * Validates a string to ensure it's a safe Windows filename.
 * Windows invalid chars: < > : " / \\ | ? *
 * Returns true if valid, or a generic error string.
 */
export const validateFilenameInput = (input: string): boolean | string => {
  const invalidChars = /[<>:"/\\|?*]/g;
  const match = input.match(invalidChars);
  if (match) {
    return `Ungültiges Zeichen '${match[0]}' gefunden. Bitte entferne es.`;
  }
  return true;
};

/**
 * Replaces German umlauts and ensures the filename is safe for Windows.
 */
export const makeSafeFilename = (input: string): string => {
  return input
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae')
    .replace(/Ö/g, 'Oe')
    .replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    .replace(/[<>:"/\\|?*]/g, '') // Remove forbidden chars
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();
};

/**
 * Reads the base directory and searches for event folders.
 * Expected format of folder names is e.g., "2026_02_13 (Gottesdienst)".
 */
export const getEventFolders = (baseDir: string): EventFolder[] => {
  try {
    const items = fs.readdirSync(baseDir, { withFileTypes: true });

    const folders: EventFolder[] = [];

    for (const item of items) {
      if (!item.isDirectory()) continue;

      const fullPath = path.join(baseDir, item.name);

      // Try to parse YYYY_MM_DD pattern at the beginning of the folder name
      const match = item.name.match(/^(\d{4})_(\d{2})_(\d{2})/);

      // Only include folders that actually start with a date pattern
      if (match) {
        const date = new Date(`${match[1]}-${match[2]}-${match[3]}`);
        folders.push({
          folderName: item.name,
          fullPath,
          date,
          displayName: item.name,
        });
      }
    }

    // Sort descending by date (newest first)
    return folders.sort((a, b) => b.date.getTime() - a.date.getTime());
  } catch (err) {
    return [];
  }
};

/**
 * Finds all .mp3 files in a directory and returns them sorted alphabetically.
 */
export const getMp3FilesInDir = (dirPath: string): Mp3File[] => {
  if (!fs.existsSync(dirPath)) return [];

  try {
    const files = fs
      .readdirSync(dirPath)
      .filter((f) => f.toLowerCase().endsWith('.mp3'))
      .sort((a, b) => a.localeCompare(b)); // Alphabetical sorting for correct default track sequence

    return files.map((f) => ({
      filename: f,
      fullPath: path.join(dirPath, f),
    }));
  } catch (err) {
    console.error(`Fehler beim Lesen der MP3-Dateien in ${dirPath}:`, err);
    return [];
  }
};

/**
 * Formats a track number with a leading zero (e.g., 1 -> "01").
 */
export const padTrackNumber = (num: number): string => {
  return num.toString().padStart(2, '0');
};

/**
 * Waits for the user to press any key before exiting the process.
 * Useful to prevent the terminal window from closing immediately.
 */
export const waitForKeyPressAndExit = async (exitCode: number = 0): Promise<void> => {
  console.log('\nDrücke eine beliebige Taste zum Beenden...');

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.exit(exitCode);
    });
  } else {
    // Fallback if not running in a TTY environment
    process.exit(exitCode);
  }

  // Keep the process alive while waiting for the event
  await new Promise(() => {});
};
