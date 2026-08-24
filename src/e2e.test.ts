import { beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import NodeID3 from 'node-id3';
import * as path from 'path';
import * as yaml from 'yaml';
import { buildFinalFilename, buildId3Title, writeId3Tags } from './tagger.js';
import { ProcessingMetadata } from './types.js';
import { getEventFolders, getMp3FilesInDir } from './utils.js';

describe('End-to-End Processing Test', () => {
  let baseDir: string;
  let driveDir: string;
  let mixdownFolderName: string;
  let coverImagePath: string;

  beforeEach(() => {
    // Re-generate clean test environment
    const testDir = path.resolve(process.cwd(), 'test-env');
    fs.rmSync(testDir, { recursive: true, force: true });

    const veranstaltungenDir = path.join(
      testDir,
      'Veranstaltungen',
      '2026_08_13 (Gottesdienst Test)',
      'Tonaufnahme',
      'MIXDOWN',
    );
    const driveFolder = path.join(testDir, 'GoogleDrive');
    const coverPath = path.join(testDir, 'cover.jpg');

    fs.mkdirSync(veranstaltungenDir, { recursive: true });
    fs.mkdirSync(driveFolder, { recursive: true });

    const dummyMp3 = Buffer.from([
      0xff, 0xfb, 0x90, 0x64, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    fs.writeFileSync(
      path.join(veranstaltungenDir, '01_Predigt_Test.mp3'),
      dummyMp3,
    );
    fs.writeFileSync(
      path.join(veranstaltungenDir, '02_Lobpreis_Test.mp3'),
      dummyMp3,
    );

    const dummyJpeg = Buffer.from(
      'FFD8FFE000104A46494600010101006000600000FFDB004300080606070605080707070909080A0C140D0C0B0B0C1912130F141D1A1F1E1D1A1C1C20242E2720222B221C1C2837292C30323434341F27393D38323C2E333432FFC0000B080001000101011100FFDA0008010100003F00D2CF007FFFD9',
      'hex',
    );
    fs.writeFileSync(coverPath, dummyJpeg);

    const configYaml = `baseDir: "./test-env/Veranstaltungen"\ndriveDir: "./test-env/GoogleDrive"\nmixdownFolderName: "Tonaufnahme/MIXDOWN"\ncoverImagePath: "./test-env/cover.jpg"\n`;
    fs.writeFileSync('config.test.yml', configYaml);
    process.env.CONFIG_PATH = 'config.test.yml';

    baseDir = path.join(testDir, 'Veranstaltungen');
    driveDir = driveFolder;
    mixdownFolderName = 'Tonaufnahme/MIXDOWN';
    coverImagePath = coverPath;
  });

  it('should find test event folder and test mp3 files', () => {
    expect(fs.existsSync(baseDir)).toBe(true);

    const folders = getEventFolders(baseDir);
    expect(folders.length).toBeGreaterThan(0);

    const event = folders[0];
    expect(event.folderName).toContain('2026_08_13');

    const mixdownDir = path.join(event.fullPath, mixdownFolderName);
    const mp3Files = getMp3FilesInDir(mixdownDir);
    expect(mp3Files.length).toBe(2);
    expect(mp3Files[0].filename).toBe('01_Predigt_Test.mp3');
  });

  it('should tag, rename and copy fake MP3 to local target drive folder with cover', async () => {
    const folders = getEventFolders(baseDir);
    const event = folders[0];
    const mixdownDir = path.join(event.fullPath, mixdownFolderName);
    const mp3Files = getMp3FilesInDir(mixdownDir);

    const mp3 = mp3Files[0];

    const metadata: ProcessingMetadata = {
      title: 'Gott ist gut',
      exportType: 'Botschaft',
      customExportType: '',
      preacherOrGroup: 'Pastor Johannes',
      trackNumber: 1,
    };

    const finalFilename = buildFinalFilename(metadata, event.date, true);
    const finalTitle = buildId3Title(metadata);

    expect(finalFilename).toBe(
      '2026_08_13 - 01 - Gott ist gut [Botschaft Pastor Johannes].mp3',
    );
    expect(finalTitle).toBe('Gott ist gut [Botschaft Pastor Johannes]');

    // Write ID3 tags to the file
    const tagSuccess = writeId3Tags(
      mp3,
      metadata,
      event.date,
      event.displayName,
    );
    expect(tagSuccess).toBe(true);

    // Rename in mixdown folder
    const newLocalPath = path.join(mixdownDir, finalFilename);
    fs.renameSync(mp3.fullPath, newLocalPath);
    expect(fs.existsSync(newLocalPath)).toBe(true);

    // Copy to target drive folder
    const targetDriveSubFolder = path.join(driveDir, 'Gottesdienst_Test');
    fs.mkdirSync(targetDriveSubFolder, { recursive: true });

    const driveFilePath = path.join(targetDriveSubFolder, finalFilename);
    fs.copyFileSync(newLocalPath, driveFilePath);
    expect(fs.existsSync(driveFilePath)).toBe(true);

    // Verify written ID3 tags from target file
    const tags = NodeID3.read(driveFilePath);
    expect(tags.title).toBe('Gott ist gut [Botschaft Pastor Johannes]');
    expect(tags.artist).toBe('Pastor Johannes');
    expect(tags.album).toBe('2026_08_13 (Gottesdienst Test)');
    expect(tags.year).toBe('2026');
    expect(tags.trackNumber).toBe('1');
    expect(tags.image).toBeDefined();
  });

  it('should support saving session mid-way, resuming, and deleting session on completion', () => {
    const folders = getEventFolders(baseDir);
    const event = folders[0];
    const mixdownDir = path.join(event.fullPath, mixdownFolderName);
    const mp3Files = getMp3FilesInDir(mixdownDir);

    const {
      createInitialSession,
      deleteSession,
      getSessionFilePath,
      loadSession,
      updateFileInSession,
    } = require('./session.js');

    // 1. Start session and save track 1
    const session = createInitialSession(
      event.displayName,
      '2026_08_13_Gottesdienst_Test',
    );
    const track1Metadata: ProcessingMetadata = {
      title: 'Predigt Teil 1',
      exportType: 'Botschaft',
      preacherOrGroup: 'Pastor Johannes',
      trackNumber: 1,
    };
    updateFileInSession(
      mixdownDir,
      session,
      mp3Files[0].filename,
      track1Metadata,
    );

    // Verify session file exists on disk
    const sessionFilePath = getSessionFilePath(mixdownDir);
    expect(fs.existsSync(sessionFilePath)).toBe(true);

    // 2. Simulate resuming session in a new process run
    const loadedSession = loadSession(mixdownDir);
    expect(loadedSession).not.toBeNull();
    expect(loadedSession?.targetSubFolderName).toBe(
      '2026_08_13_Gottesdienst_Test',
    );
    expect(loadedSession?.files[mp3Files[0].filename]).toEqual(track1Metadata);

    // Track 2 entered
    const track2Metadata: ProcessingMetadata = {
      title: 'Lobpreis Gemeinschaft',
      exportType: 'Lied',
      preacherOrGroup: 'Lobpreisteam',
      trackNumber: 2,
    };
    updateFileInSession(
      mixdownDir,
      loadedSession!,
      mp3Files[1].filename,
      track2Metadata,
    );

    // 3. Process all files
    const allFilesMetadata = [
      { mp3: mp3Files[0], meta: track1Metadata },
      { mp3: mp3Files[1], meta: track2Metadata },
    ];

    const targetDriveSubFolder = path.join(
      driveDir,
      loadedSession!.targetSubFolderName!,
    );
    fs.mkdirSync(targetDriveSubFolder, { recursive: true });

    for (const item of allFilesMetadata) {
      const finalFilename = buildFinalFilename(item.meta, event.date, true);
      const tagSuccess = writeId3Tags(
        item.mp3,
        item.meta,
        event.date,
        event.displayName,
      );
      expect(tagSuccess).toBe(true);

      const newLocalPath = path.join(mixdownDir, finalFilename);
      fs.renameSync(item.mp3.fullPath, newLocalPath);

      const driveFilePath = path.join(targetDriveSubFolder, finalFilename);
      fs.copyFileSync(newLocalPath, driveFilePath);
      expect(fs.existsSync(driveFilePath)).toBe(true);
    }

    // 4. Session cleanup on successful completion
    deleteSession(mixdownDir);
    expect(fs.existsSync(sessionFilePath)).toBe(false);
  });
});
