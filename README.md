# Template Plugin
Conveniently initialize a new Obsidian plugin with custom configurations.

## Features
- Globally defined `Process.env` object which can be used to circumnavigate mobile compatibility issues between the `process` module and mobile platforms.
  - NOTE: You must create a `.env` file in the root of your plugin directory.
- NPM development script specifically for logging within `esbuild.config.mjs` on build using `npm run dev:log`.
- Two Obsidian development packages which define undocumented typings and provide utility functions for the Obsidian API.
  - [obsidian-typings](https://github.com/Fevol/obsidian-typings).
  - [obsidian-dev-utils](https://github.com/RyotaUshio/obsidian-dev-utils/).
- Utilizes [terser](https://github.com/terser/terser) for main.js minification to reduce plugin size.
- Deep merges the plugin settings with [deepmerge-ts](https://github.com/RebeccaStevens/deepmerge-ts).
- See other utilities [here](https://github.com/iLiftALot/template-plugin/tree/main/typings).
