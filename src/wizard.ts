import { input, select, Separator } from '@inquirer/prompts';
import { EventFolder, ExportType, ProcessingMetadata } from './types.js';
import { makeSafeFilename, validateFilenameInput } from './utils.js';

/**
 * Prompts the user via CLI menu to select which event folders to process.
 * Includes pagination with 5 elements per page and a "Load More" function.
 */
export const promptEventSelection = async (
  folders: EventFolder[],
): Promise<EventFolder | null> => {
  let startIndex = 0;
  const PAGE_SIZE = 5;

  while (true) {
    const currentFolders = folders.slice(startIndex, startIndex + PAGE_SIZE);

    // Build choices for the current page
    const choices = currentFolders.map((f, i) => ({
      name:
        startIndex === 0 && i === 0
          ? `${f.displayName} (Neueste)`
          : f.displayName,
      value: f,
    }));

    if (startIndex + PAGE_SIZE < folders.length) {
      choices.push(new Separator() as any);
      choices.push({
        name: '👇 Weitere Veranstaltungen laden...',
        value: 'LOAD_MORE' as any,
      });
    }

    if (startIndex > 0) {
      choices.push({
        name: '👆 Vorherige laden...',
        value: 'LOAD_PREV' as any,
      });
    }

    const answer = await select<EventFolder | 'LOAD_MORE' | 'LOAD_PREV'>({
      message: 'Welche Veranstaltung möchtest du bearbeiten?',
      choices,
    });

    if (answer === 'LOAD_MORE') {
      startIndex += PAGE_SIZE;
    } else if (answer === 'LOAD_PREV') {
      startIndex = Math.max(0, startIndex - PAGE_SIZE);
    } else {
      return answer as EventFolder;
    }
  }
};

/**
 * Prompts the user for a validated text input that must be safe for Windows filenames.
 * Optionally converts the input to uppercase. On invalid characters, offers auto-fix
 * or manual re-entry.
 */
const promptValidatedFilenameInput = async (options: {
  message: string;
  defaultValue: string;
  emptyError: string;
  reEditLabel: string;
  toUpperCase?: boolean;
}): Promise<string> => {
  while (true) {
    let rawValue = await input({
      message: options.message,
      default: options.defaultValue,
      validate: (val) =>
        val.trim().length > 0 ? true : options.emptyError,
    });

    if (options.toUpperCase) {
      rawValue = rawValue.toUpperCase();
    }

    rawValue = rawValue.trim();

    const validation = validateFilenameInput(rawValue);

    if (validation === true) {
      return rawValue;
    }

    console.log(`\n⚠️ ${validation}`);
    const suggested = makeSafeFilename(rawValue);

    const action = await select({
      message: 'Wie möchtest du fortfahren?',
      choices: [
        {
          name: `✅ Ungültige Zeichen automatisch entfernen → "${suggested}"`,
          value: 'auto',
        },
        {
          name: `✏️  ${options.reEditLabel} selbst korrigieren (erneute Eingabe)`,
          value: 'reedit',
        },
      ],
    });

    if (action === 'auto') {
      return suggested;
    }
  }
};

/**
 * Starts the configuration wizard for a single MP3 file.
 * Certain questions (e.g. track number) may change depending on file count.
 */
export const promptMp3Metadata = async (
  mp3TitleDefault: string,
  isMultiple: boolean,
  defaultTrackNum: number,
): Promise<ProcessingMetadata> => {
  console.log('\n----------------------------------------');

  const safeTitle = await promptValidatedFilenameInput({
    message: 'Titel (z.B. "Jesus heilt die Wunden"):',
    defaultValue: mp3TitleDefault,
    emptyError: 'Bitte einen Titel eingeben!',
    reEditLabel: 'Titel',
    toUpperCase: true,
  });

  // Prompt for export type
  const exportType = (await select({
    message: 'Art des Exports:',
    choices: [
      { name: 'Botschaft (Standard)', value: 'Botschaft' },
      { name: 'Lied', value: 'Lied' },
      { name: 'Moderation', value: 'Moderation' },
      { name: 'Begrüßung', value: 'Begrüßung' },
      { name: 'Abschluss', value: 'Abschluss' },
      { name: 'Eigene Eingabe...', value: 'Sonstiges' },
    ],
  })) as ExportType;

  let customExportType = undefined;
  if (exportType === 'Sonstiges') {
    customExportType = await input({
      message: 'Bitte Bezeichnung für dieses Element eingeben:',
      validate: (val) =>
        val.trim().length > 0 ? true : 'Bitte eine Bezeichnung eingeben!',
    });
  }

  // Preacher / Group (Optional, can be left empty for e.g. songs)
  const preacherOrGroup = await input({
    message:
      'Name des Predigers/Gruppe (Optional - Leer lassen falls nicht benötigt):',
    validate: (val) => {
      // If left empty, it's valid
      if (val.trim().length === 0) return true;
      // Strict format validation to prevent filesystem errors
      return validateFilenameInput(val);
    },
  });

  // Track numbering is only prompted if there are multiple files in the Mixdown folder
  let trackNumber = defaultTrackNum;
  if (isMultiple) {
    const rawTrackNum = await input({
      message: 'Track-Nummer (Titel CD-Reihenfolge):',
      default: defaultTrackNum.toString(),
      validate: (val) => {
        const parsed = parseInt(val, 10);
        if (isNaN(parsed) || parsed < 1)
          return 'Bitte eine gültige Nummer > 0 eingeben!';
        return true;
      },
    });
    trackNumber = parseInt(rawTrackNum, 10);
  }

  return {
    title: safeTitle,
    preacherOrGroup: preacherOrGroup.trim(),
    exportType,
    customExportType,
    trackNumber,
  };
};

/**
 * Prompts the user for the target drive folder name during multi-file processing.
 * Validates against illegal Windows filename characters and uppercases the input.
 */
export const promptTargetFolderName = async (
  defaultFolderName: string,
): Promise<string> => {
  console.log('\n----------------------------------------');

  return promptValidatedFilenameInput({
    message: 'Ziel-Ordnername in Google Drive:',
    defaultValue: defaultFolderName,
    emptyError: 'Bitte einen Ordnernamen eingeben!',
    reEditLabel: 'Ordnername',
    toUpperCase: true,
  });
};
