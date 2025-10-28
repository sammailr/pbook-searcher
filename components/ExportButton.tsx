'use client';

import { useCSVStore } from '@/lib/store';
import { exportCSV, exportAllCSVs } from '@/lib/exportCSV';

interface ExportButtonProps {
  fileId?: string;
  variant?: 'primary' | 'secondary';
  className?: string;
}

export default function ExportButton({ fileId, variant = 'primary', className = '' }: ExportButtonProps) {
  const files = useCSVStore((state) => state.files);

  const handleExport = () => {
    if (fileId) {
      const file = files.find((f) => f.id === fileId);
      if (file) {
        exportCSV(file);
      }
    } else {
      if (files.length === 0) {
        alert('No files to export');
        return;
      }
      if (confirm(`Export all ${files.length} files?`)) {
        exportAllCSVs(files);
      }
    }
  };

  const baseClasses = 'flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-colors';
  const variantClasses = variant === 'primary'
    ? 'bg-green-600 text-white hover:bg-green-700'
    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50';

  return (
    <button
      onClick={handleExport}
      className={`${baseClasses} ${variantClasses} ${className}`}
      disabled={files.length === 0}
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
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        />
      </svg>
      {fileId ? 'Export File' : `Export All (${files.length})`}
    </button>
  );
}
