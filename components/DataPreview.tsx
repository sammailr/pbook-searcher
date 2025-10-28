'use client';

import { useCSVStore } from '@/lib/store';

interface DataPreviewProps {
  fileId: string;
  maxRows?: number;
}

export default function DataPreview({ fileId, maxRows = 10 }: DataPreviewProps) {
  const files = useCSVStore((state) => state.files);
  const file = files.find((f) => f.id === fileId);

  if (!file) {
    return null;
  }

  const activeColumns = file.columns.filter((col) => !col.deleted);
  const previewData = file.data.slice(0, maxRows);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800">Data Preview</h3>
        <p className="text-sm text-gray-500 mt-1">
          Showing {Math.min(maxRows, file.data.length)} of {file.data.length} rows
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {activeColumns.map((column) => (
                <th
                  key={column.id}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                >
                  {column.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {previewData.length === 0 ? (
              <tr>
                <td
                  colSpan={activeColumns.length}
                  className="px-6 py-4 text-center text-gray-500"
                >
                  No data available
                </td>
              </tr>
            ) : (
              previewData.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50">
                  {activeColumns.map((column) => (
                    <td
                      key={column.id}
                      className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap"
                    >
                      {row[column.originalName] !== undefined
                        ? String(row[column.originalName])
                        : ''}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
