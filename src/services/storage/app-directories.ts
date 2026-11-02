import { Directory, Paths } from 'expo-file-system';

export const appFilesDirectory = new Directory(Paths.document, 'mimo');
export const imagesDirectory = new Directory(appFilesDirectory, 'images');
export const backupsDirectory = new Directory(appFilesDirectory, 'backups');
export const imageWorkDirectory = new Directory(Paths.cache, 'mimo', 'images');

export function initializeAppDirectories(): void {
  for (const directory of [appFilesDirectory, imagesDirectory, backupsDirectory, imageWorkDirectory]) {
    directory.create({ idempotent: true, intermediates: true });
  }
}
