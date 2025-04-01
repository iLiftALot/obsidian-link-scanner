import { App, TFile, EditorRange, EditorPosition, CachedMetadata } from "obsidian";
import { makeRangeKey, matchNoteTitle, removeFrontmatter } from "./utils";
import LinkScannerPlugin from "./main";
import { PotentialLinksModal } from "./linksModal";

export interface PotentialLink {
    /** The exact text matching another note's title within the note's content */
    matchText: string;
    /** A preview of the text surrounding the match */
    textPreview: string;
    /** The title of the other note's title that was matched */
    linkedNoteTitle: string;
    linkedNoteBasename: string;
    /** The aliases of the other note */
    linkedNoteAliases: string[];
    /** The editor range of the match within the note's content */
    range: EditorRange;
    /** The alias that matched, if applicable */
    isAliasMatch: boolean;
    /** The alias that matched, if applicable */
    matchedAlias: string | null;
    /** Unique identifier for the link */
    id: string;
}

export interface NoteLinks {
    /** The title of the note being scanned */
    noteTitle: string;
    /** The TFile object of the note being scanned */
    noteTFile: TFile;
    /** The list of potential links found in the note */
    potentialLinks: PotentialLink[];
}

/**
 * A type representing a range of matched text within a note.
 * The range is defined by two numbers: the start and end indices of the match.
 * Prevents overlapping matches from being included in the results.
 */
type MatchedRange = [number, number];

export class VaultScanner {
    app: App;
    plugin: LinkScannerPlugin;
    markdownFiles: TFile[];

    constructor(app: App, plugin: LinkScannerPlugin) {
        this.app = app;
        this.plugin = plugin;
        this.markdownFiles = this.getMarkdownFiles();
    }

    /**
     * Retrieves all markdown files from the vault and sorts them in descending order
     * based on the length of their basenames.
     *
     * @returns {TFile[]} An array of markdown files sorted by basename length, 
     *                    with the longest basenames appearing first.
     */
    getMarkdownFiles(): TFile[] {
        return this.app.vault.getMarkdownFiles().sort(
            (a, b) => b.basename.length - a.basename.length
        );
    }

    /**
     * Processes a given markdown file to identify potential links to other notes in the vault.
     * 
     * This function reads the content of the provided file, removes its frontmatter, and scans
     * for matches to other note titles within the vault. It ensures that matches do not overlap
     * and calculates the exact line and character positions of each match. The resulting matches
     * are returned as potential links, including metadata such as the linked note's title, aliases,
     * and a text preview of the match.
     * 
     * @param file - The markdown file to process.
     * @returns A promise that resolves to a `NoteLinks` object containing the file's title, 
     *          the file itself, and a list of potential links to other notes.
     */
    async processFile(file: TFile): Promise<NoteLinks> {
        // All note content
        const rawContent: string = await this.app.vault.cachedRead(file);
        // Note content without frontmatter to avoid matching links in the frontmatter
        const content: string = removeFrontmatter(rawContent);
        // Difference between the raw content and the content without frontmatter
        // This is used to adjust the match index to account for the removed frontmatter
        const frontmatterChars: number = rawContent.length - content.length;

        const noteLinks: PotentialLink[] = [];
        const matchedRanges: MatchedRange[] = [];

        for (const otherFile of this.markdownFiles) {
            // Skip if it's the same file (no self-matches)
            if (otherFile.path === file.path) continue;

            // Aliases stored in the frontmatter of the other file
            const metadata = this.app.metadataCache.getFileCache(otherFile) as CachedMetadata;
            const aliases: string[] = metadata.frontmatter?.aliases ?? [];

            // Create a combined list of terms to search for: the title plus all aliases
            const termsToMatch = [otherFile.basename, ...aliases];

            for (const term of termsToMatch) {
                // Skip empty terms
                if (!term || term.trim() === '') continue;

                // Create a regex to detect the other note's title as a whole word
                const regex: RegExp = matchNoteTitle(term);
                const matches: RegExpStringIterator<RegExpExecArray> = content.matchAll(regex);

                for (const match of matches) {
                    const matchIndex: number = match.index + frontmatterChars;
                    
                    // Check if the match overlaps with any previously found ranges
                    let isOverlapping = false;
                    for (const range of matchedRanges) {
                        if (matchIndex >= range[0] && matchIndex <= range[1]) {
                            isOverlapping = true;
                            break;
                        }
                    }
                    if (isOverlapping) continue;

                    // Add the match to the list of ranges to avoid future overlaps
                    const matchedRange: MatchedRange = [matchIndex, matchIndex + match[0].length];
                    matchedRanges.push(matchedRange);

                    // Calculate the line and character positions
                    const lines: string[] = rawContent.substring(0, matchIndex).split('\n');
                    const matchLineFrom: number = lines.length - 1;
                    const matchChFrom: number = lines[lines.length - 1].length;
                    const linesTo: string[] = rawContent.substring(0, matchIndex + match[0].length).split('\n');
                    const matchLineTo: number = linesTo.length - 1;
                    const matchChTo: number = linesTo[linesTo.length - 1].length;

                    const editorRangeFrom: EditorPosition = { line: matchLineFrom, ch: matchChFrom };
                    const editorRangeTo: EditorPosition = { line: matchLineTo, ch: matchChTo };
                    
                    // Build a unique key for line range
                    const reusedId: string = makeRangeKey(editorRangeFrom, editorRangeTo);
                    
                    noteLinks.push({
                        id: reusedId,
                        matchText: match[0],
                        textPreview: `... ${match.input.substring(
                            Math.max(0, match.index - 20),
                            Math.min(match.input.length, match.index + match[0].length + 20)
                        )} ...`,
                        linkedNoteTitle: otherFile.name,
                        linkedNoteBasename: otherFile.basename,
                        linkedNoteAliases: aliases,
                        // Store whether this was matched via an alias
                        isAliasMatch: term !== otherFile.basename,
                        // Store which alias matched if it was an alias match
                        matchedAlias: term !== otherFile.basename ? term : null,
                        range: { from: editorRangeFrom, to: editorRangeTo }
                    });
                }
            }
        }

        return {
            noteTitle: file.basename,
            noteTFile: file,
            potentialLinks: noteLinks,
        };
    }

    /**
     * Scans the entire vault for markdown files and processes each file to extract note links.
     * The results are then displayed using the `displayResults` method.
     *
     * @returns A promise that resolves to either `void` or an array of `NoteLinks` objects
     *          containing the processed results of the scanned files.
     *
     * @async
     */
    async scanVault(): Promise<void> {
        console.log('Scanning Entire Vault...');
        const results: NoteLinks[] = [];

        for (const file of this.markdownFiles) {
            const noteResult = await this.processFile(file);
            results.push(noteResult);
        }

        this.displayResults(results);
    }

    /**
     * Scans a single note file and processes its content to extract links or other relevant information.
     * The results are then displayed using the `displayResults` method.
     *
     * @param file - The note file (`TFile`) to be scanned.
     * @returns A promise that resolves to either `void` or an array of `NoteLinks` objects containing the extracted links.
     */
    async scanSingleNote(file: TFile): Promise<void> {
        console.log(`Scanning Single Note: ${file.basename}`);
        const result = await this.processFile(file);

        this.displayResults([result]);
    }

    /**
     * Displays the results of the note link scanning process in a modal.
     *
     * @param results - An array of `NoteLinks` objects representing the scanned note links.
     *                  Each object contains information about potential links found in the vault.
     * 
     * @remarks
     * This method creates and opens a `PotentialLinksModal` to present the results to the user.
     * It leverages the application's modal system to provide an interactive interface for reviewing
     * and managing the scanned links.
     */
    private displayResults(results: NoteLinks[]): void {
        new PotentialLinksModal(this.app, results, this).open();
    }
}
