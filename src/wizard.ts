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
 * Starts the configuration wizard for a single MP3 file.
 * Certain questions (e.g. track number) may change depending on file count.
 */
export const promptMp3Metadata = async (
  mp3TitleDefault: string,
  isMultiple: boolean,
  defaultTrackNum: number,
): Promise<ProcessingMetadata> => {
  // Prompt and validate title (loop to allow re-entry on invalid characters)
  console.log('\n----------------------------------------');
  let safeTitle = '';

  while (true) {
    let rawTitle = await input({
      message: 'Titel (z.B. "Jesus heilt die Wunden"):',
      default: mp3TitleDefault, // Default to file name without .mp3 extension
      validate: (val) =>
        val.trim().length > 0 ? true : 'Bitte einen Titel eingeben!',
    });

    // Automatically uppercase the title (requirement)
    rawTitle = rawTitle.toUpperCase();

    // Safety check to ensure the title doesn't contain illegal Windows filesystem characters
    const titleValidation = validateFilenameInput(rawTitle);

    if (titleValidation === true) {
      safeTitle = rawTitle;
      break;
    }

    // Invalid characters found – show warning and offer choices
    console.log(`\n⚠️ ${titleValidation}`);
    const suggestedTitle = makeSafeFilename(rawTitle);

    const action = await select({
      message: 'Wie möchtest du fortfahren?',
      choices: [
        {
          name: `✅ Ungültige Zeichen automatisch entfernen → "${suggestedTitle}"`,
          value: 'auto',
        },
        {
          name: '✏️  Titel selbst korrigieren (erneute Eingabe)',
          value: 'reedit',
        },
      ],
    });

    if (action === 'auto') {
      safeTitle = suggestedTitle;
      break;
    }
    // action === 'reedit' → loop continues, user gets a fresh prompt
  }

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
