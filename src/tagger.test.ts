import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import NodeID3 from 'node-id3';
import * as os from 'os';
import * as path from 'path';
import { buildFinalFilename, buildId3Title, writeId3Tags } from './tagger.js';
import { Mp3File, ProcessingMetadata } from './types.js';

describe('Tagger Unit & Integration Tests', () => {
  let tempDir: string;
  let sampleMp3Path: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tagger-test-'));
    sampleMp3Path = path.join(tempDir, 'test_sample.mp3');

    // Minimal dummy MP3 frame buffer
    const dummyMp3Buffer = Buffer.from([
      0xff, 0xfb, 0x90, 0x64, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    fs.writeFileSync(sampleMp3Path, dummyMp3Buffer);
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('buildFinalFilename', () => {
    const eventDate = new Date('2026-08-13T00:00:00Z');

    it('should build correct filename for single track with preacher', () => {
      const metadata: ProcessingMetadata = {
        title: 'JESUS HEILT DIE WUNDEN',
        exportType: 'Botschaft',
        customExportType: '',
        preacherOrGroup: 'Max Mustermann',
        trackNumber: 1,
      };

      const filename = buildFinalFilename(metadata, eventDate, false);
      expect(filename).toBe(
        '2026_08_13 JESUS HEILT DIE WUNDEN [Botschaft Max Mustermann].mp3',
      );
    });

    it('should build correct filename for multiple tracks with track padding', () => {
      const metadata: ProcessingMetadata = {
        title: 'GROSS IST DER HERR',
        exportType: 'Lied',
        customExportType: '',
        preacherOrGroup: '',
        trackNumber: 2,
      };

      const filename = buildFinalFilename(metadata, eventDate, true);
      expect(filename).toBe('2026_08_13 - 02 - GROSS IST DER HERR [Lied].mp3');
    });
  });

  describe('buildId3Title', () => {
    it('should build correct ID3 title string', () => {
      const metadata: ProcessingMetadata = {
        title: 'EINLEITUNG UND BEGRÜSSUNG',
        exportType: 'Moderation',
        customExportType: '',
        preacherOrGroup: 'Erika Musterfrau',
        trackNumber: 1,
      };

      const title = buildId3Title(metadata);
      expect(title).toBe(
        'EINLEITUNG UND BEGRÜSSUNG [Moderation Erika Musterfrau]',
      );
    });
  });

  describe('writeId3Tags', () => {
    it('should write ID3 tags to MP3 file and read them back correctly', () => {
      const mp3File: Mp3File = {
        filename: 'test_sample.mp3',
        fullPath: sampleMp3Path,
      };

      const metadata: ProcessingMetadata = {
        title: 'TEST TITEL',
        exportType: 'Botschaft',
        customExportType: '',
        preacherOrGroup: 'Test Prediger',
        trackNumber: 1,
      };

      const eventDate = new Date('2026-08-13');
      const eventName = '2026_08_13 (Gottesdienst Test)';

      const success = writeId3Tags(mp3File, metadata, eventDate, eventName);
      expect(success).toBe(true);

      // Read tags back with NodeID3
      const readTags = NodeID3.read(sampleMp3Path);
      expect(readTags.title).toBe('TEST TITEL [Botschaft Test Prediger]');
      expect(readTags.artist).toBe('Test Prediger');
      expect(readTags.album).toBe(eventName);
      expect(readTags.year).toBe('2026');
      expect(readTags.trackNumber).toBe('1');
    });
  });
});
