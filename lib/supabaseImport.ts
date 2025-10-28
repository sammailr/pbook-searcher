import { supabase } from './supabase';
import { CSVFile } from './types';
import { Database } from './types/database';

type CompanyInsert = Database['public']['Tables']['companies']['Insert'];

export interface ImportProgress {
  total: number;
  imported: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

export interface ColumnMapping {
  csvColumn: string; // Original column name from CSV
  dbColumn: keyof CompanyInsert; // Database column name
}

/**
 * Common column mappings for PitchBook exports
 */
export const COMMON_MAPPINGS: ColumnMapping[] = [
  { csvColumn: 'Company Name', dbColumn: 'company_name' },
  { csvColumn: 'Primary Company Name', dbColumn: 'company_name' },
  { csvColumn: 'Company Website', dbColumn: 'company_url' },
  { csvColumn: 'entity-hover href 3', dbColumn: 'company_url' },
  { csvColumn: 'Person Name', dbColumn: 'person_name' },
  { csvColumn: 'Primary Contact Name', dbColumn: 'person_name' },
  { csvColumn: 'First Name', dbColumn: 'person_first_name' },
  { csvColumn: 'Last Name', dbColumn: 'person_last_name' },
  { csvColumn: 'Job Title', dbColumn: 'person_title' },
  { csvColumn: 'Title', dbColumn: 'person_title' },
  { csvColumn: 'Email', dbColumn: 'email' },
  { csvColumn: 'Phone', dbColumn: 'phone' },
  { csvColumn: 'LinkedIn URL', dbColumn: 'linkedin_url' },
  { csvColumn: 'City', dbColumn: 'city' },
  { csvColumn: 'HQ Location: City', dbColumn: 'city' },
  { csvColumn: 'State', dbColumn: 'state' },
  { csvColumn: 'HQ Location: State/Region', dbColumn: 'state' },
  { csvColumn: 'Postal Code', dbColumn: 'postal_code' },
  { csvColumn: 'Country', dbColumn: 'country' },
  { csvColumn: 'HQ Location: Country', dbColumn: 'country' },
];

/**
 * Auto-detect column mappings based on CSV headers
 */
export function autoDetectMappings(csvHeaders: string[]): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];

  csvHeaders.forEach((header) => {
    const mapping = COMMON_MAPPINGS.find(
      (m) => m.csvColumn.toLowerCase() === header.toLowerCase()
    );
    if (mapping) {
      mappings.push({ csvColumn: header, dbColumn: mapping.dbColumn });
    }
  });

  return mappings;
}

/**
 * Generate PitchBook ID from row data
 * Uses company name + email/phone as unique identifier
 */
function generatePitchBookId(row: Record<string, string | number>): string {
  const companyName = String(row['company_name'] || row['Company Name'] || '').trim();
  const email = String(row['email'] || row['Email'] || '').trim();
  const phone = String(row['phone'] || row['Phone'] || '').trim();

  // Create unique ID from available data
  const uniqueString = `${companyName}-${email || phone || Date.now()}`;

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < uniqueString.length; i++) {
    const char = uniqueString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return `pb-${Math.abs(hash).toString(36)}`;
}

/**
 * Import CSV data to Supabase companies table
 */
export async function importCSVToSupabase(
  file: CSVFile,
  mappings: ColumnMapping[],
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportProgress> {
  const progress: ImportProgress = {
    total: file.data.length,
    imported: 0,
    failed: 0,
    errors: [],
  };

  // Process in batches to avoid overwhelming the database
  const BATCH_SIZE = 100;

  for (let i = 0; i < file.data.length; i += BATCH_SIZE) {
    const batch = file.data.slice(i, i + BATCH_SIZE);
    const records: CompanyInsert[] = [];

    batch.forEach((row, batchIndex) => {
      try {
        const record: Partial<CompanyInsert> = {
          source_file: file.name,
          source_row_number: i + batchIndex + 1,
        };

        // Apply column mappings
        mappings.forEach(({ csvColumn, dbColumn }) => {
          const value = row[csvColumn];
          if (value !== undefined && value !== null && value !== '') {
            (record as any)[dbColumn] = String(value).trim();
          }
        });

        // Generate PitchBook ID if not provided
        if (!record.pitchbook_id) {
          record.pitchbook_id = generatePitchBookId(record as any);
        }

        // Ensure pitchbook_id is present (required field)
        if (record.pitchbook_id) {
          records.push(record as CompanyInsert);
        } else {
          progress.failed++;
          progress.errors.push({
            row: i + batchIndex + 1,
            error: 'Missing required pitchbook_id',
          });
        }
      } catch (error) {
        progress.failed++;
        progress.errors.push({
          row: i + batchIndex + 1,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Insert batch
    if (records.length > 0) {
      const { data, error } = await supabase
        .from('companies')
        .upsert(records, {
          onConflict: 'pitchbook_id',
          ignoreDuplicates: false, // Update existing records
        })
        .select();

      if (error) {
        console.error('Batch insert error:', error);
        progress.failed += records.length;
        progress.errors.push({
          row: i,
          error: `Batch error: ${error.message}`,
        });
      } else {
        progress.imported += data?.length || records.length;
      }
    }

    // Report progress
    if (onProgress) {
      onProgress({ ...progress });
    }
  }

  return progress;
}

/**
 * Get import statistics for a file
 */
export async function getImportStats(fileName: string) {
  const { data, error } = await supabase
    .from('companies')
    .select('id, imported_at', { count: 'exact' })
    .eq('source_file', fileName);

  if (error) {
    console.error('Error fetching import stats:', error);
    return null;
  }

  return {
    count: data?.length || 0,
    lastImport: data?.[0]?.imported_at || null,
  };
}

/**
 * Check if a file has already been imported
 */
export async function isFileImported(fileName: string): Promise<boolean> {
  const stats = await getImportStats(fileName);
  return stats !== null && stats.count > 0;
}

/**
 * Delete all records from a specific source file
 */
export async function deleteImportedFile(fileName: string): Promise<number> {
  const { data, error } = await supabase
    .from('companies')
    .delete()
    .eq('source_file', fileName)
    .select();

  if (error) {
    console.error('Error deleting imported file:', error);
    throw error;
  }

  return data?.length || 0;
}
