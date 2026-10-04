#!/usr/bin/env node
import { runCli } from '@/server/cli';

const exitCode = await runCli(process.argv.slice(2));
// A zero code means the server is running (or help was printed), so the process is left alone.
if (exitCode !== 0) process.exit(exitCode);
