import { File } from 'expo-file-system';

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

export function resolveStoredImage(relativePath: string): File {
  if (relativePath.includes('..') || relativePath.startsWith('/') || relativePath.includes('\\')) {
    throw new Error('Caminho de imagem inválido.');
  }

  return new File(imagesDirectory, relativePath);
}

// Importação, redimensionamento, compressão, deduplicação e referências serão
// implementados junto do primeiro módulo que armazenar imagens.
