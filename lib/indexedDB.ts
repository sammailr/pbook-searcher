import { openDB, IDBPDatabase } from 'idb';
import { CSVFile } from './types';

const DB_NAME = 'csv-organizer';
const DB_VERSION = 1;
const STORE_NAME = 'csv-files';

interface CSVDatabase {
  'csv-files': {
    key: string;
    value: CSVFile;
  };
}

let dbInstance: IDBPDatabase<CSVDatabase> | null = null;

/**
 * Initialize and get the IndexedDB database instance
 */
async function getDB(): Promise<IDBPDatabase<CSVDatabase>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<CSVDatabase>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create the object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });

  return dbInstance;
}

/**
 * Save a single CSV file to IndexedDB
 */
export async function saveFile(file: CSVFile): Promise<void> {
  try {
    const db = await getDB();
    await db.put(STORE_NAME, file);
  } catch (error) {
    console.error('Error saving file to IndexedDB:', error);
    throw error;
  }
}

/**
 * Save all CSV files to IndexedDB (batch operation)
 */
export async function saveAllFiles(files: CSVFile[]): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');

    // Clear existing data
    await tx.store.clear();

    // Add all files
    await Promise.all(files.map(file => tx.store.put(file)));

    await tx.done;
  } catch (error) {
    console.error('Error saving all files to IndexedDB:', error);
    throw error;
  }
}

/**
 * Get all CSV files from IndexedDB
 */
export async function getAllFiles(): Promise<CSVFile[]> {
  try {
    const db = await getDB();
    const files = await db.getAll(STORE_NAME);

    // Convert Date strings back to Date objects
    return files.map(file => ({
      ...file,
      uploadedAt: new Date(file.uploadedAt),
    }));
  } catch (error) {
    console.error('Error loading files from IndexedDB:', error);
    return [];
  }
}

/**
 * Get a single CSV file by ID
 */
export async function getFile(id: string): Promise<CSVFile | undefined> {
  try {
    const db = await getDB();
    const file = await db.get(STORE_NAME, id);

    if (file) {
      return {
        ...file,
        uploadedAt: new Date(file.uploadedAt),
      };
    }

    return undefined;
  } catch (error) {
    console.error('Error getting file from IndexedDB:', error);
    return undefined;
  }
}

/**
 * Delete a single CSV file by ID
 */
export async function deleteFile(id: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete(STORE_NAME, id);
  } catch (error) {
    console.error('Error deleting file from IndexedDB:', error);
    throw error;
  }
}

/**
 * Clear all data from IndexedDB
 */
export async function clearAllFiles(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear(STORE_NAME);
  } catch (error) {
    console.error('Error clearing IndexedDB:', error);
    throw error;
  }
}

/**
 * Get the approximate storage size in bytes
 */
export async function getStorageSize(): Promise<number> {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return estimate.usage || 0;
    }
    return 0;
  } catch (error) {
    console.error('Error getting storage size:', error);
    return 0;
  }
}

/**
 * Check if IndexedDB is supported
 */
export function isIndexedDBSupported(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}
