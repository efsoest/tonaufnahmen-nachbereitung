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
  // 1. Path to config.yml relative to the execution directory (e.g. where the shortcut was launched)
  let configPath = path.join(process.cwd(), 'config.yml');

  // 2. Fall back to the directory of the executable itself, if missing in CWD
  if (!fs.existsSync(configPath) && process.execPath) {
    const execConfigPath = path.join(path.dirname(process.execPath), 'config.yml');
    if (fs.existsSync(execConfigPath)) {
      configPath = execConfigPath;
    }
  }

  if (!fs.existsSync(configPath)) {
    console.log(
      `ℹ️ Keine config.yml gefunden. Verwende Standard-Werte.\n`,
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
