'use client';

import { useState } from 'react';
import { useCSVStore } from '@/lib/store';
import { FileType } from '@/lib/types';

interface FileManagerProps {
  onSelectFile: (fileId: string) => void;
  selectedFileId: string | null;
}

export default function FileManager({ onSelectFile, selectedFileId }: FileManagerProps) {
  const files = useCSVStore((state) => state.files);
  const removeFile = useCSVStore((state) => state.removeFile);
  const updateFileType = useCSVStore((state) => state.updateFileType);

  const handleTypeChange = (fileId: string, type: FileType) => {
    updateFileType(fileId, type);
  };

  const getTypeColor = (type: FileType) => {
    switch (type) {
      case 'company':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'people':
        return 'bg-green-100 text-green-700 border-green-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getTypeLabel = (type: FileType) => {
    switch (type) {
      case 'company':
        return 'Company';
      case 'people':
        return 'People';
      default:
        return 'Untagged';
    }
  };

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="w-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">
          Uploaded Files ({files.length})
        </h2>
      </div>

      <div className="divide-y divide-gray-200">
        {files.map((file) => (
          <div
            key={file.id}
            className={`
              p-4 hover:bg-gray-50 transition-colors cursor-pointer
              ${selectedFileId === file.id ? 'bg-blue-50' : ''}
            `}
            onClick={() => onSelectFile(file.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <svg
                    className="w-5 h-5 text-gray-400 flex-shrink-0"
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
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {file.data.length} rows · {file.columns.filter(c => !c.deleted).length} columns
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4">
                <select
                  value={file.type}
                  onChange={(e) => {
                    e.stopPropagation();
                    handleTypeChange(file.id, e.target.value as FileType);
                  }}
                  className={`
                    px-3 py-1 text-xs font-medium rounded-full border
                    ${getTypeColor(file.type)}
                    focus:outline-none focus:ring-2 focus:ring-blue-500
                  `}
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="untagged">Untagged</option>
                  <option value="company">Company</option>
                  <option value="people">People</option>
                </select>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete ${file.name}?`)) {
                      removeFile(file.id);
                    }
                  }}
                  className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                  title="Delete file"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
