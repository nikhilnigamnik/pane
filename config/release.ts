// Platforms the release binaries are built for, as `<os>-<arch>`. install.sh picks one by the
// same names, so a change here needs the same change there.
export const RELEASE_TARGETS = ['darwin-arm64', 'darwin-x64', 'linux-x64', 'linux-arm64'] as const;

export const RELEASE_DIR = 'release';
export const RELEASE_CHECKSUMS_FILE = 'SHA256SUMS';
export const RELEASE_ENTRY = 'bin/pane.ts';
// Embedded into the binary, where it shows up as `web/` next to the code, the same layout as
// dist/cli.js and dist/web.
export const RELEASE_UI_DIR = 'dist/web';

// The oldest Bun the compile step has been checked with. Older versions lack `--asset`.
export const MIN_BUN_VERSION = '1.4.3';

export const RELEASE_MESSAGES = {
  NOT_BUN: 'Run this script with Bun: bun scripts/compile.ts',
  BUN_TOO_OLD: (version: string) =>
    `Compiling needs Bun ${MIN_BUN_VERSION} or newer, and this is Bun ${version}. Run "bun upgrade".`,
  UI_NOT_BUILT: `${RELEASE_UI_DIR} is missing. Run "pnpm build" first.`,
  UNSUPPORTED_HOST: (target: string) =>
    `There is no build for this machine (${target}). Builds exist for: ${RELEASE_TARGETS.join(', ')}`,
  STEP_FAILED: (step: string) => `${step} failed.`,
  BUILT: (file: string) => `built ${file}`,
} as const;
