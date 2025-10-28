'use client';

import { useCallback, useState } from 'react';
import { useCSVStore } from '@/lib/store';

export default function FileUpload() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const addFile = useCSVStore((state) => state.addFile);

  const handleFiles = useCallback(
    async (files: FileList) => {
      setUploading(true);
      const csvFiles = Array.from(files).filter(
        (file) => file.name.endsWith('.csv') || file.type === 'text/csv'
      );

      for (const file of csvFiles) {
        try {
          await addFile(file);
        } catch (error) {
          console.error('Error uploading file:', error);
          alert(`Error uploading ${file.name}`);
        }
      }
      setUploading(false);
    },
    [addFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFiles(files);
      }
    },
    [handleFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFiles(files);
      }
    },
    [handleFiles]
  );

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center
          transition-colors duration-200 cursor-pointer
          ${isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 bg-white'
          }
        `}
      >
        <input
          type="file"
          id="file-upload"
          multiple
          accept=".csv"
          onChange={handleFileInput}
          className="hidden"
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <div className="flex flex-col items-center">
            <svg
              className="w-16 h-16 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-lg font-semibold text-gray-700 mb-2">
              {uploading ? 'Uploading...' : 'Drop CSV files here or click to browse'}
            </p>
            <p className="text-sm text-gray-500">
              Upload multiple CSV files from PitchBook
            </p>
          </div>
        </label>
      </div>
    </div>
  );
}
