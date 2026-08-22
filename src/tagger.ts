import * as fs from 'fs';
import NodeID3 from 'node-id3';
import { COVER_IMAGE_PATH, loadConfig } from './config.js';
import { Mp3File, ProcessingMetadata } from './types.js';
import { padTrackNumber } from './utils.js';

/**
 * Writes ID3 tags (including cover, year, track number) to the MP3 file.
 * Modifies the file in-place.
 */
export const writeId3Tags = (
  mp3File: Mp3File,
  metadata: ProcessingMetadata,
  eventDate: Date,
  eventName: string,
): boolean => {
  // Extract year from event date
  const yearStr = eventDate.getFullYear().toString();

  // Format track number, e.g. "1" or via custom input
  let trackNumTag = '1';
  if (metadata.trackNumber !== undefined) {
    trackNumTag = metadata.trackNumber.toString();
  }

  // Fallback if no preacher/artist was provided
  const artist = metadata.preacherOrGroup || 'Unbekannt';

  const tags: NodeID3.Tags = {
    title: buildId3Title(metadata),
    artist: artist,
    album: eventName,
    year: yearStr,
    trackNumber: trackNumTag,
  };

  // Attach cover image (cover.jpg) if it exists
  const activeCoverPath = fs.existsSync(COVER_IMAGE_PATH)
    ? COVER_IMAGE_PATH
    : loadConfig().coverImagePath;

  if (fs.existsSync(activeCoverPath)) {
    tags.image = {
      mime: 'image/jpeg',
      type: {
        id: 3,
        name: 'front cover',
      },
      description: 'Album Cover',
      imageBuffer: fs.readFileSync(activeCoverPath),
    };
  }

  // Write tags directly to the target file
  try {
    const result = NodeID3.write(tags, mp3File.fullPath);
    if (result === true) {
      return true;
    } else {
      console.error(
        `Fehler beim Schreiben der ID3-Tags in ${mp3File.filename}:`,
        result,
      );
      return false;
    }
  } catch (err) {
    console.error(
      `Fehler beim Schreiben der ID3-Tags in ${mp3File.filename}:`,
      err,
    );
    return false;
  }
};

/**
 * Generates the final filename based on the processed metadata.
 * Default format: "2026_02_13 JESUS HEILT DIE WUNDEN [Botschaft Max Mustermann].mp3"
 * With multiple tracks: "2026_02_13 - 07 - JESUS HEILT DIE WUNDEN [Botschaft Max Mustermann].mp3"
 */
export const buildFinalFilename = (
  metadata: ProcessingMetadata,
  eventDate: Date,
  hasMultipleTracks: boolean,
): string => {
  // Build YYYY_MM_DD date prefix
  const yyyy = eventDate.getFullYear();
  const mm = String(eventDate.getMonth() + 1).padStart(2, '0');
  const dd = String(eventDate.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}_${mm}_${dd}`;

  const hasArtist = metadata.preacherOrGroup.trim().length > 0;

  // Determine the categorization to be enclosed in brackets [Category Speaker]
  let brackets = '';
  // Decides whether to use a custom category or the standard selection
  const label =
    metadata.exportType === 'Sonstiges'
      ? metadata.customExportType
      : metadata.exportType;

  if (hasArtist && label) {
    brackets = `[${label} ${metadata.preacherOrGroup}]`;
  } else if (!hasArtist && label) {
    // If no speaker is provided, e.g. for songs: "[Lied]"
    brackets = `[${label}]`;
  }

  // Combine input and brackets for the main title
  // Example 1: "JESUS HEILT DIE WUNDEN [Botschaft Max Mustermann]"
  // Example 2: "MEIN JESUS MEIN RETTER [Lied]"
  let namePart = metadata.title;
  if (brackets) {
    namePart += ` ${brackets}`;
  }

  // Combine all parts into the final filename
  let result = '';
  if (hasMultipleTracks && metadata.trackNumber) {
    const trackPad = padTrackNumber(metadata.trackNumber);
    result = `${dateStr} - ${trackPad} - ${namePart}`;
  } else {
    // For single tracks (e.g. primary sermon without tracks)
    result = `${dateStr} ${namePart}`;
  }

  // Return filename with extension
  return `${result}.mp3`;
};

/**
 * Generates the string used for the actual ID3 Title tag.
 * Similar to naming logic, but typically excludes date or track number prefix.
 */
export const buildId3Title = (metadata: ProcessingMetadata): string => {
  const hasArtist = metadata.preacherOrGroup.trim().length > 0;

  const label =
    metadata.exportType === 'Sonstiges'
      ? metadata.customExportType
      : metadata.exportType;

  let brackets = '';
  if (hasArtist && label) {
    brackets = `[${label} ${metadata.preacherOrGroup}]`;
  } else if (!hasArtist && label) {
    brackets = `[${label}]`;
  }

  let finalTitle = metadata.title;
  if (brackets) {
    finalTitle += ` ${brackets}`;
  }

  return finalTitle;
};
