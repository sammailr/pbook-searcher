'use client';

import { useState, useEffect } from 'react';
import { useCSVStore } from '@/lib/store';
import {
  importCSVToSupabase,
  autoDetectMappings,
  ColumnMapping,
  ImportProgress,
  isFileImported,
} from '@/lib/supabaseImport';

export default function SupabaseImporter() {
  const files = useCSVStore((state) => state.files);

  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [importedFiles, setImportedFiles] = useState<Set<string>>(new Set());

  const selectedFile = files.find((f) => f.id === selectedFileId);

  // Check which files are already imported
  useEffect(() => {
    async function checkImports() {
      const imported = new Set<string>();
      for (const file of files) {
        const isImported = await isFileImported(file.name);
        if (isImported) {
          imported.add(file.name);
        }
      }
      setImportedFiles(imported);
    }
    checkImports();
  }, [files]);

  // Auto-detect mappings when file is selected
  useEffect(() => {
    if (selectedFile) {
      const detectedMappings = autoDetectMappings(selectedFile.headers);
      setMappings(detectedMappings);
    }
  }, [selectedFile]);

  const handleImport = async () => {
    if (!selectedFile || mappings.length === 0) {
      alert('Please select a file and ensure column mappings are configured');
      return;
    }

    setIsImporting(true);
    setProgress({
      total: selectedFile.data.length,
      imported: 0,
      failed: 0,
      errors: [],
    });

    try {
      const finalProgress = await importCSVToSupabase(
        selectedFile,
        mappings,
        (prog) => setProgress(prog)
      );

      // Refresh imported files list
      const isImported = await isFileImported(selectedFile.name);
      if (isImported) {
        setImportedFiles((prev) => new Set([...prev, selectedFile.name]));
      }

      alert(
        `Import complete!\n\n` +
        `✅ Imported: ${finalProgress.imported} rows\n` +
        `❌ Failed: ${finalProgress.failed} rows\n` +
        (finalProgress.errors.length > 0
          ? `\nFirst 5 errors:\n${finalProgress.errors.slice(0, 5).map(e => `Row ${e.row}: ${e.error}`).join('\n')}`
          : '')
      );

      setSelectedFileId(null);
      setMappings([]);
      setProgress(null);
    } catch (error) {
      console.error('Import error:', error);
      alert('Import failed. Check console for details.');
    } finally {
      setIsImporting(false);
    }
  };

  const addMapping = () => {
    if (!selectedFile) return;
    const unmappedColumn = selectedFile.headers.find(
      (h) => !mappings.some((m) => m.csvColumn === h)
    );
    if (unmappedColumn) {
      setMappings([...mappings, { csvColumn: unmappedColumn, dbColumn: 'company_name' }]);
    }
  };

  const removeMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  const updateMapping = (index: number, field: keyof ColumnMapping, value: string) => {
    const updated = [...mappings];
    updated[index] = { ...updated[index], [field]: value };
    setMappings(updated);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Import to Supabase</h2>
        <p className="text-sm text-gray-500 mt-1">
          Upload your CSV data to the cloud database for scraping and search
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* File Selection */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Select File to Import</h3>
          <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
            {files.map((file) => {
              const isImported = importedFiles.has(file.name);
              return (
                <button
                  key={file.id}
                  onClick={() => setSelectedFileId(file.id)}
                  disabled={isImporting}
                  className={`
                    p-4 text-left border-2 rounded-lg transition-all
                    ${selectedFileId === file.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                    }
                    ${isImporting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {file.data.length} rows · {file.columns.filter(c => !c.deleted).length} columns
                      </p>
                    </div>
                    {isImported && (
                      <span className="ml-3 px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                        ✓ Imported
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
            {files.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-8">
                No CSV files uploaded yet. Upload files in the File Manager tab.
              </p>
            )}
          </div>
        </div>

        {/* Column Mappings */}
        {selectedFile && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Column Mappings</h3>
              <button
                onClick={addMapping}
                disabled={isImporting}
                className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
              >
                + Add Mapping
              </button>
            </div>

            {mappings.length === 0 ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  No column mappings detected. Click "Add Mapping" to manually map columns.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {mappings.map((mapping, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">CSV Column</label>
                        <select
                          value={mapping.csvColumn}
                          onChange={(e) => updateMapping(index, 'csvColumn', e.target.value)}
                          disabled={isImporting}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        >
                          {selectedFile.headers.map((header) => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Database Column</label>
                        <select
                          value={mapping.dbColumn}
                          onChange={(e) => updateMapping(index, 'dbColumn', e.target.value)}
                          disabled={isImporting}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        >
                          <option value="pitchbook_id">pitchbook_id</option>
                          <option value="person_name">person_name</option>
                          <option value="person_first_name">person_first_name</option>
                          <option value="person_last_name">person_last_name</option>
                          <option value="person_profile_url">person_profile_url</option>
                          <option value="person_title">person_title</option>
                          <option value="company_name">company_name</option>
                          <option value="company_url">company_url</option>
                          <option value="email">email</option>
                          <option value="phone">phone</option>
                          <option value="linkedin_url">linkedin_url</option>
                          <option value="city">city</option>
                          <option value="state">state</option>
                          <option value="postal_code">postal_code</option>
                          <option value="country">country</option>
                        </select>
                      </div>
                    </div>
                    <button
                      onClick={() => removeMapping(index)}
                      disabled={isImporting}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                      title="Remove mapping"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Progress */}
        {progress && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-blue-900">
                Importing... {Math.round(((progress.imported + progress.failed) / progress.total) * 100)}%
              </span>
              <span className="text-xs text-blue-700">
                {progress.imported + progress.failed} / {progress.total}
              </span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-2 transition-all duration-300"
                style={{
                  width: `${((progress.imported + progress.failed) / progress.total) * 100}%`,
                }}
              />
            </div>
            <div className="flex gap-4 mt-2 text-xs">
              <span className="text-green-700">✓ {progress.imported} imported</span>
              {progress.failed > 0 && <span className="text-red-700">✗ {progress.failed} failed</span>}
            </div>
          </div>
        )}

        {/* Import Button */}
        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={handleImport}
            disabled={!selectedFile || mappings.length === 0 || isImporting}
            className="w-full px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isImporting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Importing...
              </span>
            ) : (
              `Import ${selectedFile?.data.length || 0} rows to Supabase`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
