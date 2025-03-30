import { EditorPosition } from "obsidian";

// Create a regex to match occurrences of the note title
export function matchNoteTitle(title: string) {
    return new RegExp(
        `(?<!\\[\\[.*?|\\[\\[.*?\\|.*?)(?<=\\s|\\b|\\*)${escapeRegex(title)}(?=\\s|\\b|\\*)`,
        'gi'
    );
}

// Helper to safely escape a string for use in a RegExp
export function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Avoid matches within the frontmatter by removing it before aquiring matches
export function removeFrontmatter(content: string): string {
    let noteContent: string = content;
    const frontmatterMatched: RegExpMatchArray | null = content.match(/^-{3}\n^\w+:[\s\S]*?\n^-{3}/gm);
    const hasFrontmatterFormat: boolean = content.startsWith('---\n');
    
    if (frontmatterMatched !== null && hasFrontmatterFormat) {
        noteContent = content.replace(frontmatterMatched[0], '');
    }

    return noteContent;
}

export function makeRangeKey(from: EditorPosition, to: EditorPosition): string {
    return `${from.line}-${from.ch}-${to.line}-${to.ch}`;
}
