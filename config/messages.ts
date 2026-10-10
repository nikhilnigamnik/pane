import type { ApiErrorCode } from '@/types/api';

import { DEFAULT_PORT } from './server';
import { APP_DESCRIPTION, APP_NAME } from './site';

export const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  invalid_request: 'The request was not valid.',
  forbidden: 'This request is not allowed.',
  outside_workspace: 'That path is outside the opened folder.',
  not_found: 'File or folder not found.',
  not_a_file: 'That path is not a file.',
  not_a_directory: 'That path is not a folder.',
  too_large: 'This file is too large to open.',
  binary: 'This looks like a binary file, so it cannot be edited as text.',
  not_an_image: 'Only image files can be shown this way.',
  invalid_pattern: 'That is not a valid regular expression.',
  already_exists: 'A file or folder with that name already exists.',
  unsupported_encoding: 'This file is not UTF-8 text, so it cannot be edited without damaging it.',
  conflict: 'This file changed on disk after you opened it.',
  io_error: 'The file could not be read or written.',
};

export const CLI_USAGE = `${APP_NAME} - ${APP_DESCRIPTION.toLowerCase()}

Usage: ${APP_NAME} [path] [options]

  path           Folder or file to open (default: current folder)

Options:
  -p, --port     Port to listen on (default: ${DEFAULT_PORT})
      --no-open  Do not open the browser
  -v, --version  Print the version
  -h, --help     Show this help`;

export const CLI_MESSAGES = {
  INVALID_PORT: 'The port must be a whole number between 0 and 65535.',
  PATH_NOT_FOUND: (target: string) => `Cannot open "${target}": no such file or folder.`,
  UI_NOT_BUILT: 'The UI has not been built yet. Run "pnpm build" in the pane project first.',
  SERVING: (root: string) => `${APP_NAME}  serving ${root}`,
  DEV_API: (url: string) => `${APP_NAME}  dev API on ${url}`,
  STOP_HINT: 'Press Ctrl+C to stop',
  START_FAILED: (reason: string) => `Could not start ${APP_NAME}: ${reason}`,
} as const;
