import { Plugin } from 'obsidian';
import { ScanOptionsModal } from './scanOptions';

export default class LinkScannerPlugin extends Plugin {
	async onload() {
		console.log('Loading Link Scanner Plugin');

		this.addRibbonIcon(
			'link',
			'Scan Links',
			async () => {
				new ScanOptionsModal(this.app, this).open();
			}
		);
	}

	onunload() {
		console.log('Unloading Link Scanner Plugin');
	}
}
