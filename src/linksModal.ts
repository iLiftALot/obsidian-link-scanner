import { App, EditorRange, Modal, TFile } from 'obsidian';
import { NoteLinks, PotentialLink, VaultScanner } from './vaultScanner';

export class PotentialLinksModal extends Modal {
    private results: NoteLinks[];
    private vaultScanner: VaultScanner;

    constructor(app: App, results: NoteLinks[], vaultScanner: VaultScanner) {
        super(app);
        this.vaultScanner = vaultScanner;
        this.results = results;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h1', {
            text: 'Potential Links',
            cls: 'linked-notes'
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

                // Ignore button to ignore all potential links in the note
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
                    const mainWikilink = `[[${link.matchText}]]`;
                    mainCheckbox.onclick = () => {
                        if (commitButton.textContent !== 'Committed ✅') {
                            this.uncheckOthers(mainCheckbox, checkboxHolder, commitButton);

                            if (mainCheckbox.checked) {
                                previewSpan.textContent = link.textPreview.replace(link.matchText, mainWikilink);
                            } else {
                                previewSpan.textContent = link.textPreview;
                            }
                        }
                    };
                    mainPair.createEl('label', {
                        text: mainWikilink
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
                        const aliasWikilink = `[[${link.matchText}|${alias}]]`;
                        
                        aliasCheckbox.onclick = () => {
                            if (commitButton.textContent !== 'Committed ✅') {
                                this.uncheckOthers(aliasCheckbox, checkboxHolder, commitButton);

                                if (aliasCheckbox.checked) {
                                    previewSpan.textContent = link.textPreview.replace(link.matchText, aliasWikilink);
                                } else {
                                    previewSpan.textContent = link.textPreview;
                                }
                            }
                        };
                        
                        aliasPair.createEl('label', {
                            text: aliasWikilink
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
                        // Determine the selected wikilink from the checkbox group.
                        let selectedWikilink: string | null = null;
                        const allPairs: NodeListOf<HTMLDivElement> = checkboxHolder.querySelectorAll('.checkbox-pair');
                        
                        allPairs.forEach((pair: HTMLDivElement) => {
                            const checkbox = pair.querySelector('input[type="checkbox"]') as HTMLInputElement;
                            checkbox.disabled = true;
                            
                            if (checkbox.checked) {
                                const label = pair.querySelector('label') as HTMLLabelElement;
                                
                                selectedWikilink = label.textContent as string;
                            }
                        });

                        if (selectedWikilink !== null) {
                            // Access this.results to get the latest data after re-processing the file
                            const currentLinkRange = this.results
                                .find((result: NoteLinks) => result.noteTFile.path === noteTFile.path)?.potentialLinks
                                .find((l) => l.id === link.id)?.range;
                            
                            if (currentLinkRange) {
                                // Find the index of the current note 
                                const noteResultIndex = this.results.findIndex(
                                    (result: NoteLinks) => result.noteTFile.path === noteTFile.path
                                );
                                
                                if (noteResultIndex !== -1) {
                                    // Commit the change to the file
                                    await this.commitChangeForFile(noteTFile, currentLinkRange, selectedWikilink);
                                    // Re-process file to update ranges and replace the old result with the newly computed one.
                                    this.results[noteResultIndex] = await this.vaultScanner.processFile(noteTFile);

                            commitButton.textContent = 'Committed ✅';
                            commitButton.disabled = true;
                                    linkDiv.style.border = '1px solid #0cdd13';
                                }
                            }
                        }
                    };

                    // Add a commit button to apply the change in the file
                    const ignoreButton = buttonDiv.createEl('button', {
                        text: 'Remove ❌',
                        cls: 'ignore-button'
                    });
                    ignoreButton.onclick = () => {
                        linkDiv.remove();
                    }
                }
            }
        }
    }

    /**
     * Replaces text in a multi-line string based on the provided EditorRange.
     */
    replaceTextWithinRange(content: string, range: EditorRange, replacement: string): string {
        const lines = content.split('\n');
        let { line: startLine, ch: startCh } = range.from;
        let { line: endLine, ch: endCh } = range.to;

        const startLineText = lines[startLine];
        const endLineText = lines[endLine];

        //console.log(`Start Line: ${startLine}, Start Ch: ${startCh}, Start Line Text: ${startLineText}`);
        //console.log(`End Line: ${endLine}, End Ch: ${endCh}, End Line Text: ${endLineText}`);

        if (startLine === endLine) {
            // Replace text within the same line.
            const newLine: string = startLineText.substring(0, startCh) + replacement + startLineText.substring(endCh);

            return [
                ...lines.slice(0, startLine),
                newLine,
                ...lines.slice(startLine + 1)
            ].join('\n');
        } else {
            // Replace text across multiple lines.
            const newStartLine = startLineText.substring(0, startCh) + replacement;
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
     * Commits the change to the file by replacing the text within the provided range.
     */
    async commitChangeForFile(file: TFile, range: EditorRange, wikilink: string): Promise<void> {
        await this.app.vault.process(file, (content: string) => {
            return this.replaceTextWithinRange(content, range, wikilink);
        });
    }

    // Helper function to uncheck all checkboxes in the group except the current one.
    uncheckOthers(current: HTMLInputElement, checkboxHolder: HTMLDivElement, commitButton: HTMLButtonElement): void {
        const checkboxes: NodeListOf<HTMLInputElement> = checkboxHolder.querySelectorAll('input[type="checkbox"]');
        const noneChecked = Array.from(checkboxes).every(cb => !cb.checked);

        if (noneChecked) {
            commitButton.disabled = true;
        } else {
            commitButton.disabled = false;

            checkboxes.forEach((cb: HTMLInputElement) => {
                if (cb !== current) {
                    cb.checked = false;
                }
            });
        }
    };

    onClose() {
        this.contentEl.empty();
    }
}