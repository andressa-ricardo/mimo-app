import { randomUUID } from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator';

import { getDatabase } from '@/database/client';
import { imagesDirectory } from '@/services/storage/app-directories';

export const defaultImageOptimization = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.8,
} as const;

export type StoredImage = {
  id: string;
  relativePath: string;
  byteSize: number;
  mediaType: string;
};

/** An optimized image already placed in the private images directory. */
export type PreparedImage = StoredImage & {
  checksum: string;
  /** False when an identical image was already stored and is being reused. */
  isNew: boolean;
};

export function resolveStoredImage(relativePath: string): File {
  if (relativePath.includes('..') || relativePath.startsWith('/') || relativePath.includes('\\')) {
    throw new Error('Caminho de imagem inválido.');
  }

  return new File(imagesDirectory, relativePath);
}

function deleteIfExists(file: File): void {
  try {
    if (file.exists) file.delete();
  } catch (error: unknown) {
    console.warn('Não foi possível remover um arquivo temporário.', error);
  }
}

/**
 * Deletes a temporary copy made by a picker. Only files inside the app cache
 * are touched, so originals in the user's gallery are never removed.
 */
export function discardTemporaryImage(uri: string): void {
  if (!uri.startsWith(Paths.cache.uri)) return;
  deleteIfExists(new File(uri));
}

async function optimizeImage(sourceUri: string): Promise<File> {
  const { maxWidth, maxHeight, quality } = defaultImageOptimization;
  const released: { release: () => void }[] = [];

  try {
    const loader = ImageManipulator.manipulate(sourceUri);
    released.push(loader);
    let image: ImageRef = await loader.renderAsync();
    released.push(image);

    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    if (scale < 1) {
      const resizer = ImageManipulator.manipulate(image).resize({
        width: Math.round(image.width * scale),
        height: Math.round(image.height * scale),
      });
      released.push(resizer);
      image = await resizer.renderAsync();
      released.push(image);
    }

    const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: quality });
    return new File(result.uri);
  } finally {
    for (const object of released) object.release();
  }
}

/**
 * Resizes and compresses an image, then moves it into the private images
 * directory. Identical results (same SHA-256) reuse the stored file. The
 * caller must register the returned file in SQLite, or call
 * `discardPreparedImage` if saving fails.
 */
export async function prepareImageForStorage(sourceUri: string): Promise<PreparedImage> {
  const optimized = await optimizeImage(sourceUri);

  try {
    const checksum = await optimized.digest('SHA-256');
    const database = await getDatabase();
    const existing = await database.getFirstAsync<{
      id: string;
      relative_path: string;
      byte_size: number;
      media_type: string;
    }>(
      'SELECT id, relative_path, byte_size, media_type FROM stored_files WHERE checksum = ? LIMIT 1',
      checksum,
    );

    if (existing) {
      const storedFile = resolveStoredImage(existing.relative_path);
      if (storedFile.exists) deleteIfExists(optimized);
      else await optimized.move(storedFile);

      return {
        id: existing.id,
        relativePath: existing.relative_path,
        byteSize: existing.byte_size,
        mediaType: existing.media_type,
        checksum,
        isNew: false,
      };
    }

    const id = randomUUID();
    const relativePath = `${id}.jpg`;
    const byteSize = optimized.size;
    await optimized.move(resolveStoredImage(relativePath));

    return { id, relativePath, byteSize, mediaType: 'image/jpeg', checksum, isNew: true };
  } catch (error: unknown) {
    deleteIfExists(optimized);
    throw error;
  }
}

/** URI for a stored image, or null when the reference is missing or broken. */
export function storedImageUri(relativePath: string | null): string | null {
  if (!relativePath) return null;
  try {
    const file = resolveStoredImage(relativePath);
    return file.exists ? file.uri : null;
  } catch {
    return null;
  }
}

/** Removes files whose database rows were already deleted. */
export function deleteStoredImageFiles(relativePaths: string[]): void {
  for (const relativePath of relativePaths) {
    try {
      deleteIfExists(resolveStoredImage(relativePath));
    } catch (error: unknown) {
      console.warn('Não foi possível remover uma imagem órfã.', error);
    }
  }
}

/** Rolls back a prepared image whose database registration failed. */
export function discardPreparedImage(image: PreparedImage): void {
  if (image.isNew) deleteIfExists(resolveStoredImage(image.relativePath));
}
