'use client';

import { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useCSVStore } from '@/lib/store';
import { exportCSV } from '@/lib/exportCSV';

interface FileEditorProps {
  fileId: string;
}

export default function FileEditor({ fileId }: FileEditorProps) {
  const files = useCSVStore((state) => state.files);
  const renameColumn = useCSVStore((state) => state.renameColumn);
  const reorderColumns = useCSVStore((state) => state.reorderColumns);
  const deleteColumn = useCSVStore((state) => state.deleteColumn);
  const restoreColumn = useCSVStore((state) => state.restoreColumn);
  const removeDuplicates = useCSVStore((state) => state.removeDuplicates);

  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [maxRows] = useState(15);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [selectedColumnsForDupe, setSelectedColumnsForDupe] = useState<string[]>([]);

  const file = files.find((f) => f.id === fileId);

  if (!file) {
    return (
      <div className="p-8 text-center text-gray-500">
        Select a file to edit its columns
      </div>
    );
  }

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(activeColumns);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    reorderColumns(fileId, items.map((col) => col.id));
  };

  const startEditing = (columnId: string, currentName: string, e: React.MouseEvent) => {
    // Don't start editing if clicking on drag handle or delete button
    if ((e.target as HTMLElement).closest('.drag-handle') ||
        (e.target as HTMLElement).closest('.delete-button')) {
      return;
    }
    setEditingColumnId(columnId);
    setEditValue(currentName);
  };

  const saveEdit = (columnId: string) => {
    if (editValue.trim() && editValue !== file.columns.find(c => c.id === columnId)?.name) {
      renameColumn(fileId, columnId, editValue.trim());
    }
    setEditingColumnId(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingColumnId(null);
    setEditValue('');
  };

  const handleRemoveDuplicates = async () => {
    if (selectedColumnsForDupe.length === 0) {
      alert('Please select at least one column to check for duplicates');
      return;
    }

    const result = await removeDuplicates(fileId, selectedColumnsForDupe);

    if (result.removed > 0) {
      alert(`Removed ${result.removed} duplicate row${result.removed !== 1 ? 's' : ''}.\n${result.remaining} unique row${result.remaining !== 1 ? 's' : ''} remaining.`);
    } else {
      alert('No duplicates found!');
    }

    setShowDuplicateModal(false);
    setSelectedColumnsForDupe([]);
  };

  const toggleColumnSelection = (columnId: string) => {
    setSelectedColumnsForDupe((prev) =>
      prev.includes(columnId)
        ? prev.filter((id) => id !== columnId)
        : [...prev, columnId]
    );
  };

  const activeColumns = file.columns.filter((col) => !col.deleted);
  const deletedColumns = file.columns.filter((col) => col.deleted);
  const previewData = file.data.slice(0, maxRows);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              {file.name}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {file.data.length} rows · {activeColumns.length} columns
              {deletedColumns.length > 0 && ` · ${deletedColumns.length} deleted`}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDuplicateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Remove Duplicates
            </button>
            <button
              onClick={() => exportCSV(file)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export File
            </button>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="px-6 py-3 bg-blue-50 border-b border-blue-200">
        <p className="text-sm text-blue-800">
          <span className="font-semibold">💡 Tips:</span> Drag column headers to reorder ·
          Click header to rename · Click × to delete column
        </p>
      </div>

      {/* Spreadsheet Table */}
      <div className="overflow-x-auto">
        <DragDropContext onDragEnd={handleDragEnd}>
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-100">
              <Droppable droppableId="columns" direction="horizontal">
                {(provided, snapshot) => (
                  <tr
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={snapshot.isDraggingOver ? 'bg-blue-100' : ''}
                  >
                    {/* Row number header */}
                    <th className="sticky left-0 z-10 px-4 py-3 bg-gray-200 border-r-2 border-gray-300">
                      <span className="text-xs font-bold text-gray-600">#</span>
                    </th>

                    {/* Draggable column headers */}
                    {activeColumns.map((column, index) => (
                      <Draggable key={column.id} draggableId={column.id} index={index}>
                        {(provided, snapshot) => (
                          <th
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`
                              relative min-w-[180px] px-4 py-3 text-left border-r border-gray-300
                              ${snapshot.isDragging
                                ? 'bg-blue-200 shadow-lg z-50'
                                : 'bg-gray-50 hover:bg-gray-100'
                              }
                              transition-colors
                            `}
                          >
                            <div className="flex items-center gap-2">
                              {/* Drag Handle */}
                              <div
                                {...provided.dragHandleProps}
                                className="drag-handle cursor-grab active:cursor-grabbing flex-shrink-0 text-gray-400 hover:text-gray-600 p-1"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                </svg>
                              </div>

                              {/* Column Name (editable) */}
                              <div className="flex-1 min-w-0">
                                {editingColumnId === column.id ? (
                                  <input
                                    type="text"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') saveEdit(column.id);
                                      if (e.key === 'Escape') cancelEdit();
                                    }}
                                    onBlur={() => saveEdit(column.id)}
                                    autoFocus
                                    className="w-full px-2 py-1 text-xs font-semibold text-gray-900 uppercase tracking-wider border-2 border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                                  />
                                ) : (
                                  <div
                                    onClick={(e) => startEditing(column.id, column.name, e)}
                                    className="cursor-text px-2 py-1 rounded hover:bg-white transition-colors"
                                  >
                                    <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider truncate">
                                      {column.name}
                                    </div>
                                    {column.name !== column.originalName && (
                                      <div className="text-[10px] text-gray-500 truncate">
                                        was: {column.originalName}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Delete Button */}
                              <button
                                onClick={() => deleteColumn(fileId, column.id)}
                                className="delete-button flex-shrink-0 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete column"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </th>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </tr>
                )}
              </Droppable>
            </thead>

            {/* Data Rows */}
            <tbody className="bg-white divide-y divide-gray-200">
              {previewData.length === 0 ? (
                <tr>
                  <td colSpan={activeColumns.length + 1} className="px-6 py-12 text-center text-gray-500">
                    No data available
                  </td>
                </tr>
              ) : (
                previewData.map((row, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-gray-50 transition-colors">
                    {/* Row number */}
                    <td className="sticky left-0 z-10 px-4 py-3 bg-gray-100 border-r-2 border-gray-300 text-xs font-medium text-gray-600">
                      {rowIndex + 1}
                    </td>

                    {/* Data cells */}
                    {activeColumns.map((column) => (
                      <td
                        key={column.id}
                        className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200 max-w-xs"
                        title={String(row[column.originalName] || '')}
                      >
                        <div className="truncate">
                          {row[column.originalName] !== undefined
                            ? String(row[column.originalName])
                            : ''}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </DragDropContext>
      </div>

      {/* Footer with row count and deleted columns */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Showing <span className="font-semibold">{Math.min(maxRows, file.data.length)}</span> of{' '}
            <span className="font-semibold">{file.data.length}</span> rows
          </p>

          {deletedColumns.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Deleted:</span>
              <div className="flex gap-2">
                {deletedColumns.map((column) => (
                  <button
                    key={column.id}
                    onClick={() => restoreColumn(fileId, column.id)}
                    className="px-3 py-1 text-xs bg-white text-gray-600 border border-gray-300 rounded hover:bg-gray-100 hover:border-gray-400 transition-colors"
                    title="Click to restore"
                  >
                    {column.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Duplicate Removal Modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Remove Duplicates
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Select which columns to check for duplicate values
              </p>
            </div>

            <div className="px-6 py-4 max-h-96 overflow-y-auto">
              <div className="space-y-2">
                {activeColumns.map((column) => (
                  <label
                    key={column.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedColumnsForDupe.includes(column.id)}
                      onChange={() => toggleColumnSelection(column.id)}
                      className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm font-medium text-gray-900">
                      {column.name}
                    </span>
                  </label>
                ))}
              </div>

              {selectedColumnsForDupe.length > 0 && (
                <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-sm text-orange-800">
                    <span className="font-semibold">Selected {selectedColumnsForDupe.length} column{selectedColumnsForDupe.length !== 1 ? 's' : ''}:</span>{' '}
                    Rows with identical values in these columns will be removed (keeping first occurrence).
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDuplicateModal(false);
                  setSelectedColumnsForDupe([]);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveDuplicates}
                disabled={selectedColumnsForDupe.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Remove Duplicates
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
