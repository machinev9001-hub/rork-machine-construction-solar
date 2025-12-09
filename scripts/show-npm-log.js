const { readFileSync, readdirSync, statSync } = require('fs');
const { join } = require('path');
const { homedir } = require('os');

function getLogsDir() {
  return join(homedir(), '.npm', '_logs');
}

function listLogFiles() {
  const logsDir = getLogsDir();
  try {
    const entries = readdirSync(logsDir)
      .map((file) => ({ file, mtime: statSync(join(logsDir, file)).mtime.getTime() }))
      .sort((a, b) => b.mtime - a.mtime);
    if (!entries.length) {
      console.log('No npm logs found in ~/.npm/_logs');
      return;
    }
    console.log('Available npm logs (newest first):');
    entries.forEach(({ file }, index) => {
      console.log(`${index + 1}. ${file}`);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to list npm logs:', message);
    process.exitCode = 1;
  }
}

function resolveLogPath() {
  const logsDir = getLogsDir();
  const args = process.argv.slice(2);
  const flags = new Set();
  const positional = [];

  args.forEach((arg) => {
    if (arg.startsWith('--')) {
      flags.add(arg);
    } else {
      positional.push(arg);
    }
  });

  if (flags.has('--list') || flags.has('-l')) {
    listLogFiles();
    process.exit(0);
  }

  const [customPath] = positional;
  if (customPath) {
    return join(logsDir, customPath);
  }

  const entries = readdirSync(logsDir)
    .map((file) => ({ file, mtime: statSync(join(logsDir, file)).mtime.getTime() }))
    .sort((a, b) => b.mtime - a.mtime);

  if (!entries.length) {
    throw new Error('No npm logs found in ~/.npm/_logs');
  }

  return join(logsDir, entries[0].file);
}

function main() {
  try {
    const logPath = resolveLogPath();
    const content = readFileSync(logPath, 'utf8');
    console.log(`=== ${logPath} ===`);
    console.log(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to read npm log:', message);
    process.exitCode = 1;
  }
}

main();
