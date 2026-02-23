import { confirm, input, select } from '@inquirer/prompts';
import * as fs from 'fs';
import NodeID3 from 'node-id3';
import * as path from 'path';

// --- KONFIGURATION ---
// Hier kannst du die Pfade anpassen.
// Für den Anfang nehmen wir relative Pfade im aktuellen Ordner.
const EXPORT_DIR = path.join(process.cwd(), 'export');
const SYNC_DIR = path.join(process.cwd(), 'gdrive_sync');
const ARCHIVE_DIR = path.join(process.cwd(), 'archiv');

// Stelle sicher, dass die Ordner existieren
[EXPORT_DIR, SYNC_DIR, ARCHIVE_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

async function main() {
  console.log('🎙️  Willkommen zur Tonaufnahmen-Nachbereitung!\n');

  // 1. MP3 Dateien im Export-Ordner finden
  const files = fs.readdirSync(EXPORT_DIR).filter(f => f.toLowerCase().endsWith('.mp3'));

  if (files.length === 0) {
    console.log(`❌ Keine MP3-Dateien im Ordner gefunden: ${EXPORT_DIR}`);
    console.log('Bitte exportiere zuerst die Datei aus Cubase in diesen Ordner.');
    process.exit(0);
  }

  // Wenn es mehrere Dateien gibt, den Nutzer wählen lassen
  let fileNameToProcess = files[0];
  if (files.length > 1) {
    fileNameToProcess = await select({
      message: 'Welche Datei möchtest du bearbeiten?',
      choices: files.map(f => ({ name: f, value: f })),
    });
  } else {
    console.log(`Füge Metadaten hinzu zu: ${fileNameToProcess}\n`);
  }

  const inputFilePath = path.join(EXPORT_DIR, fileNameToProcess);

  // 2. Metadaten abfragen (Wizard)
  const titleInput = await input({
    message: 'Titel der Predigt/Botschaft:',
    validate: (val) => val.trim().length > 0 ? true : 'Bitte einen Titel eingeben!',
  });

  const preacher = await input({
    message: 'Name des Predigers (z.B. Max Mustermann):',
    validate: (val) => val.trim().length > 0 ? true : 'Bitte einen Namen eingeben!',
  });

  const eventType = await select({
    message: 'Veranstaltung:',
    choices: [
      { name: 'Gottesdienst', value: 'Gottesdienst' },
      { name: 'Jugendgottesdienst', value: 'Jugendgottesdienst' },
      { name: 'Bibelstunde', value: 'Bibelstunde' },
      { name: 'Sonstiges', value: 'Sonstiges' }
    ],
  });

  // Heute als Standarddatum vorschlagen (Format: YYYY-MM-DD)
  const todayDate = new Date().toISOString().split('T')[0];
  const dateInput = await input({
    message: 'Datum (Format: YYYY-MM-DD):',
    default: todayDate,
  });

  // 3. Daten formatieren
  // Vorgabe: "JESUS HEILT DIE WUNDEN [Botschaft Max Mustermann]"
  const formattedTitle = `${titleInput.toUpperCase()} [Botschaft ${preacher}]`;
  
  // Dateiname: 2026-02-23_Gottesdienst_Jesus_heilt_die_Wunden.mp3
  // Umlaute ersetzen und Leerzeichen zu Unterstrichen
  const safeFilenameTitle = titleInput
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_') // mehrfache Unterstriche zusammenfassen
    .replace(/^_|_$/g, ''); // am Rand entfernen

  const newFileName = `${dateInput}_${eventType}_${safeFilenameTitle}.mp3`;
  const outputFilePath = path.join(SYNC_DIR, newFileName);

  console.log('\n--- Zusammenfassung ---');
  console.log(`Titel (ID3):    ${formattedTitle}`);
  console.log(`Album (ID3):    ${eventType}`);
  console.log(`Künstler (ID3): ${preacher}`);
  console.log(`Neuer Dateiname: ${newFileName}`);
  console.log('-----------------------\n');

  const ready = await confirm({ message: 'Sieht das gut aus? Speichern und verschieben?' });
  if (!ready) {
    console.log('Abbruch durch Nutzer.');
    process.exit(0);
  }

  // 4. ID3 Tags anwenden
  const tags = {
    title: formattedTitle,
    artist: preacher,
    album: eventType,
    year: dateInput.substring(0, 4), // Nur das Jahr
    // Du kannst hier noch weitere Tags hinzufügen, z.B. Cover-Bild
  };

  // NodeID3.write überschreibt/erstellt die Tags in der Datei
  // Da wir das Original nicht sofort verändern wollen, kopieren wir es beim Schreiben:
  const success = NodeID3.write(tags, inputFilePath);
  
  if (!success) {
    console.error('❌ Fehler beim Schreiben der ID3-Tags!');
    process.exit(1);
  }

  // 5. Verschieben der fertig getaggten Datei
  // Wir kopieren sie in den Sync-Ordner, benennen sie um und verschieben das Original ins Archiv.
  try {
    // Schritt A: Kopiere die (nun getaggte) Datei in den Google Drive Ordner
    fs.copyFileSync(inputFilePath, outputFilePath);

    // Schritt B: Original ins Archiv verschieben (damit der Export-Ordner leer wird)
    const archiveFilePath = path.join(ARCHIVE_DIR, fileNameToProcess);
    fs.renameSync(inputFilePath, archiveFilePath);

    console.log(`\n✅ Erledigt!`);
    console.log(`Die Datei liegt nun im automatischen Sync-Ordner:`);
    console.log(`-> ${outputFilePath}`);
    console.log(`\nDas Original wurde hier ins Archiv verschoben:`);
    console.log(`-> ${archiveFilePath}`);

  } catch (error) {
    console.error('❌ Fehler beim Verschieben/Kopieren der Datei:', error);
  }
}

main().catch(console.error);