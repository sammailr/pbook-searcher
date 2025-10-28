'use client';

import { useEffect, useState } from 'react';
import { useCSVStore } from '@/lib/store';
import FileUpload from '@/components/FileUpload';
import FileManager from '@/components/FileManager';
import FileEditor from '@/components/FileEditor';
import MergeInterface from '@/components/MergeInterface';
import SupabaseImporter from '@/components/SupabaseImporter';
import ExportButton from '@/components/ExportButton';

export default function Home() {
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'merge' | 'import'>('edit');
  const [mounted, setMounted] = useState(false);

  const files = useCSVStore((state) => state.files);
  const isLoading = useCSVStore((state) => state.isLoading);
  const loadFromStorage = useCSVStore((state) => state.loadFromStorage);
  const clearAll = useCSVStore((state) => state.clearAll);

  useEffect(() => {
    loadFromStorage();
    setMounted(true);
  }, [loadFromStorage]);

  if (!mounted) {
    return null; // Prevent hydration mismatch
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading your data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                CSV Organizer
              </h1>
              <p className="text-sm text-gray-500">
                Organize and merge your PitchBook data exports
              </p>
            </div>
            <div className="flex gap-3">
              {files.length > 0 && (
                <>
                  <button
                    onClick={() => {
                      if (confirm('Clear all files? This cannot be undone.')) {
                        clearAll();
                        setSelectedFileId(null);
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Clear All
                  </button>
                  <ExportButton />
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* File Upload */}
          <FileUpload />

          {files.length > 0 && (
            <>
              {/* Tab Navigation */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex border-b border-gray-200">
                  <button
                    onClick={() => setActiveTab('edit')}
                    className={`
                      flex-1 px-6 py-4 text-sm font-medium transition-colors
                      ${activeTab === 'edit'
                        ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }
                    `}
                  >
                    Edit Files
                  </button>
                  <button
                    onClick={() => setActiveTab('merge')}
                    className={`
                      flex-1 px-6 py-4 text-sm font-medium transition-colors
                      ${activeTab === 'merge'
                        ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }
                    `}
                  >
                    Merge Files
                  </button>
                  <button
                    onClick={() => setActiveTab('import')}
                    className={`
                      flex-1 px-6 py-4 text-sm font-medium transition-colors
                      ${activeTab === 'import'
                        ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }
                    `}
                  >
                    Import to Supabase
                  </button>
                </div>
              </div>

              {/* Edit Tab */}
              {activeTab === 'edit' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* File List */}
                  <div className="lg:col-span-1">
                    <FileManager
                      onSelectFile={setSelectedFileId}
                      selectedFileId={selectedFileId}
                    />
                  </div>

                  {/* File Editor with Preview */}
                  <div className="lg:col-span-2">
                    {selectedFileId ? (
                      <FileEditor fileId={selectedFileId} />
                    ) : (
                      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                        <svg
                          className="w-16 h-16 text-gray-300 mx-auto mb-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                          />
                        </svg>
                        <p className="text-gray-500 text-lg">
                          Select a file from the list to edit its columns
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Merge Tab */}
              {activeTab === 'merge' && (
                <div className="max-w-4xl mx-auto">
                  <MergeInterface />
                </div>
              )}

              {/* Import Tab */}
              {activeTab === 'import' && (
                <div className="max-w-4xl mx-auto">
                  <SupabaseImporter />
                </div>
              )}
            </>
          )}

          {/* Empty State */}
          {files.length === 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <svg
                className="w-20 h-20 text-gray-300 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No files uploaded yet
              </h3>
              <p className="text-gray-500">
                Upload your PitchBook CSV files above to get started
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
          <p>CSV Organizer - Organize and merge your data before importing to Supabase</p>
        </div>
      </footer>
    </div>
  );
}
