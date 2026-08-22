import * as fs from 'fs';
import * as path from 'path';

console.log('🛠️ Erstelle lokale Test-Umgebung in ./test-env/ ...');

const TEST_DIR = path.resolve(process.cwd(), 'test-env');
const VERANSTALTUNGEN_DIR = path.join(
  TEST_DIR,
  'Veranstaltungen',
  '2026_08_13 (Gottesdienst Test)',
  'Tonaufnahme',
  'MIXDOWN',
);
const DRIVE_DIR = path.join(TEST_DIR, 'GoogleDrive');
const COVER_PATH = path.join(TEST_DIR, 'cover.jpg');
const CONFIG_TEST_PATH = path.resolve(process.cwd(), 'config.test.yml');

// 1. Create directories
fs.mkdirSync(VERANSTALTUNGEN_DIR, { recursive: true });
fs.mkdirSync(DRIVE_DIR, { recursive: true });

// 2. Minimal valid MP3 audio frame buffer
const DUMMY_MP3_BUFFER = Buffer.from([
  0xff, 0xfb, 0x90, 0x64, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00,
]);

// Write fake MP3 files
const mp3File1 = path.join(VERANSTALTUNGEN_DIR, '01_Predigt_Test.mp3');
const mp3File2 = path.join(VERANSTALTUNGEN_DIR, '02_Lobpreis_Test.mp3');
fs.writeFileSync(mp3File1, DUMMY_MP3_BUFFER);
fs.writeFileSync(mp3File2, DUMMY_MP3_BUFFER);

console.log(`✅ Fake MP3-Dateien erstellt:`);
console.log(`   -> ${mp3File1}`);
console.log(`   -> ${mp3File2}`);

// 3. Minimal valid 1x1 JPEG buffer
const DUMMY_JPEG_BUFFER = Buffer.from(
  'FFD8FFE000104A46494600010101006000600000FFDB004300080606070605080707070909080A0C140D0C0B0B0C1912130F141D1A1F1E1D1A1C1C20242E2720222B221C1C2837292C30323434341F27393D38323C2E333432FFC0000B080001000101011100FFDA0008010100003F00D2CF007FFFD9',
  'hex',
);
fs.writeFileSync(COVER_PATH, DUMMY_JPEG_BUFFER);
console.log(`✅ Fake Cover-Bild erstellt: ${COVER_PATH}`);

// 4. Create config.test.yml
const CONFIG_YAML_CONTENT = `# =====================================================================
# TEST-KONFIGURATION FÜR LOKALES TESTING (AUTOMATISCH GENERIERT)
# =====================================================================

baseDir: "./test-env/Veranstaltungen"
driveDir: "./test-env/GoogleDrive"
mixdownFolderName: "Tonaufnahme/MIXDOWN"
coverImagePath: "./test-env/cover.jpg"
`;

fs.writeFileSync(CONFIG_TEST_PATH, CONFIG_YAML_CONTENT, 'utf8');
console.log(`✅ config.test.yml erstellt.`);

console.log(`\n🎉 Test-Umgebung ist bereit!`);
console.log(`▶️ Starte das Skript im Testmodus mit:\n   bun run test:dev\n`);
