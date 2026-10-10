// Compiles pane into standalone binaries that carry their own runtime and the built UI.
//
//   bun scripts/compile.ts         this machine only, to release/pane
//   bun scripts/compile.ts --all   every release target, packed for install.sh
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  MIN_BUN_VERSION,
  RELEASE_CHECKSUMS_FILE,
  RELEASE_DIR,
  RELEASE_ENTRY,
  RELEASE_MESSAGES,
  RELEASE_TARGETS,
  RELEASE_UI_DIR,
} from '@/config/release';
import { STATIC_INDEX_FILE } from '@/config/server';
import { APP_NAME } from '@/config/site';

type ReleaseTarget = (typeof RELEASE_TARGETS)[number];

// A compiled binary would otherwise load .env and bunfig.toml from the folder it starts in,
// which for pane is someone else's project.
const COMPILE_FLAGS = ['--minify', '--no-compile-autoload-dotenv', '--no-compile-autoload-bunfig'];

function isReleaseTarget(value: string): value is ReleaseTarget {
  return (RELEASE_TARGETS as readonly string[]).includes(value);
}

function isAtLeast(version: string, minimum: string): boolean {
  const current = version.split('.').map(Number);
  const required = minimum.split('.').map(Number);
  for (let index = 0; index < required.length; index++) {
    const difference = (current[index] ?? 0) - (required[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return true;
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env): void {
  const result = spawnSync(command, args, { stdio: 'inherit', env });
  if (result.status !== 0) throw new Error(RELEASE_MESSAGES.STEP_FAILED(`${command} ${args[0]}`));
}

function compile(target: ReleaseTarget, outfile: string): void {
  run(process.execPath, [
    'build',
    '--compile',
    `--target=bun-${target}`,
    RELEASE_ENTRY,
    '--asset',
    RELEASE_UI_DIR,
    ...COMPILE_FLAGS,
    '--outfile',
    outfile,
  ]);
}

async function sha256(filePath: string): Promise<string> {
  return createHash('sha256').update(await fs.readFile(filePath)).digest('hex');
}

// Each archive holds a single file named `pane`, which is what install.sh unpacks.
async function packTarget(target: ReleaseTarget): Promise<string> {
  const stagingDir = path.join(RELEASE_DIR, target);
  compile(target, path.join(stagingDir, APP_NAME));

  const archive = `${APP_NAME}-${target}.tar.gz`;
  // macOS tar would otherwise add "._pane" files holding extended attributes.
  run('tar', ['-czf', path.join(RELEASE_DIR, archive), '-C', stagingDir, APP_NAME], {
    ...process.env,
    COPYFILE_DISABLE: '1',
  });
  await fs.rm(stagingDir, { recursive: true });
  return archive;
}

async function main(): Promise<number> {
  const bunVersion = process.versions.bun;
  if (!bunVersion) {
    console.error(RELEASE_MESSAGES.NOT_BUN);
    return 1;
  }
  if (!isAtLeast(bunVersion, MIN_BUN_VERSION)) {
    console.error(RELEASE_MESSAGES.BUN_TOO_OLD(bunVersion));
    return 1;
  }
  if (!existsSync(path.join(RELEASE_UI_DIR, STATIC_INDEX_FILE))) {
    console.error(RELEASE_MESSAGES.UI_NOT_BUILT);
    return 1;
  }

  const { values } = parseArgs({ options: { all: { type: 'boolean' } } });
  await fs.rm(RELEASE_DIR, { recursive: true, force: true });
  await fs.mkdir(RELEASE_DIR, { recursive: true });

  if (!values.all) {
    const target = `${process.platform}-${process.arch}`;
    if (!isReleaseTarget(target)) {
      console.error(RELEASE_MESSAGES.UNSUPPORTED_HOST(target));
      return 1;
    }
    const outfile = path.join(RELEASE_DIR, APP_NAME);
    compile(target, outfile);
    console.log(RELEASE_MESSAGES.BUILT(outfile));
    return 0;
  }

  const checksums: string[] = [];
  for (const target of RELEASE_TARGETS) {
    const archive = await packTarget(target);
    checksums.push(`${await sha256(path.join(RELEASE_DIR, archive))}  ${archive}`);
    console.log(RELEASE_MESSAGES.BUILT(archive));
  }
  await fs.writeFile(path.join(RELEASE_DIR, RELEASE_CHECKSUMS_FILE), `${checksums.join('\n')}\n`);
  return 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
