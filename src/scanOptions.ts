import { App, Modal, TFile, Notice } from "obsidian";
import LinkScannerPlugin from "./main";
import { VaultScanner } from "./vaultScanner";

export class ScanOptionsModal extends Modal {
    private plugin: LinkScannerPlugin;

    constructor(app: App, plugin: LinkScannerPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        // Div to hold the overall content, centered.
        const containerDiv = contentEl.createDiv({ cls: "scan-options-container" });

        // Create a heading container with h1 and h2
        const headingDiv = containerDiv.createDiv({ cls: "scan-options-heading-div" });
        headingDiv.createEl("h1", { text: "🔗 Link Scanner" });
        headingDiv.createEl("h3", { text: "Choose Scan Option" });

        // Create the beta warning callout AFTER the headings and ABOVE the buttons.
        const warningDiv = containerDiv.createDiv({ cls: "beta-warning" });
        warningDiv.createEl("h4", { text: "⚠️ Beta Warning" });
        warningDiv.createEl("strong", {
            text: "Backup your vault before committing changes. Although this plugin is tested and regarded as safe, it is still in beta testing."
        });

        // Div to hold the buttons, centered.
        const buttonDiv = containerDiv.createDiv({ cls: "scan-options-button-div" });

        // Button: Scan Entire Vault
        const vaultButton = buttonDiv.createEl("button", { text: "📘 Scan Vault", cls: "scan-options-vault-button" });
        vaultButton.onclick = async () => {
            this.close();
            await new VaultScanner(this.app, this.plugin).scanVault();
        };

        // Button: Scan Current Note
        const currentNoteButton = buttonDiv.createEl("button", { text: "📄 Scan Note", cls: "scan-options-note-button" });
        currentNoteButton.onclick = async () => {
            this.close();
            const activeFile: TFile | null = this.app.workspace.getActiveFile();

            if (activeFile) {
                await new VaultScanner(this.app, this.plugin).scanSingleNote(activeFile);
            } else {
                console.log("No active file found.");
                new Notice("No active file found.");
            }
        };
    }

    onClose() {
        this.contentEl.empty();
    }
}