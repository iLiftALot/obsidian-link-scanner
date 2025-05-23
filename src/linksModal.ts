import { App, EditorRange, Modal, TFile } from 'obsidian';
import { NoteLinks, PotentialLink, VaultScanner } from './vaultScanner';
import { escapeRegex, uncheckOthers } from './utils';

export class PotentialLinksModal extends Modal {
    private results: NoteLinks[];
    private vaultScanner: VaultScanner;
    private selectedWikilink: string | null = null;

    constructor(app: App, results: NoteLinks[], vaultScanner: VaultScanner) {
        super(app);
        this.vaultScanner = vaultScanner;
        this.results = results;
    }

    async onOpen() {
        const { contentEl } = this;
        const headingDiv = contentEl.createDiv({
            cls: 'potential-links-heading'
        });
        headingDiv.createEl('h1', {
            text: 'Potential Links'
        });

        // For each note with potential matches
        for (const { noteTitle, noteTFile, potentialLinks } of this.results) {
            if (potentialLinks.length > 0) {
                const contentDiv = contentEl.createDiv({
                    cls: 'potential-link-note'
                });

                // Create a heading for the note
                const headingDiv = contentDiv.createDiv({
                    cls: 'potential-link-heading'
                });
                const noteHeading = headingDiv.createEl('h3')
                const headingLink = noteHeading.createEl('a', {
                    text: `🔗 ${noteTitle}`
                });
                headingLink.setAttrs({
                    "data-tooltip-position": "top",
                    "aria-label": noteTitle,
                    "data-href": noteTitle,
                    "href": noteTitle,
                    "class": "internal-link",
                    "target": "_blank",
                    "rel": "noopener nofollow"
                });
                // Event listener to open a new window on click.
                headingLink.addEventListener('click', async (event) => {
                    event.preventDefault();
                    await this.app.workspace.openLinkText(noteTitle, noteTFile.path, "window");
                });

                // Ignore button to remove the entire note from the modal
                const ignoreAllButton = headingDiv.createEl('button', {
                    text: 'Ignore Note ❌',
                    cls: 'ignore-all-button'
                });
                ignoreAllButton.onclick = () => {
                    contentDiv.remove();
                }

                // For each potential match
                for (const link of potentialLinks) {
                    const linkDiv = contentDiv.createDiv({
                        cls: 'potential-link'
                    });

                    // Create a block for the "Matched:" text
                    const matchDiv = linkDiv.createDiv({
                        cls: 'potential-match'
                    });
                    matchDiv.createEl('strong', {
                        text: 'Matched ➡️'
                    });
                    matchDiv.createEl('span', {
                        text: link.matchText,
                        cls: 'faded-text'
                    });

                    // Create a block for the "Preview:" text
                    const previewDiv = linkDiv.createDiv({
                        cls: 'potential-preview'
                    });
                    previewDiv.createEl('strong', {
                        text: 'Preview ➡️'
                    });
                    const previewSpan = previewDiv.createEl('span', {
                        text: link.textPreview,
                        cls: 'faded-text'
                    });

                    // Container to hold all checkbox/label pairs
                    const checkboxHolder = linkDiv.createDiv({
                        cls: 'potential-link-checkbox-holder'
                    });

                    // Main match checkbox pair
                    const mainPair = checkboxHolder.createDiv({
                        cls: 'checkbox-pair'
                    });
                    const mainCheckbox = mainPair.createEl('input', {
                        type: 'checkbox',
                        cls: 'potential-link-checkbox'
                    });
                    const mainWikilink = `[[${
                        link.linkedNoteBasename
                    }]]`;
                    const mainDisplayLink = link.linkedNoteBasename;
                    mainCheckbox.onclick = () => this.handleCheckbox(
                        commitButton,
                        link,
                        mainCheckbox,
                        checkboxHolder,
                        mainWikilink,
                        previewSpan
                    );

                    mainPair.createEl('label', {
                        text: mainDisplayLink
                    });

                    // Create a separate pair for each alias
                    for (const alias of link.linkedNoteAliases) {
                        const aliasPair = checkboxHolder.createDiv({
                            cls: 'checkbox-pair'
                        });
                        const aliasCheckbox = aliasPair.createEl('input', {
                            type: 'checkbox',
                            cls: 'potential-link-checkbox'
                        });
                        const aliasWikilink = `[[${link.linkedNoteBasename}|${alias}]]`;
                        const aliasDisplayLink = alias;
                        aliasCheckbox.onclick = () => this.handleCheckbox(
                            commitButton,
                            link,
                            aliasCheckbox,
                            checkboxHolder,
                            aliasWikilink,
                            previewSpan
                        );
                        
                        aliasPair.createEl('label', {
                            text: aliasDisplayLink
                        });
                    }

                    const buttonDiv = linkDiv.createDiv({
                        cls: 'commit-button-div'
                    });
                    // Add a commit button to apply the change in the file
                    const commitButton = buttonDiv.createEl('button', {
                        text: 'Commit ✏️',
                        cls: 'commit-button',
                        attr: {
                            disabled: 'true'
                        }
                    });
                    commitButton.onclick = async () => {
                        // Access this.results to get the latest data after re-processing the file
                        const currentLinkRange = this.results
                            .find((result: NoteLinks) => result.noteTFile.path === noteTFile.path)?.potentialLinks
                            .find((l: PotentialLink) => l.id === link.id)?.range;
                        
                        if (currentLinkRange && this.selectedWikilink) {
                            // Find the index of the current note 
                            const noteResultIndex = this.results.findIndex(
                                (result: NoteLinks) => result.noteTFile.path === noteTFile.path
                            );
                            
                            if (noteResultIndex !== -1) {
                                // Commit the change to the file
                                await this.commitChangeForFile(noteTFile, currentLinkRange);
                                // Re-process file to update ranges and replace the old result with the newly computed one.
                                this.results[noteResultIndex] = await this.vaultScanner.processFile(noteTFile);
                                
                                commitButton.textContent = 'Committed ✅';
                                commitButton.disabled = true;
                                linkDiv.style.border = '1px solid #0cdd13';
                            }
                        }
                        //}
                    };

                    // Remove button to ignore the specific potential link
                    const ignoreButton = buttonDiv.createEl('button', {
                        text: 'Remove ❌',
                        cls: 'ignore-button'
                    });
                    ignoreButton.onclick = () => {
                        linkDiv.remove();
                    }
                }
            } else {
                const noMatchesDiv = contentEl.createDiv({
                    cls: 'no-potential-links'
                });
                noMatchesDiv.createEl('h4', {
                    text: 'NO POTENTIAL LINKS FOUND'
                });
            }
        }
    }

    /**
     * Replaces a specified range of text within a given content string with a replacement string.
     *
     * @param content - The original content as a string.
     * @param range - The range of text to replace, specified as an `EditorRange` object with `from` and `to` properties.
     *                - `from` specifies the starting position with `line` and `ch` (character) indices.
     *                - `to` specifies the ending position with `line` and `ch` (character) indices.
     * @param replacement - The string to insert in place of the specified range.
     * @returns The updated content string with the specified range replaced by the replacement string.
     *
     * @remarks
     * - If the range spans a single line, the replacement is performed within that line.
     * - If the range spans multiple lines, the replacement modifies the start and end lines accordingly,
     *   and removes the lines in between.
     * - The function assumes that the input content is a newline-separated string.
     */
    replaceTextWithinRange(
        content: string,
        range: EditorRange
    ): string {
        const lines = content.split('\n');
        let { line: startLine, ch: startCh } = range.from;
        let { line: endLine, ch: endCh } = range.to;

        const startLineText = lines[startLine];
        const endLineText = lines[endLine];

        if (startLine === endLine) {
            // Replace text within the same line.
            const newLine: string = startLineText.substring(0, startCh) + this.selectedWikilink + startLineText.substring(endCh);

            return [
                ...lines.slice(0, startLine),
                newLine,
                ...lines.slice(startLine + 1)
            ].join('\n');
        } else {
            // Replace text across multiple lines.
            const newStartLine = startLineText.substring(0, startCh) + this.selectedWikilink;
            const newEndLine = endLineText.substring(endCh);

            return [
                ...lines.slice(0, startLine),
                newStartLine,
                newEndLine,
                ...lines.slice(endLine + 1)
            ].join('\n');
        }
    }

    /**
     * Commits a change to a specified file by replacing text within a given range with a new wikilink.
     *
     * @param file - The target file where the change will be applied.
     * @param range - The range within the file's content to be replaced.
     * @param wikilink - The new wikilink text to insert within the specified range.
     * @returns A promise that resolves when the change has been successfully committed.
     */
    async commitChangeForFile(
        file: TFile,
        range: EditorRange
    ): Promise<void> {
        await this.app.vault.process(file, (content: string) => {
            return this.replaceTextWithinRange(content, range);
        });
    }

    /**
     * Handles the behavior of a checkbox within the link scanning modal.
     * Updates the preview text and ensures only one checkbox is selected at a time.
     *
     * @param commitButton - The button element used to commit the selected link.
     * @param link - The potential link object containing match and preview text information.
     * @param checkbox - The checkbox element being interacted with.
     * @param checkboxHolder - The container element holding the checkbox.
     * @param wikiLink - The wiki-style link to replace the matched text in the preview.
     * @param previewSpan - The span element displaying the preview text.
     * 
     * @returns void
     */
    handleCheckbox(
        commitButton: HTMLButtonElement,
        link: PotentialLink,
        checkbox: HTMLInputElement,
        checkboxHolder: HTMLDivElement,
        wikiLink: string,
        previewSpan: HTMLSpanElement
    ): void {
        if (commitButton.textContent !== 'Committed ✅') {
            uncheckOthers(checkbox, checkboxHolder, commitButton);

            const previewRegex = new RegExp(
                `(?<!\\[\\[.*?|\\[\\[.*?\\|.*?)(?<=\\s|\\b|\\*|[?.!,;:\\-/\`~=])${escapeRegex(link.linkedNoteBasename)}(?=\\s|\\b|\\*|[?.!,;:\\-/\`~=])`,
                    'gi'
                );

            let previewRegexAlias: RegExp | null = null;
            if (link.isAliasMatch) {
                previewRegexAlias = new RegExp(
                    `(?<!\\[\\[.*?|\\[\\[.*?\\|.*?)(?<=\\s|\\b|\\*|[?.!,;:\\-/\`~=])${escapeRegex(link.matchedAlias as string)}(?=\\s|\\b|\\*|[?.!,;:\\-/\`~=])(?!.*?\\]\\])`,
                    'gi'
                );
            }

            if (checkbox.checked) {
                this.selectedWikilink = wikiLink;
                previewSpan.textContent = link.textPreview.replace(
                    link.textPreview.match(previewRegex)
                        ? previewRegex
                        : (previewRegexAlias ?? link.matchText),
                    wikiLink
                );
            } else {
                this.selectedWikilink = null;
                previewSpan.textContent = link.textPreview;
            }
        }
    };

    onClose() {
        this.contentEl.empty();
    }
}