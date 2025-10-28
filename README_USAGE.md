# CSV Organizer - Usage Guide

A web-based tool for organizing and merging CSV exports from PitchBook before importing to Supabase.

## Getting Started

1. **Start the development server:**
   ```bash
   cd csv-organizer
   npm run dev
   ```

2. **Open your browser:**
   Navigate to http://localhost:3000

## Features

### 1. File Upload
- Drag and drop multiple CSV files or click to browse
- Supports batch upload of 15+ files
- Automatic CSV parsing and validation

### 2. File Management
- View all uploaded files with row and column counts
- Tag files as "Company", "People", or leave "Untagged"
- Quick delete functionality
- Files are saved to browser localStorage automatically

### 3. Column Editor
- **Rename columns:** Click on any column name to edit
- **Reorder columns:** Drag and drop columns to rearrange
- **Delete columns:** Click the X button to remove unwanted columns
- **Restore deleted columns:** View and restore from the "Deleted Columns" section
- **Live preview:** See first 10 rows of data as you edit

### 4. Merge Files
- Select multiple files to merge (filter by type: Company/People/All)
- **Auto-map similar columns:** Automatically detect and map columns with matching names
- **Manual column mapping:** Map each column to a target name for the merged file
- View merged column preview before combining
- Creates a new merged file (original files are preserved)

### 5. Export
- **Export individual files:** Click export on any file
- **Export all files:** Use the "Export All" button in header
- Downloaded files include all your changes (renamed columns, deleted columns removed, reordered columns)

## Workflow Example

### Organizing Company Lists

1. Upload all your company CSV files (e.g., 10 different company lists)
2. Tag each file as "Company" type
3. For each file:
   - Select the file from the list
   - Rename columns to standardize names (e.g., "Company Name" → "Name")
   - Delete unnecessary columns
   - Reorder columns in your preferred order
4. Go to "Merge Files" tab
5. Filter by "Company Lists"
6. Select all company files
7. Click "Auto-map Similar Columns"
8. Review and adjust column mappings
9. Click "Merge Files"
10. Export the merged file

### Organizing People Lists

Follow the same workflow for people lists, ensuring consistent column names across all files.

## Tips

- **Use consistent naming:** When renaming columns, use the same names across similar files to make auto-mapping work better
- **Save progress:** Your work is automatically saved to browser localStorage
- **Preview before export:** Always check the data preview after making changes
- **Export often:** Download your organized files regularly
- **Clear cache:** Use "Clear All" button if you want to start fresh (warning: this cannot be undone)

## Next Steps

Once you've organized and merged your CSV files:

1. Export the cleaned files
2. Create a Supabase project
3. Design your database schema
4. Import the cleaned CSVs to Supabase tables
5. Build your search interface (Next.js + Supabase client)

## Technical Details

- **Frontend:** Next.js 14 with TypeScript
- **Styling:** Tailwind CSS
- **State Management:** Zustand
- **CSV Parsing:** PapaParse
- **Drag & Drop:** @hello-pangea/dnd
- **Storage:** Browser localStorage (automatic)

## Browser Requirements

- Modern browser with localStorage support
- JavaScript enabled
- Recommended: Chrome, Firefox, Safari, or Edge (latest versions)

## Limitations

- All processing happens in the browser (no server uploads)
- Large files (>50MB) may be slow to process
- Data is stored in browser localStorage (cleared if you clear browser data)
- Maximum localStorage size varies by browser (~5-10MB)

## Troubleshooting

**Files not loading?**
- Check browser console for errors
- Ensure files are valid CSV format
- Try clearing localStorage and re-uploading

**Drag and drop not working?**
- Ensure you're dragging by the handle icon
- Try refreshing the page

**Changes not saving?**
- Check browser localStorage is enabled
- Ensure you're not in private/incognito mode
