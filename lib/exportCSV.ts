import Papa from 'papaparse';
import { CSVFile } from './types';

export function exportCSV(file: CSVFile) {
  // Get active (non-deleted) columns
  const activeColumns = file.columns.filter((col) => !col.deleted);

  // Create headers array using current column names
  const headers = activeColumns.map((col) => col.name);

  // Create data rows using the mapped column names
  const rows = file.data.map((row) => {
    return activeColumns.map((col) => {
      const value = row[col.originalName];
      return value !== undefined ? String(value) : '';
    });
  });

  // Combine headers and data
  const csvData = [headers, ...rows];

  // Convert to CSV string
  const csv = Papa.unparse(csvData);

  // Create blob and download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', file.name);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export function exportAllCSVs(files: CSVFile[]) {
  files.forEach((file) => {
    // Small delay between downloads to prevent browser blocking
    setTimeout(() => {
      exportCSV(file);
    }, 100 * files.indexOf(file));
  });
}
