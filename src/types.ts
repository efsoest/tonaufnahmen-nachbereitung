export interface EventFolder {
  folderName: string; // e.g. "2026_02_13 (Gottesdienst)"
  fullPath: string; // Absolute path to the folder
  date: Date; // For sorting purposes (newest first)
  displayName: string; // Folder name to show in the CLI
}

export type ExportType =
  'Botschaft' | 'Lied' | 'Moderation' | 'Begrüßung' | 'Abschluss' | 'Sonstiges';

export interface Mp3File {
  filename: string;
  fullPath: string;
}

export interface ProcessingMetadata {
  title: string;
  preacherOrGroup: string;
  exportType: ExportType;
  customExportType?: string;
  trackNumber?: number;
}

export interface SessionData {
  version: number;
  eventName: string;
  targetSubFolderName?: string;
  updatedAt: string;
  files: Record<string, ProcessingMetadata>;
}
