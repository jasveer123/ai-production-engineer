/**
 * Pure file changes for the setup pull requests (ADR-024). Given a repository's files, decide
 * what to change so the app starts sending data, and say plainly what could not be automated.
 */

export type Language = 'node' | 'python';

export interface RepoFiles {
  paths: string[];
  read: (path: string) => Promise<string>;
}

export interface FileChanges {
  files: Record<string, string>;
  /** Things the person must still do, shown in the PR body and the UI. */
  todo: string[];
  /** What the PR did, in plain words. */
  done: string[];
  language: Language | null;
  /** A lockfile exists and must be refreshed, so the PR opens as a draft. */
  needsLockfileUpdate: boolean;
}

export const AGENT_NPM = '@ape/agent';
export const AGENT_NPM_VERSION = '^0.1.0';
export const AGENT_PYPI = 'ape-agent';
export const AGENT_PYPI_SPEC = 'ape-agent>=0.1.0';
const REGISTER = `--require ${AGENT_NPM}/register`;

const has = (paths: string[], p: string) => paths.includes(p);
const join = (dir: string, f: string) => (dir ? `${dir}/${f}` : f);

/** The app's directory: the root if it has a manifest, else the shallowest one (monorepos). */
export function detectProject(
  paths: string[],
  hint?: string,
): { language: Language; dir: string } | null {
  const dirs = hint ? [hint.replace(/^\/|\/$/g, '')] : [''];
  const manifests = paths.filter(
    (p) =>
      /(^|\/)(package\.json|pyproject\.toml|requirements\.txt)$/.test(p) &&
      !p.includes('node_modules/'),
  );
  if (!hint) {
    const depth = (p: string) => p.split('/').length;
    for (const m of [...manifests].sort((a, b) => depth(a) - depth(b)))
      dirs.push(m.split('/').slice(0, -1).join('/'));
  }
  for (const dir of dirs) {
    if (has(paths, join(dir, 'package.json'))) return { language: 'node', dir };
    if (has(paths, join(dir, 'pyproject.toml')) || has(paths, join(dir, 'requirements.txt')))
      return { language: 'python', dir };
  }
  return null;
}

function envExampleBlock(service: string, environment: string, endpoint: string): string {
  return [
    '# AI Production Engineer: set APE_TOKEN in your real environment (never commit it).',
    'APE_TOKEN=',
    `APE_ENDPOINT=${endpoint}`,
    `APE_SERVICE=${service}`,
    `APE_ENVIRONMENT=${environment}`,
    '',
  ].join('\n');
}

interface EnvExampleOptions {
  dir: string;
  service: string;
  environment: string;
  endpoint: string;
}

async function withEnvExample(r: RepoFiles, c: FileChanges, opts: EnvExampleOptions) {
  const { dir, service, environment, endpoint } = opts;
  const path = join(dir, '.env.example');
  const current = has(r.paths, path) ? await r.read(path) : '';
  if (current.includes('APE_SERVICE=')) return;
  c.files[path] =
    `${current}${current && !current.endsWith('\n') ? '\n' : ''}${current ? '\n' : ''}${envExampleBlock(service, environment, endpoint)}`;
  c.done.push(`Added the agent settings to \`${path}\`.`);
}

/** Inserts `ENV` lines before the final CMD/ENTRYPOINT of a Dockerfile. */
export function addDockerEnv(dockerfile: string, lines: string[]): string {
  const rows = dockerfile.split('\n');
  let at = rows.length;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (/^\s*(CMD|ENTRYPOINT)\b/i.test(rows[i]!)) {
      at = i;
      break;
    }
  }
  rows.splice(at, 0, ...lines);
  return rows.join('\n');
}

/** `node server.js` -> `node --require @ape/agent/register server.js` (first plain node call). */
export function preloadInScript(script: string): string | null {
  if (script.includes(REGISTER)) return script;
  const m = /(^|&&\s*|;\s*|\s)node(\s+)(?!--require)/.exec(script);
  if (!m) return null;
  const at = m.index + m[1]!.length + 'node'.length;
  return `${script.slice(0, at)} ${REGISTER}${script.slice(at)}`;
}

type PackageJson = {
  dependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  main?: string;
};

function addAgentDependency(pkg: PackageJson, pkgPath: string, c: FileChanges): void {
  pkg.dependencies = { ...(pkg.dependencies ?? {}) };
  if (pkg.dependencies[AGENT_NPM]) return;
  pkg.dependencies[AGENT_NPM] = AGENT_NPM_VERSION;
  // Keep dependencies sorted, as npm writes them.
  pkg.dependencies = Object.fromEntries(
    Object.entries(pkg.dependencies).sort(([a], [b]) => a.localeCompare(b)),
  );
  c.done.push(`Added \`${AGENT_NPM}\` to \`${pkgPath}\`.`);
}

/** Makes the start scripts load the agent first. Returns true when the agent will preload. */
function preloadAgentScripts(pkg: PackageJson, c: FileChanges): boolean {
  let preloaded = false;
  const scripts = { ...(pkg.scripts ?? {}) };
  for (const name of ['start', 'start:prod', 'serve']) {
    if (!scripts[name]) continue;
    const next = preloadInScript(scripts[name]);
    if (!next) continue;
    if (next !== scripts[name])
      c.done.push(`The \`${name}\` script now loads the agent first (\`node ${REGISTER}\`).`);
    scripts[name] = next;
    preloaded = true;
  }
  if (!preloaded && !scripts.start && pkg.main) {
    scripts.start = `node ${REGISTER} ${pkg.main}`;
    c.done.push(`Added a \`start\` script that loads the agent before \`${pkg.main}\`.`);
    preloaded = true;
  }
  if (Object.keys(scripts).length) pkg.scripts = scripts;
  return preloaded;
}

const NODE_INSTALL_COMMANDS: [prefix: string, command: string][] = [
  ['pnpm', 'pnpm install'],
  ['yarn', 'yarn install'],
  ['bun', 'bun install'],
];

function nodeLockfileTodo(r: RepoFiles, dir: string, c: FileChanges): void {
  for (const lock of ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb']) {
    if (!has(r.paths, join(dir, lock)) && !has(r.paths, lock)) continue;
    c.needsLockfileUpdate = true;
    const cmd =
      NODE_INSTALL_COMMANDS.find(([prefix]) => lock.startsWith(prefix))?.[1] ?? 'npm install';
    c.todo.push(
      `Run \`${cmd}\` on this branch and commit \`${lock}\` (we cannot run your package manager from GitHub).`,
    );
    return;
  }
}

export async function nodeChanges(
  r: RepoFiles,
  dir: string,
  service: string,
  environment: string,
  endpoint: string,
): Promise<FileChanges> {
  const c: FileChanges = {
    files: {},
    todo: [],
    done: [],
    language: 'node',
    needsLockfileUpdate: false,
  };
  const pkgPath = join(dir, 'package.json');
  const raw = await r.read(pkgPath);
  const indent = /\n(\s+)"/.exec(raw)?.[1] ?? '  ';
  const pkg = JSON.parse(raw) as PackageJson;

  addAgentDependency(pkg, pkgPath, c);
  let preloaded = preloadAgentScripts(pkg, c);
  c.files[pkgPath] = `${JSON.stringify(pkg, null, indent)}\n`;

  const dockerfile = join(dir, 'Dockerfile');
  if (!preloaded && has(r.paths, dockerfile)) {
    c.files[dockerfile] = addDockerEnv(await r.read(dockerfile), [
      `ENV NODE_OPTIONS="${REGISTER}"`,
    ]);
    c.done.push(
      `The Dockerfile sets \`NODE_OPTIONS=${REGISTER}\`, so the agent starts with any start command.`,
    );
    preloaded = true;
  }
  if (!preloaded)
    c.todo.push(
      `Start the app with \`NODE_OPTIONS="${REGISTER}"\`, or add \`require('${AGENT_NPM}').start()\` as the first line of your entry file.`,
    );

  nodeLockfileTodo(r, dir, c);
  await withEnvExample(r, c, { dir, service, environment, endpoint });
  return c;
}

const PY_ENTRIES = [
  'manage.py',
  'main.py',
  'app.py',
  'wsgi.py',
  'asgi.py',
  'app/main.py',
  'src/main.py',
  'server.py',
  'run.py',
];

/** Module path from a Procfile/Docker command like `gunicorn app.wsgi:application`. */
export function entryFromCommand(cmd: string): string | null {
  const m =
    /(?:gunicorn|uvicorn|hypercorn|daphne|waitress-serve)\b[^\n]*?\s([A-Za-z_][\w.]*):[A-Za-z_]\w*/.exec(
      cmd,
    );
  return m ? `${m[1]!.replace(/\./g, '/')}.py` : null;
}

/** Adds `import ape_agent; ape_agent.start()` after the docstring and `from __future__` imports. */
export function insertPythonStart(source: string): string {
  if (/^\s*import ape_agent\b/m.test(source)) return source;
  const lines = source.split('\n');
  let i = 0;
  if (lines[0]?.startsWith('#!')) i++;
  while (i < lines.length && /^\s*#.*coding[:=]/.test(lines[i]!)) i++;
  // Module docstring
  const doc = /^\s*[rRuU]?("""|''')/.exec(lines[i] ?? '');
  if (doc) {
    const q = doc[1]!;
    const rest = lines[i]!.slice(lines[i]!.indexOf(q) + 3);
    if (rest.includes(q)) i++;
    else {
      i++;
      while (i < lines.length && !lines[i]!.includes(q)) i++;
      i++;
    }
  }
  while (
    i < lines.length &&
    (/^\s*from __future__ import/.test(lines[i]!) || lines[i]!.trim() === '')
  )
    i++;
  const block = [
    'import ape_agent',
    '',
    'ape_agent.start()  # reads APE_TOKEN, APE_SERVICE, APE_ENDPOINT',
    '',
  ];
  lines.splice(i, 0, ...block);
  return lines.join('\n');
}

/** Adds the dependency to `[project] dependencies` or `[tool.poetry.dependencies]`. */
export function addPyprojectDependency(toml: string): string | null {
  if (/["']?ape-agent["']?\s*[=>"']/.test(toml)) return toml;
  const pep621 = /^(\[project\][\s\S]*?^dependencies\s*=\s*\[)/m.exec(toml);
  if (pep621) {
    const at = pep621.index + pep621[1]!.length;
    const inline = toml.slice(at).match(/^\s*\]/);
    const entry = inline ? `"${AGENT_PYPI_SPEC}"` : `\n    "${AGENT_PYPI_SPEC}",`;
    return `${toml.slice(0, at)}${entry}${toml.slice(at)}`;
  }
  const poetry = /^\[tool\.poetry\.dependencies\]\s*\n/m.exec(toml);
  if (poetry) {
    const at = poetry.index + poetry[0].length;
    return `${toml.slice(0, at)}ape-agent = ">=0.1.0"\n${toml.slice(at)}`;
  }
  return null;
}

async function addPythonDependency(r: RepoFiles, dir: string, c: FileChanges): Promise<void> {
  const req = join(dir, 'requirements.txt');
  const pyproject = join(dir, 'pyproject.toml');
  if (has(r.paths, req)) {
    const text = await r.read(req);
    if (/^ape-agent\b/m.test(text)) return;
    c.files[req] = `${text}${text.endsWith('\n') || !text ? '' : '\n'}${AGENT_PYPI_SPEC}\n`;
    c.done.push(`Added \`${AGENT_PYPI}\` to \`${req}\`.`);
  } else if (has(r.paths, pyproject)) {
    const next = addPyprojectDependency(await r.read(pyproject));
    if (next) {
      c.files[pyproject] = next;
      c.done.push(`Added \`${AGENT_PYPI}\` to \`${pyproject}\`.`);
    } else c.todo.push(`Add \`${AGENT_PYPI_SPEC}\` to your dependencies.`);
  }
}

/** Finds the entry module (a Procfile command first, then common file names) and starts the agent. */
async function startAgentInEntry(r: RepoFiles, dir: string, c: FileChanges): Promise<void> {
  const candidates: string[] = [];
  for (const f of [join(dir, 'Procfile'), 'Procfile', join(dir, 'Dockerfile')]) {
    if (!has(r.paths, f)) continue;
    const e = entryFromCommand(await r.read(f));
    if (e) candidates.push(join(dir, e));
  }
  candidates.push(...PY_ENTRIES.map((e) => join(dir, e)));
  const entry = candidates.find((p) => has(r.paths, p));
  if (!entry) {
    c.todo.push(
      'Add `import ape_agent; ape_agent.start()` at the top of the module your server imports first.',
    );
    return;
  }
  const src = await r.read(entry);
  const next = insertPythonStart(src);
  if (next === src) return;
  c.files[entry] = next;
  c.done.push(`\`${entry}\` starts the agent before anything else runs.`);
}

const PYTHON_LOCK_COMMANDS: Record<string, string> = {
  'poetry.lock': 'poetry lock',
  'uv.lock': 'uv lock',
  'Pipfile.lock': 'pipenv lock',
  'pdm.lock': 'pdm lock',
};

function pythonLockfileTodo(r: RepoFiles, dir: string, c: FileChanges): void {
  for (const [lock, cmd] of Object.entries(PYTHON_LOCK_COMMANDS)) {
    if (!has(r.paths, join(dir, lock))) continue;
    c.needsLockfileUpdate = true;
    c.todo.push(`Run \`${cmd}\` on this branch and commit \`${lock}\`.`);
  }
}

export async function pythonChanges(
  r: RepoFiles,
  dir: string,
  service: string,
  environment: string,
  endpoint: string,
): Promise<FileChanges> {
  const c: FileChanges = {
    files: {},
    todo: [],
    done: [],
    language: 'python',
    needsLockfileUpdate: false,
  };
  await addPythonDependency(r, dir, c);
  await startAgentInEntry(r, dir, c);
  pythonLockfileTodo(r, dir, c);
  await withEnvExample(r, c, { dir, service, environment, endpoint });
  return c;
}

const yamlString = (s: string) => JSON.stringify(s);

/**
 * A workflow that sends a deploy marker after each push to the default branch (or by hand).
 * It authenticates with the GitHub Actions OIDC token, so the repository needs no secret.
 */
export function deployWorkflow(opts: {
  service: string;
  environment: string;
  apiUrl: string;
  audience: string;
  branch: string;
}): string {
  return `# Tells AI Production Engineer which commit is live, so it can compare old and new
# and check that a fix worked. Uses GitHub's OIDC token: no secrets to store.
# If you deploy in another workflow, move the "Send deploy marker" step to the end of it.
name: Deploy marker (AI Production Engineer)

on:
  push:
    branches: [${yamlString(opts.branch)}]
  workflow_dispatch:

permissions:
  id-token: write
  contents: read

jobs:
  deploy-marker:
    runs-on: ubuntu-latest
    steps:
      - name: Send deploy marker
        env:
          APE_URL: ${yamlString(opts.apiUrl)}
          APE_SERVICE: ${yamlString(opts.service)}
          APE_ENVIRONMENT: ${yamlString(opts.environment)}
          APE_AUDIENCE: ${yamlString(opts.audience)}
        run: |
          token=$(curl -fsS -H "Authorization: bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \\
            "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=$APE_AUDIENCE" | jq -r .value)
          body=$(jq -nc --arg s "$APE_SERVICE" --arg e "$APE_ENVIRONMENT" --arg c "$GITHUB_SHA" --arg v "$GITHUB_REF_NAME" \\
            '{service:$s, env:$e, commit_sha:$c, version:$v}')
          curl -fsS -X POST "$APE_URL/ingest/github-deploys" \\
            -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "$body"
`;
}

export const DEPLOY_WORKFLOW_PATH = '.github/workflows/ape-deploy-marker.yml';

export function setupPrBody(
  kind: 'agent' | 'deploy',
  c: { done: string[]; todo: string[] },
  extra: string[] = [],
): string {
  const title =
    kind === 'agent'
      ? 'This pull request connects the app to AI Production Engineer.'
      : 'This pull request sends a deploy marker to AI Production Engineer after every deploy.';
  return [
    title,
    '',
    '### What changed',
    ...c.done.map((d) => `- ${d}`),
    ...(c.todo.length ? ['', '### Before you merge', ...c.todo.map((t) => `- [ ] ${t}`)] : []),
    ...(extra.length ? ['', ...extra] : []),
    '',
    '_Opened by AI Production Engineer at the request of a workspace admin. Nothing is merged automatically._',
  ].join('\n');
}
