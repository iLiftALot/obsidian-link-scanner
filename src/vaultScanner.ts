import { App, TFile, EditorRange, EditorPosition } from "obsidian";
import { makeRangeKey, matchNoteTitle, removeFrontmatter } from "./utils";
import LinkScannerPlugin from "./main";
import { PotentialLinksModal } from "./linksModal";

export interface PotentialLink {
    /** The exact text matched in the note's content */
    matchText: string;
    /** A preview of the text surrounding the match */
    textPreview: string;
    /** The title of the note that was matched */
    linkedNoteTitle: string;
    /** The aliases of the linked note */
    linkedNoteAliases: string[];
    /** The editor range of the match in the note */
    range: EditorRange;
    /** Unique identifier for the link */
    id: string;
}

export interface NoteLinks {
    noteTitle: string;
    noteTFile: TFile;
    potentialLinks: PotentialLink[];
}

type MatchedRange = [number, number];

export class VaultScanner {
    app: App;
    plugin: LinkScannerPlugin;
    markdownFiles: TFile[];

    constructor(app: App, plugin: LinkScannerPlugin) {
        this.app = app;
        this.plugin = plugin;
        this.markdownFiles = this.getMarkdownFiles();
    getMarkdownFiles(): TFile[] {
        return this.app.vault.getMarkdownFiles();
    }

    /**
     * Process a single file to find potential link matches.
     */
    private async processFile(file: TFile): Promise<NoteLinks> {
        const rawContent: string = await this.app.vault.cachedRead(file);
        const content: string = removeFrontmatter(rawContent);
        const frontmatterChars: number = rawContent.length - content.length;
        const noteLinks: PotentialLink[] = [];
        const matchedRanges: MatchedRange[] = [];

        for (const otherFile of this.markdownFiles) {
            // Skip if it's the same file (no self-matches)
            if (otherFile.path === file.path) continue;

            // Create a regex to detect the other note's title as a whole word
            const regex: RegExp = matchNoteTitle(otherFile.basename);
            const matches: RegExpStringIterator<RegExpExecArray> = content.matchAll(regex);
            const aliases: string[] = this.app.metadataCache.getFileCache(otherFile)?.frontmatter?.aliases ?? [];

            for (const match of matches) {
                let isOverlapping = false;
                const matchIndex: number = match.index + frontmatterChars;
                
                for (const range of matchedRanges) {
                    if (matchIndex >= range[0] && matchIndex <= range[1]) {
                        isOverlapping = true;
                        break;
                    }
                }
                if (isOverlapping) continue;

                // Add the match to the list of ranges
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
                    linkedNoteAliases: aliases,
                    range: { from: editorRangeFrom, to: editorRangeTo }
                });
            }
        }

        return {
            noteTitle: file.basename,
            noteTFile: file,
            potentialLinks: noteLinks,
        };
    }

    /**
     * Scans all files in the entire vault.
     */
    async scanVault(): Promise<void> {
        console.log('Scanning Entire Vault...');
        const markdownFiles = this.getMarkdownFiles().sort((a, b) => b.basename.length - a.basename.length);
        const results: NoteLinks[] = [];

        for (const file of markdownFiles) {
            const noteResult = await this.processFile(file);
            results.push(noteResult);
        }

        this.displayResults(results);
    }

    /**
     * Scans only the current note.
     */
    async scanSingleNote(file: TFile): Promise<void> {
        console.log(`Scanning Single Note: ${file.basename}`);
        const result = await this.processFile(file);
        this.displayResults([result]);
    }

    /**
     * Displays each note's potential links in a modal.
     */
    private displayResults(results: NoteLinks[]): void {
        new PotentialLinksModal(this.app, results).open();
    }
}
