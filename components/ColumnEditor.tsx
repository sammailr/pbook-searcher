'use client';

import { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useCSVStore } from '@/lib/store';

interface ColumnEditorProps {
  fileId: string;
}

export default function ColumnEditor({ fileId }: ColumnEditorProps) {
  const files = useCSVStore((state) => state.files);
  const renameColumn = useCSVStore((state) => state.renameColumn);
  const reorderColumns = useCSVStore((state) => state.reorderColumns);
  const deleteColumn = useCSVStore((state) => state.deleteColumn);
  const restoreColumn = useCSVStore((state) => state.restoreColumn);

  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

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

    const items = Array.from(file.columns);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    reorderColumns(fileId, items.map((col) => col.id));
  };

  const startEditing = (columnId: string, currentName: string) => {
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

  const activeColumns = file.columns.filter((col) => !col.deleted);
  const deletedColumns = file.columns.filter((col) => col.deleted);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">
          {file.name} - Column Editor
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Drag to reorder, click to rename, or delete unwanted columns
        </p>
      </div>

      <div className="p-6">
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="columns">
            {(provided, snapshot) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className={`
                  space-y-2 min-h-[200px] p-4 rounded-lg border-2 border-dashed
                  ${snapshot.isDraggingOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300'}
                `}
              >
                {activeColumns.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">
                    No active columns
                  </div>
                ) : (
                  activeColumns.map((column, index) => (
                    <Draggable key={column.id} draggableId={column.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`
                            flex items-center gap-3 p-3 bg-white rounded-lg border
                            ${snapshot.isDragging
                              ? 'border-blue-400 shadow-lg'
                              : 'border-gray-200 hover:border-gray-300'
                            }
                          `}
                        >
                          <div
                            {...provided.dragHandleProps}
                            className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
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
                                d="M4 8h16M4 16h16"
                              />
                            </svg>
                          </div>

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
                                className="w-full px-2 py-1 text-sm font-medium border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            ) : (
                              <div
                                onClick={() => startEditing(column.id, column.name)}
                                className="cursor-text"
                              >
                                <p className="text-sm font-medium text-gray-900">
                                  {column.name}
                                </p>
                                {column.name !== column.originalName && (
                                  <p className="text-xs text-gray-500">
                                    Original: {column.originalName}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => deleteColumn(fileId, column.id)}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete column"
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
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                      )}
                    </Draggable>
                  ))
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {deletedColumns.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Deleted Columns ({deletedColumns.length})
            </h3>
            <div className="space-y-2">
              {deletedColumns.map((column) => (
                <div
                  key={column.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <span className="text-sm text-gray-600 line-through">
                    {column.name}
                  </span>
                  <button
                    onClick={() => restoreColumn(fileId, column.id)}
                    className="px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
