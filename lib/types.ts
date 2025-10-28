export type FileType = 'company' | 'people' | 'untagged';

export interface ColumnDefinition {
  id: string;
  name: string;
  originalName: string;
  deleted: boolean;
  order: number;
}

export interface CSVFile {
  id: string;
  name: string;
  type: FileType;
  columns: ColumnDefinition[];
  data: Record<string, string | number>[];
  originalData: string[][];
  headers: string[];
  uploadedAt: Date;
}

export interface ColumnMapping {
  sourceFileId: string;
  sourceColumnId: string;
  targetColumnName: string;
}

export interface MergeConfig {
  name: string;
  fileIds: string[];
  columnMappings: ColumnMapping[];
}
