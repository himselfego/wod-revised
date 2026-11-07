#!/usr/bin/env node
// Копирует собранную систему на сервер Foundry по SSH (tar поверх ssh).
//
//   npm run sync          — собрать и скопировать один раз
//   npm run sync:watch    — vite build --watch и копирование после каждого изменения
//
// Флаги:
//   --manifest  копировать ещё и system.json (Foundry читает его только при запуске)
//   --packs     копировать ещё и packs (сначала npm run pack:items; мир на сервере должен быть закрыт)
//   --clean     перед копированием удалить на сервере dist, templates, lang, styles, fonts и assets
//   --init      первая установка: создать папку системы на сервере и скопировать system.json и packs
//
// Без --init скрипт не создаёт папку системы: если её нет, он остановится с ошибкой.
//
// Куда копировать: переменная WOD_SYNC_TARGET или файл .sync-target в корне проекта.
// Формат: user@host:/абсолютный/путь/к/системе
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, watch } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SYNC_DIRS = ['dist', 'templates', 'lang', 'styles', 'fonts', 'assets'];
const DEBOUNCE_MS = 400;

const flags = new Set(process.argv.slice(2));
const isInit = flags.has('--init');
const isWithManifest = isInit || flags.has('--manifest');
const isWithPacks = isInit || flags.has('--packs');
const isClean = flags.has('--clean');
const isWatchMode = flags.has('--watch');

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const readTarget = () => {
  const fromEnv = process.env.WOD_SYNC_TARGET;

  if (fromEnv) {
    return fromEnv.trim();
  }

  const file = path.join(root, '.sync-target');

  return existsSync(file) ? readFileSync(file, 'utf8').trim() : '';
};

const parseTarget = (target) => {
  const match = /^([^:\s]+):(\/[^'\s]+)$/.exec(target);

  if (!match) {
    fail('Не задана цель копирования. Нужна строка user@host:/путь в WOD_SYNC_TARGET или в файле .sync-target');
  }

  return { host: match[1], remotePath: match[2] };
};

// На Windows берём системный OpenSSH: только он видит агент 1Password.
const resolveSsh = () => {
  if (process.env.WOD_SYNC_SSH) {
    return process.env.WOD_SYNC_SSH;
  }

  if (process.platform === 'win32') {
    return path.join(process.env.SystemRoot ?? String.raw`C:\Windows`, 'System32', 'OpenSSH', 'ssh.exe');
  }

  return 'ssh';
};

const { host, remotePath } = parseTarget(readTarget());
const ssh = resolveSsh();

const sync = () => new Promise((resolve, reject) => {
  const wanted = isWithPacks ? [...SYNC_DIRS, 'packs'] : SYNC_DIRS;
  const directories = wanted.filter(directory => existsSync(path.join(root, directory)));

  if (!directories.includes('dist')) {
    reject(new Error('Нет папки dist. Сначала выполни npm run build.'));

    return;
  }

  if (isWithPacks && !directories.includes('packs')) {
    reject(new Error('Нет папки packs. Сначала выполни npm run pack:items.'));

    return;
  }

  const items = isWithManifest ? [...directories, 'system.json'] : directories;
  const remoteSteps = [];

  if (isInit) {
    remoteSteps.push(`mkdir -p '${remotePath}'`);
  }
  remoteSteps.push(`cd '${remotePath}'`);
  // Пак — база LevelDB: старые файлы рядом с новыми могут её испортить, поэтому packs заменяем целиком.
  const removed = isClean ? directories : directories.filter(directory => directory === 'packs');

  if (removed.length > 0) {
    remoteSteps.push(`rm -rf ${removed.join(' ')}`);
  }
  remoteSteps.push('tar -xf -');

  const tar = spawn('tar', ['-cf', '-', '-C', root, ...items], { stdio: ['ignore', 'pipe', 'inherit'] });
  const remote = spawn(ssh, ['-o', 'ConnectTimeout=10', host, remoteSteps.join(' && ')], {
    stdio: ['pipe', 'inherit', 'inherit'],
  });

  const codes = {};
  const finish = (name, code) => {
    codes[name] = code;
    if (codes.tar === undefined || codes.remote === undefined) {
      return;
    }

    if (codes.tar === 0 && codes.remote === 0) {
      resolve();
    } else {
      reject(new Error(`Копирование не удалось (tar: ${codes.tar}, ssh: ${codes.remote})`));
    }
  };

  tar.on('error', reject);
  remote.on('error', reject);
  tar.on('close', code => finish('tar', code));
  remote.on('close', (code) => {
    // Если ssh упал, tar некому читать: без этого он завис бы навсегда.
    if (code !== 0) {
      tar.kill();
    }
    finish('remote', code);
  });
  // ssh мог завершиться раньше tar (например, на сервере нет папки): причина будет в его коде возврата.
  remote.stdin.on('error', (error) => {
    if (error.code !== 'EPIPE') {
      reject(error);
    }
  });
  tar.stdout.pipe(remote.stdin);
});

const syncOnce = async () => {
  const started = Date.now();

  await sync();
  console.log(`[sync] ${host}:${remotePath} — готово за ${((Date.now() - started) / 1000).toFixed(1)} с`);
};

const startWatching = () => {
  let timer = null;
  let isRunning = false;
  let isPending = false;

  const run = async () => {
    if (isRunning) {
      isPending = true;

      return;
    }

    isRunning = true;
    try {
      await syncOnce();
    } catch (error) {
      console.error(`[sync] ${error.message}`);
    }
    isRunning = false;

    if (isPending) {
      isPending = false;
      await run();
    }
  };

  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(run, DEBOUNCE_MS);
  };

  mkdirSync(path.join(root, 'dist'), { recursive: true });
  for (const directory of SYNC_DIRS) {
    const directoryPath = path.join(root, directory);

    if (existsSync(directoryPath)) {
      watch(directoryPath, { recursive: true }, schedule);
    }
  }

  const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
  const vite = spawn(process.execPath, [viteBin, 'build', '--watch'], { cwd: root, stdio: 'inherit' });

  const stop = () => {
    vite.kill();
    process.exit(0);
  };

  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  vite.on('exit', code => process.exit(code ?? 0));

  console.log(`[sync] слежу за ${SYNC_DIRS.join(', ')}; Ctrl+C — выход`);
};

if (isWatchMode) {
  startWatching();
} else {
  try {
    await syncOnce();
  } catch (error) {
    fail(`[sync] ${error.message}`);
  }
}
