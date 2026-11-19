# Workspace interface

The Home page shows real document/version counts, recent documents and activity.
Desktop navigation uses a sidebar; on smaller screens the menu opens as a modal
with Escape handling and focus containment. The avatar opens Account.

Account → Personal information supports a PNG/JPEG/WebP/GIF avatar up to 1 MB,
name, organization and position. Email and role are read-only. Security checks the
current password before changing it and revokes other sessions. Preferences save
language, theme, animation, draft autosave and font-size choices in the browser.
System reduced-motion settings also disable motion.

The editor keeps bounded undo/redo history, supports text search and wrapping,
and displays word and character counts. Saving creates a document version.
Comparison results preserve the analyzed input snapshot and show added, removed
and changed lines. Result references jump to their corresponding clauses.

Document folders, tags and favorites are personal to each user, including when a
document is shared. Comments can reference a clause and immutable version.

## File formats

Signed-in users can import text PDFs and DOCX documents up to 10 MB, 100 PDF pages
and 200,000 extracted characters. Imports extract text; original page layout,
images, tables and Word formatting are not preserved. Scanned PDF pages use local
OCR with bundled Kazakh, Russian and English models. Mixed PDFs preserve native
text and page order, and recognize image pages that have little native text.
OCR allows up to 10 scanned pages per import, one recognition job per server
process and 90 seconds per job. Other simultaneous OCR requests ask the user to
retry. Recognition does not send document contents to an external service or
download language models at runtime. Models and their Apache license and source
hashes are in `assets/ocr/`.

Review OCR text against the original before relying on it, particularly numbers
and legal clauses. The editor, comparison inputs and document library show a
review notice after recognition. Password-protected, empty or malformed files
return an error.

The editor and saved-version panel download TXT, DOCX and PDF files. PDF export
embeds the bundled OFL-licensed Noto Sans font for Kazakh/Russian/English text.
Signed-in analysis reports download as PDF; guest reports use the browser print
preview. Exported Word files contain editable text paragraphs.

Run `npm run lint`, `npm run build`, `npm run test:ui`, `npm run test:documents`, `npm run test:ocr`
and `npm run test:store` for validation. The file round-trip tests include Kazakh
characters and malformed inputs. Runtime data and browser test artifacts are not
committed.
