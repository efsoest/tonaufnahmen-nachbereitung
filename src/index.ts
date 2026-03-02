import { select } from '@inquirer/prompts';
import * as fs from 'fs';
import ora from 'ora';
import * as path from 'path';
import { BASE_DIR, DRIVE_DIR, MIXDOWN_FOLDER_NAME } from './config.js';
import { buildFinalFilename, buildId3Title, writeId3Tags } from './tagger.js';
import { getEventFolders, getMp3FilesInDir, waitForKeyPressAndExit } from './utils.js';
import { promptEventSelection, promptMp3Metadata } from './wizard.js';

async function main() {
  console.clear();
  console.log('🎙️  Willkommen zur Tonaufnahmen-Nachbereitung!\n');

  // 1. Find event folders
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

  // 2. Select event folder via CLI
  const selectedEvent = await promptEventSelection(folders);
  if (!selectedEvent) {
    console.log('Abbruch.');
    await waitForKeyPressAndExit(0);
    return;
  }

  console.log(`\n📂 Ausgewählt: ${selectedEvent.displayName}`);

  // 3. Search for MP3 files in the "Mixdown" subfolder
  const mixdownDir = path.join(selectedEvent.fullPath, MIXDOWN_FOLDER_NAME);
  const mp3Files = getMp3FilesInDir(mixdownDir);

  if (mp3Files.length === 0) {
    console.log(
      `\n❌ Keine MP3-Dateien im Ordner "${MIXDOWN_FOLDER_NAME}" gefunden.`,
    );
    console.log(`Bitte exportiere die Tonaufnahme aus deiner DAW (z.B. Cubase) als MP3 in den Ordner:`);
    console.log(`-> ${mixdownDir}`);
    console.log(`Starte das Programm danach erneut.`);
    await waitForKeyPressAndExit(1);
    return;
  }

  const isMultiple = mp3Files.length > 1;
  console.log(`Gefunden: ${mp3Files.length} MP3-Datei(en).`);

  let isReady = false;
  let targetDriveFolder = '';
  let processedFiles: {
    originalMp3: any;
    metadata: any;
    finalFilename: string;
    finalTitle: string;
  }[] = [];

  while (!isReady) {
    // Collect metadata and paths for all files for the final summary
    processedFiles = [];

    for (let i = 0; i < mp3Files.length; i++) {
      const mp3 = mp3Files[i];
      const defaultTrackNum = i + 1; // 1-basiert

      console.log(
        `\n🎵 Bearbeite Datei ${defaultTrackNum} von ${mp3Files.length}: ${mp3.filename}`,
      );

      // Propose filename without .mp3 as the default title
      const defaultTitle = path.basename(mp3.filename, '.mp3');

      const metadata = await promptMp3Metadata(
        defaultTitle,
        isMultiple,
        defaultTrackNum,
      );
      const finalFilename = buildFinalFilename(
        metadata,
        selectedEvent.date,
        isMultiple,
      );
      const finalTitle = buildId3Title(metadata);

      processedFiles.push({
        originalMp3: mp3,
        metadata,
        finalFilename,
        finalTitle,
      });
    }

    // 4. Summary & Confirmation
    console.clear();
    console.log('📋 --- ZUSAMMENFASSUNG ---\n');

    // Show planned target directory (based on the first file as the main folder)
    // Requirement: Subfolder in Drive should have the same name as the (first) file (without .mp3)
    const mainFolderName = path.basename(processedFiles[0].finalFilename, '.mp3');
    targetDriveFolder = path.join(DRIVE_DIR, mainFolderName);

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
      console.log('\n--- Neustart der Eingaben ---');
      continue;
    } else if (action === 'save') {
      isReady = true;
    }
  }

  // 5. Process files (In-place ID3 tags and rename/copy)
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

    // 1. Rename the file in-place in the original folder (Mixdown)
    const newLocalPath = path.join(mixdownDir, item.finalFilename);
    try {
      // If the new name is different from the old one
      if (item.originalMp3.fullPath !== newLocalPath) {
        fs.renameSync(item.originalMp3.fullPath, newLocalPath);
      }

      // 2. Copy the file (Asynchronous with loading spinner)
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
