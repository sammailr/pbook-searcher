'use client';

import { useState, useMemo } from 'react';
import { useCSVStore } from '@/lib/store';
import { FileType } from '@/lib/types';

export default function MergeInterface() {
  const files = useCSVStore((state) => state.files);
  const mergeFiles = useCSVStore((state) => state.mergeFiles);

  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});
  const [filterType, setFilterType] = useState<FileType | 'all'>('all');

  const filteredFiles = useMemo(() => {
    if (filterType === 'all') return files;
    return files.filter((f) => f.type === filterType);
  }, [files, filterType]);

  const selectedFiles = useMemo(() => {
    return files.filter((f) => selectedFileIds.includes(f.id));
  }, [files, selectedFileIds]);

  const allColumns = useMemo(() => {
    const columns: Array<{ fileId: string; fileName: string; columnId: string; columnName: string }> = [];
    selectedFiles.forEach((file) => {
      file.columns
        .filter((col) => !col.deleted)
        .forEach((col) => {
          columns.push({
            fileId: file.id,
            fileName: file.name,
            columnId: col.id,
            columnName: col.name,
          });
        });
    });
    return columns;
  }, [selectedFiles]);

  const uniqueMappedNames = useMemo(() => {
    return Array.from(new Set(Object.values(columnMappings)));
  }, [columnMappings]);

  const toggleFileSelection = (fileId: string) => {
    setSelectedFileIds((prev) =>
      prev.includes(fileId)
        ? prev.filter((id) => id !== fileId)
        : [...prev, fileId]
    );
  };

  const handleMerge = async () => {
    if (selectedFileIds.length < 2) {
      alert('Please select at least 2 files to merge');
      return;
    }

    if (Object.keys(columnMappings).length === 0) {
      alert('Please map at least one column');
      return;
    }

    try {
      const merged = await mergeFiles(selectedFileIds, columnMappings);
      alert(`Successfully merged into ${merged.name}`);
      setSelectedFileIds([]);
      setColumnMappings({});
    } catch (error) {
      console.error('Error merging files:', error);
      alert('Error merging files. Please try again.');
    }
  };

  const autoMapSimilarColumns = () => {
    const mappings: Record<string, string> = {};
    const columnsByName = new Map<string, Array<{ fileId: string; columnId: string }>>();

    // Group columns by name
    allColumns.forEach(({ fileId, columnId, columnName }) => {
      const normalized = columnName.toLowerCase().trim();
      if (!columnsByName.has(normalized)) {
        columnsByName.set(normalized, []);
      }
      columnsByName.get(normalized)?.push({ fileId, columnId });
    });

    // Create mappings for columns that appear in multiple files
    columnsByName.forEach((cols, name) => {
      if (cols.length > 1) {
        const targetName = allColumns.find(
          (c) => c.fileId === cols[0].fileId && c.columnId === cols[0].columnId
        )?.columnName || name;

        cols.forEach(({ fileId, columnId }) => {
          mappings[`${fileId}-${columnId}`] = targetName;
        });
      }
    });

    setColumnMappings(mappings);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Merge Files</h2>
        <p className="text-sm text-gray-500 mt-1">
          Select files to merge and map their columns
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Filter and File Selection */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Select Files</h3>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as FileType | 'all')}
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Files</option>
              <option value="company">Company Lists</option>
              <option value="people">People Lists</option>
              <option value="untagged">Untagged</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
            {filteredFiles.map((file) => (
              <label
                key={file.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedFileIds.includes(file.id)}
                  onChange={() => toggleFileSelection(file.id)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {file.data.length} rows · {file.columns.filter(c => !c.deleted).length} columns
                  </p>
                </div>
              </label>
            ))}
          </div>

          <p className="text-sm text-gray-600 mt-2">
            Selected: {selectedFileIds.length} file{selectedFileIds.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Column Mapping */}
        {selectedFileIds.length >= 2 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Column Mapping</h3>
              <button
                onClick={autoMapSimilarColumns}
                className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
              >
                Auto-map Similar Columns
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {allColumns.map(({ fileId, fileName, columnId, columnName }) => {
                const key = `${fileId}-${columnId}`;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 truncate">{fileName}</p>
                      <p className="text-sm font-medium text-gray-900">{columnName}</p>
                    </div>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <input
                      type="text"
                      value={columnMappings[key] || ''}
                      onChange={(e) =>
                        setColumnMappings((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      placeholder="Target column name"
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                );
              })}
            </div>

            {uniqueMappedNames.length > 0 && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-semibold text-blue-800 mb-2">
                  Merged columns ({uniqueMappedNames.length}):
                </p>
                <div className="flex flex-wrap gap-2">
                  {uniqueMappedNames.map((name) => (
                    <span
                      key={name}
                      className="px-2 py-1 text-xs font-medium bg-white text-blue-700 rounded border border-blue-300"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Merge Button */}
        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={handleMerge}
            disabled={selectedFileIds.length < 2 || Object.keys(columnMappings).length === 0}
            className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Merge {selectedFileIds.length} Files
          </button>
        </div>
      </div>
    </div>
  );
}
