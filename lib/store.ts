import { create } from 'zustand';
import Papa from 'papaparse';
import { CSVFile, FileType, ColumnDefinition } from './types';
import * as db from './indexedDB';

interface CSVStore {
  files: CSVFile[];
  isLoading: boolean;

  // File operations
  addFile: (file: File) => Promise<void>;
  removeFile: (fileId: string) => Promise<void>;
  updateFileType: (fileId: string, type: FileType) => Promise<void>;

  // Column operations
  renameColumn: (fileId: string, columnId: string, newName: string) => Promise<void>;
  reorderColumns: (fileId: string, columnIds: string[]) => Promise<void>;
  deleteColumn: (fileId: string, columnId: string) => Promise<void>;
  restoreColumn: (fileId: string, columnId: string) => Promise<void>;

  // Data operations
  removeDuplicates: (fileId: string, columnIds: string[]) => Promise<{ removed: number; remaining: number }>;

  // Merge operations
  mergeFiles: (fileIds: string[], columnMappings: Record<string, string>) => Promise<CSVFile>;

  // Persistence
  saveToStorage: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  clearAll: () => Promise<void>;
}

export const useCSVStore = create<CSVStore>((set, get) => ({
  files: [],
  isLoading: false,

  addFile: async (file: File) => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        complete: (results) => {
          const headers = results.data[0] as string[];
          const dataRows = results.data.slice(1) as string[][];

          const columns: ColumnDefinition[] = headers.map((header, index) => ({
            id: `col-${Date.now()}-${index}`,
            name: header,
            originalName: header,
            deleted: false,
            order: index,
          }));

          const data = dataRows
            .filter(row => row.length === headers.length && row.some(cell => cell.trim() !== ''))
            .map(row => {
              const rowData: Record<string, string | number> = {};
              headers.forEach((header, index) => {
                rowData[header] = row[index] || '';
              });
              return rowData;
            });

          const csvFile: CSVFile = {
            id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
            name: file.name,
            type: 'untagged',
            columns,
            data,
            originalData: dataRows,
            headers,
            uploadedAt: new Date(),
          };

          set((state) => ({
            files: [...state.files, csvFile],
          }));

          get().saveToStorage();
          resolve();
        },
        error: (error) => {
          reject(error);
        },
      });
    });
  },

  removeFile: async (fileId: string) => {
    set((state) => ({
      files: state.files.filter((f) => f.id !== fileId),
    }));
    await get().saveToStorage();
  },

  updateFileType: async (fileId: string, type: FileType) => {
    set((state) => ({
      files: state.files.map((f) =>
        f.id === fileId ? { ...f, type } : f
      ),
    }));
    await get().saveToStorage();
  },

  renameColumn: async (fileId: string, columnId: string, newName: string) => {
    set((state) => ({
      files: state.files.map((f) =>
        f.id === fileId
          ? {
              ...f,
              columns: f.columns.map((col) =>
                col.id === columnId ? { ...col, name: newName } : col
              ),
            }
          : f
      ),
    }));
    await get().saveToStorage();
  },

  reorderColumns: async (fileId: string, columnIds: string[]) => {
    set((state) => ({
      files: state.files.map((f) => {
        if (f.id !== fileId) return f;

        const reorderedColumns = columnIds.map((id, index) => {
          const col = f.columns.find((c) => c.id === id);
          return col ? { ...col, order: index } : null;
        }).filter(Boolean) as ColumnDefinition[];

        return { ...f, columns: reorderedColumns };
      }),
    }));
    await get().saveToStorage();
  },

  deleteColumn: async (fileId: string, columnId: string) => {
    set((state) => ({
      files: state.files.map((f) =>
        f.id === fileId
          ? {
              ...f,
              columns: f.columns.map((col) =>
                col.id === columnId ? { ...col, deleted: true } : col
              ),
            }
          : f
      ),
    }));
    await get().saveToStorage();
  },

  restoreColumn: async (fileId: string, columnId: string) => {
    set((state) => ({
      files: state.files.map((f) =>
        f.id === fileId
          ? {
              ...f,
              columns: f.columns.map((col) =>
                col.id === columnId ? { ...col, deleted: false } : col
              ),
            }
          : f
      ),
    }));
    await get().saveToStorage();
  },

  removeDuplicates: async (fileId: string, columnIds: string[]) => {
    const file = get().files.find((f) => f.id === fileId);
    if (!file) {
      return { removed: 0, remaining: 0 };
    }

    // Get the columns to check for duplicates
    const columnsToCheck = file.columns.filter((col) => columnIds.includes(col.id));

    if (columnsToCheck.length === 0) {
      return { removed: 0, remaining: file.data.length };
    }

    const originalCount = file.data.length;
    const seen = new Set<string>();
    const uniqueData: Record<string, string | number>[] = [];

    // Filter out duplicates based on selected columns
    file.data.forEach((row) => {
      // Create a key from the values of selected columns
      const key = columnsToCheck
        .map((col) => String(row[col.originalName] || '').trim().toLowerCase())
        .join('|');

      if (!seen.has(key)) {
        seen.add(key);
        uniqueData.push(row);
      }
    });

    const removed = originalCount - uniqueData.length;

    // Update the file with deduplicated data
    set((state) => ({
      files: state.files.map((f) =>
        f.id === fileId
          ? { ...f, data: uniqueData }
          : f
      ),
    }));

    await get().saveToStorage();

    return { removed, remaining: uniqueData.length };
  },

  mergeFiles: async (fileIds: string[], columnMappings: Record<string, string>) => {
    const filesToMerge = get().files.filter((f) => fileIds.includes(f.id));

    // Determine unique column names from mappings
    const uniqueColumnNames = Array.from(new Set(Object.values(columnMappings)));

    // Create new columns for merged file
    const mergedColumns: ColumnDefinition[] = uniqueColumnNames.map((name, index) => ({
      id: `merged-col-${Date.now()}-${index}`,
      name,
      originalName: name,
      deleted: false,
      order: index,
    }));

    // Merge data from all files
    const mergedData: Record<string, string | number>[] = [];

    filesToMerge.forEach((file) => {
      file.data.forEach((row) => {
        const newRow: Record<string, string | number> = {};

        file.columns
          .filter((col) => !col.deleted)
          .forEach((col) => {
            const mappedName = columnMappings[`${file.id}-${col.id}`];
            // Use originalName to access the data since row data is keyed by original column names
            if (mappedName && row[col.originalName] !== undefined) {
              newRow[mappedName] = row[col.originalName];
            }
          });

        if (Object.keys(newRow).length > 0) {
          mergedData.push(newRow);
        }
      });
    });

    const mergedFile: CSVFile = {
      id: `merged-${Date.now()}`,
      name: `Merged-${filesToMerge.map(f => f.name.replace('.csv', '')).join('-')}.csv`,
      type: filesToMerge[0]?.type || 'untagged',
      columns: mergedColumns,
      data: mergedData,
      originalData: [],
      headers: uniqueColumnNames,
      uploadedAt: new Date(),
    };

    set((state) => ({
      files: [...state.files, mergedFile],
    }));

    await get().saveToStorage();
    return mergedFile;
  },

  saveToStorage: async () => {
    const state = get();
    try {
      await db.saveAllFiles(state.files);
    } catch (error) {
      console.error('Error saving to IndexedDB:', error);
    }
  },

  loadFromStorage: async () => {
    try {
      set({ isLoading: true });
      const files = await db.getAllFiles();
      set({ files, isLoading: false });
    } catch (error) {
      console.error('Error loading from IndexedDB:', error);
      set({ isLoading: false });
    }
  },

  clearAll: async () => {
    try {
      set({ files: [] });
      await db.clearAllFiles();
      // Also clear old localStorage for migration
      localStorage.removeItem('csv-organizer-metadata');
      localStorage.removeItem('csv-organizer-files');
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  },
}));
