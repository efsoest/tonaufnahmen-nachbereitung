import { select } from '@inquirer/prompts';
import * as fs from 'fs';
import ora from 'ora';
import * as path from 'path';
import { BASE_DIR, DRIVE_DIR, MIXDOWN_FOLDER_NAME } from './config.js';
import {
  createInitialSession,
  deleteSession,
  loadSession,
  saveSession,
  updateFileInSession,
} from './session.js';
import { buildFinalFilename, buildId3Title, writeId3Tags } from './tagger.js';
import { Mp3File, ProcessingMetadata, SessionData } from './types.js';
import {
  getEventFolders,
  getMp3FilesInDir,
  waitForKeyPressAndExit,
} from './utils.js';
import {
  promptEventSelection,
  promptMp3Metadata,
  promptResumeSession,
  promptTargetFolderName,
} from './wizard.js';

async function main() {
  console.clear();
  console.log('🎙️  Willkommen zur Tonaufnahmen-Nachbereitung!\n');

  // Validate BASE_DIR
  if (!fs.existsSync(BASE_DIR)) {
    console.log(
      '\n❌ Der Konfigurierte Basis-Ordner (baseDir) existiert nicht.',
    );
    console.log(`Pfad: ${BASE_DIR}`);
    console.log('Bitte überprüfe die config.yml und den Pfad.');
    await waitForKeyPressAndExit(1);
    return;
  }

  // Find event folders
  console.log(`Suche nach Veranstaltungsordnern in: ${BASE_DIR}...`);
  const folders = getEventFolders(BASE_DIR);

  if (folders.length === 0) {
    console.log('\n❌ Keine Ordner mit dem Format JJJJ_MM_TT gefunden.');
    console.log(
      `Bitte stelle sicher, dass du das Programm im Hauptordner ausführst.`,
    );
    await waitForKeyPressAndExit(1);
    return;
  }

  // Select event folder via CLI
  const selectedEvent = await promptEventSelection(folders);
  if (!selectedEvent) {
    console.log('Abbruch.');
    await waitForKeyPressAndExit(0);
    return;
  }

  console.log(`\n📂 Ausgewählt: ${selectedEvent.displayName}`);

  // Search for MP3 files in the "Mixdown" subfolder
  const mixdownDir = path.join(selectedEvent.fullPath, MIXDOWN_FOLDER_NAME);
  const mp3Files = getMp3FilesInDir(mixdownDir);

  if (mp3Files.length === 0) {
    console.log(
      `\n❌ Keine MP3-Dateien im Ordner "${MIXDOWN_FOLDER_NAME}" gefunden.`,
    );
    console.log(
      `Bitte exportiere die Tonaufnahme aus deiner DAW (z.B. Cubase) als MP3 in den Ordner:`,
    );
    console.log(`-> ${mixdownDir}`);
    console.log(`Starte das Programm danach erneut.`);
    await waitForKeyPressAndExit(1);
    return;
  }

  const isMultiple = mp3Files.length > 1;
  console.log(`Gefunden: ${mp3Files.length} MP3-Datei(en).`);

  let isReady = false;
  let targetDriveFolder = '';
  let targetSubFolderName = '';
  let processedFiles: {
    originalMp3: Mp3File;
    metadata: ProcessingMetadata;
    finalFilename: string;
    finalTitle: string;
  }[] = [];
  let previousProcessedFiles: {
    originalMp3: Mp3File;
    metadata: ProcessingMetadata;
    finalFilename: string;
    finalTitle: string;
  }[] = [];

  let sessionData: SessionData | null = null;
  let isResuming = false;

  if (isMultiple) {
    const existingSession = loadSession(mixdownDir);
    if (existingSession) {
      const savedCount = mp3Files.filter((f) =>
        Boolean(existingSession.files[f.filename]),
      ).length;

      if (savedCount > 0) {
        const choice = await promptResumeSession(savedCount, mp3Files.length);
        if (choice === 'resume') {
          sessionData = existingSession;
          isResuming = true;
          if (existingSession.targetSubFolderName) {
            targetSubFolderName = existingSession.targetSubFolderName;
          }
        } else {
          deleteSession(mixdownDir);
          sessionData = createInitialSession(selectedEvent.displayName);
        }
      } else {
        sessionData = existingSession;
      }
    } else {
      sessionData = createInitialSession(selectedEvent.displayName);
    }
  }

  while (!isReady) {
    // Collect metadata and paths for all files for the final summary
    processedFiles = [];

    // Prompt for target drive folder name if processing multiple files
    if (isMultiple) {
      if (isResuming && targetSubFolderName) {
        console.log(`\n📂 Ziel-Ordnername aus Sitzung: ${targetSubFolderName}`);
      } else {
        targetSubFolderName = await promptTargetFolderName(
          targetSubFolderName || selectedEvent.displayName,
        );
        if (sessionData) {
          sessionData.targetSubFolderName = targetSubFolderName;
          saveSession(mixdownDir, sessionData);
        }
      }
    }

    for (let i = 0; i < mp3Files.length; i++) {
      const mp3 = mp3Files[i];
      const defaultTrackNum = i + 1; // 1-basiert

      const savedMetadata =
        isResuming && sessionData?.files[mp3.filename]
          ? sessionData.files[mp3.filename]
          : undefined;

      if (savedMetadata) {
        const finalFilename = buildFinalFilename(
          savedMetadata,
          selectedEvent.date,
          isMultiple,
        );
        const finalTitle = buildId3Title(savedMetadata);

        console.log(
          `⏩ [${defaultTrackNum}/${mp3Files.length}] ${mp3.filename} -> ${finalTitle} (aus Sitzung übernommen)`,
        );

        processedFiles.push({
          originalMp3: mp3,
          metadata: savedMetadata,
          finalFilename,
          finalTitle,
        });
        continue;
      }

      console.log(
        `\n🎵 Bearbeite Datei ${defaultTrackNum} von ${mp3Files.length}: ${mp3.filename}`,
      );

      // Propose previous/existing title or filename without .mp3 as the default title
      const existingMetadata =
        previousProcessedFiles[i]?.metadata || sessionData?.files[mp3.filename];
      const defaultTitle =
        existingMetadata?.title || path.basename(mp3.filename, '.mp3');

      const metadata = await promptMp3Metadata(
        defaultTitle,
        isMultiple,
        defaultTrackNum,
        existingMetadata,
      );
      const finalFilename = buildFinalFilename(
        metadata,
        selectedEvent.date,
        isMultiple,
      );
      const finalTitle = buildId3Title(metadata);

      if (isMultiple && sessionData) {
        updateFileInSession(mixdownDir, sessionData, mp3.filename, metadata);
      }

      processedFiles.push({
        originalMp3: mp3,
        metadata,
        finalFilename,
        finalTitle,
      });
    }

    // Reset resume flag after first pass so subsequent edits allow full walkthrough
    isResuming = false;

    // Summary & Confirmation
    console.clear();
    console.log('📋 --- ZUSAMMENFASSUNG ---\n');

    // Show planned target directory
    // Multi-file: custom prompt folder name. Single file: filename without .mp3
    const mainFolderName = isMultiple
      ? targetSubFolderName
      : path.basename(processedFiles[0].finalFilename, '.mp3');
    targetDriveFolder = path.join(DRIVE_DIR, mainFolderName);

    // Validate DRIVE_DIR before proceeding
    if (!fs.existsSync(DRIVE_DIR)) {
      console.log(
        '\n❌ Der konfigurierte Ziel-Ordner (driveDir) existiert nicht.',
      );
      console.log(`Google Drive Pfad: ${DRIVE_DIR}`);
      console.log(
        'Bitte überprüfe die config.yml und stelle sicher, dass Google Drive verbunden ist.',
      );
      await waitForKeyPressAndExit(1);
      return;
    }

    console.log(`📂 Ziel-Ordner in Google Drive:\n-> ${targetDriveFolder}\n`);

    for (const item of processedFiles) {
      console.log(`🎵 Original: ${item.originalMp3.filename}`);
      console.log(`   -> ID3-Titel: ${item.finalTitle}`);
      console.log(`   -> Neuer Name: ${item.finalFilename}`);
      console.log(`   -> Track: ${item.metadata.trackNumber}\n`);
    }

    const action = await select({
      message: 'Was möchtest du tun?',
      choices: [
        {
          name: '✅ Ja, jetzt speichern und in Drive kopieren',
          value: 'save',
        },
        {
          name: '✏️  Nein, Eingaben korrigieren',
          value: 'edit',
        },
        {
          name: '❌ Abbrechen',
          value: 'cancel',
        },
      ],
    });

    if (action === 'cancel') {
      console.log('Abbruch durch Nutzer.');
      await waitForKeyPressAndExit(0);
      return;
    } else if (action === 'edit') {
      console.log('\n--- Eingaben bearbeiten ---');
      previousProcessedFiles = [...processedFiles];
      continue;
    } else if (action === 'save') {
      isReady = true;
    }
  }

  // Process files (In-place ID3 tags and rename/copy)
  let errors = 0;

  // Create target folder in Drive if it doesn't exist
  if (!fs.existsSync(targetDriveFolder)) {
    try {
      fs.mkdirSync(targetDriveFolder, { recursive: true });
    } catch (err) {
      console.error(
        `\n❌ Fehler beim Erstellen des Drive-Ordners ${targetDriveFolder}:`,
        err,
      );
      await waitForKeyPressAndExit(1);
      return;
    }
  }

  for (const item of processedFiles) {
    process.stdout.write(
      `Schreibe ID3-Tags für ${item.originalMp3.filename}... `,
    );
    const success = writeId3Tags(
      item.originalMp3,
      item.metadata,
      selectedEvent.date,
      selectedEvent.displayName,
    );

    if (!success) {
      console.log('Fehler!');
      errors++;
      continue;
    }
    console.log('OK');

    // Rename the file in-place in the original folder (Mixdown)
    const newLocalPath = path.join(mixdownDir, item.finalFilename);
    try {
      // If the new name is different from the old one
      if (item.originalMp3.fullPath !== newLocalPath) {
        fs.renameSync(item.originalMp3.fullPath, newLocalPath);
      }

      // Copy the file (Asynchronous with loading spinner)
      const driveFilePath = path.join(targetDriveFolder, item.finalFilename);

      const spinner = ora(
        `Kopiere ${item.finalFilename} nach Google Drive...`,
      ).start();

      try {
        await new Promise<void>((resolve, reject) => {
          const readStream = fs.createReadStream(newLocalPath);
          const writeStream = fs.createWriteStream(driveFilePath);

          readStream.on('error', reject);
          writeStream.on('error', reject);
          writeStream.on('finish', () => resolve());

          readStream.pipe(writeStream);
        });
        spinner.succeed('Kopie erfolgreich!');
      } catch (streamErr) {
        spinner.fail('Fehler beim Kopieren!');
        throw streamErr;
      }
    } catch (err) {
      console.error(`\n❌ Fehler beim Umbenennen/Kopieren:`, err);
      errors++;
    }
  }

  if (errors === 0) {
    if (isMultiple) {
      deleteSession(mixdownDir);
    }
    console.log(
      '\n✅ Erfolgreich abgeschlossen! Alle Dateien wurden verarbeitet und kopiert.',
    );
  } else {
    console.log(`\n⚠️ Abgeschlossen mit ${errors} Fehlern. Bitte Logs prüfen.`);
  }

  await waitForKeyPressAndExit(errors === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await waitForKeyPressAndExit(1);
});
