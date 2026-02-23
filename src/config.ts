import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

// Default values in case config.yml does not exist
const DEFAULT_CONFIG = {
  baseDir: process.cwd(),
  driveDir: 'C:\\Users\\Benutzername\\Google Drive\\Tonaufnahmen',
  mixdownFolderName: 'Mixdown',
  coverImagePath: 'cover.jpg',
};

interface AppConfig {
  baseDir: string;
  driveDir: string;
  mixdownFolderName: string;
  coverImagePath: string;
}

/**
 * Loads the configuration from config.yml.
 * Falls back to default values if the file is missing or invalid.
 */
function loadConfig(): AppConfig {
  // Path to config.yml relative to the execution directory (e.g. next to the .exe)
  const configPath = path.join(process.cwd(), 'config.yml');

  if (!fs.existsSync(configPath)) {
    console.log(
      `ℹ️ Keine config.yml gefunden unter ${configPath}. Verwende Standard-Werte.\n`,
    );
    return DEFAULT_CONFIG;
  }

  try {
    const fileContents = fs.readFileSync(configPath, 'utf8');
    const parsedYaml = yaml.parse(fileContents);

    // Merge with defaults in case some fields are missing in the yml
    const config: AppConfig = {
      baseDir: parsedYaml.baseDir || DEFAULT_CONFIG.baseDir,
      driveDir: parsedYaml.driveDir || DEFAULT_CONFIG.driveDir,
      mixdownFolderName:
        parsedYaml.mixdownFolderName || DEFAULT_CONFIG.mixdownFolderName,
      coverImagePath:
        parsedYaml.coverImagePath || DEFAULT_CONFIG.coverImagePath,
    };

    // If the config contains relative paths (like "./Tonaufnahmen"),
    // resolve them to absolute paths based on the current working directory
    if (config.baseDir.startsWith('./') || config.baseDir.startsWith('.\\')) {
      config.baseDir = path.resolve(process.cwd(), config.baseDir);
    }
    if (
      config.coverImagePath.startsWith('./') ||
      config.coverImagePath.startsWith('.\\') ||
      !path.isAbsolute(config.coverImagePath)
    ) {
      config.coverImagePath = path.resolve(
        process.cwd(),
        config.coverImagePath,
      );
    }

    return config;
  } catch (err) {
    console.error('❌ Fehler beim Parsen der config.yml:', err);
    console.log('Verwende stattdessen Standard-Werte.\n');
    return DEFAULT_CONFIG;
  }
}

// Load and export the final configuration used throughout the project
const finalConfig = loadConfig();

export const BASE_DIR = finalConfig.baseDir;
export const DRIVE_DIR = finalConfig.driveDir;
export const COVER_IMAGE_PATH = finalConfig.coverImagePath;
export const MIXDOWN_FOLDER_NAME = finalConfig.mixdownFolderName;
