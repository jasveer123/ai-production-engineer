import {
  addDockerEnv,
  addPyprojectDependency,
  deployWorkflow,
  detectProject,
  entryFromCommand,
  insertPythonStart,
  nodeChanges,
  preloadInScript,
  pythonChanges,
  type RepoFiles,
} from './setup-pr';

const repo = (files: Record<string, string>): RepoFiles => ({
  paths: Object.keys(files),
  read: (p) => Promise.resolve(files[p] ?? ''),
});

describe('setup pull request changes', () => {
  it('detects the app directory, preferring the root', () => {
    expect(detectProject(['package.json', 'api/pyproject.toml'])).toEqual({
      language: 'node',
      dir: '',
    });
    expect(detectProject(['README.md', 'web/package.json', 'services/api/package.json'])).toEqual({
      language: 'node',
      dir: 'web',
    });
    expect(detectProject(['requirements.txt'])).toEqual({ language: 'python', dir: '' });
    expect(detectProject(['README.md'])).toBeNull();
    expect(detectProject(['api/package.json', 'web/package.json'], 'api')).toEqual({
      language: 'node',
      dir: 'api',
    });
  });

  it('preloads the agent in node start scripts', () => {
    expect(preloadInScript('node server.js')).toBe('node --require @ape/agent/register server.js');
    expect(preloadInScript('NODE_ENV=production node dist/main.js')).toBe(
      'NODE_ENV=production node --require @ape/agent/register dist/main.js',
    );
    expect(preloadInScript('npm run build && node dist/index.js')).toBe(
      'npm run build && node --require @ape/agent/register dist/index.js',
    );
    expect(preloadInScript('next start')).toBeNull();
    expect(preloadInScript('node --require @ape/agent/register a.js')).toBe(
      'node --require @ape/agent/register a.js',
    );
  });

  it('node: adds the dependency, preloads start, keeps indentation, flags the lockfile', async () => {
    const c = await nodeChanges(
      repo({
        'package.json':
          '{\n    "name": "shop",\n    "scripts": { "start": "node server.js" },\n    "dependencies": { "express": "^5" }\n}\n',
        'package-lock.json': '{}',
      }),
      '',
      'shop-api',
      'production',
      'https://ingest.example.com',
    );
    const pkg = JSON.parse(c.files['package.json']!) as {
      dependencies: Record<string, string>;
      scripts: Record<string, string>;
    };
    expect(pkg.dependencies).toEqual({ '@ape/agent': '^0.1.0', express: '^5' });
    expect(pkg.scripts.start).toBe('node --require @ape/agent/register server.js');
    expect(c.files['package.json']).toMatch(/^\{\n {4}"name"/);
    expect(c.needsLockfileUpdate).toBe(true);
    expect(c.todo.join()).toMatch(/npm install/);
    expect(c.files['.env.example']).toContain('APE_SERVICE=shop-api');
    expect(c.files['.env.example']).toMatch(/APE_TOKEN=\n/);
  });

  it('node: falls back to NODE_OPTIONS in the Dockerfile for framework start commands', async () => {
    const c = await nodeChanges(
      repo({
        'package.json': '{"scripts":{"start":"next start"}}',
        Dockerfile: 'FROM node:22\nCOPY . .\nCMD ["npm","start"]\n',
      }),
      '',
      's',
      'production',
      'u',
    );
    expect(c.files.Dockerfile).toBe(
      'FROM node:22\nCOPY . .\nENV NODE_OPTIONS="--require @ape/agent/register"\nCMD ["npm","start"]\n',
    );
    expect(c.todo).toHaveLength(0);
  });

  it('python: requirements, Procfile entry and start call', async () => {
    const c = await pythonChanges(
      repo({
        'requirements.txt': 'flask==3.0',
        Procfile: 'web: gunicorn shop.wsgi:app --workers 2',
        'shop/wsgi.py':
          '"""WSGI entry."""\nfrom __future__ import annotations\n\nfrom shop import create_app\napp = create_app()\n',
      }),
      '',
      'shop',
      'production',
      'u',
    );
    expect(c.files['requirements.txt']).toBe('flask==3.0\nape-agent>=0.1.0\n');
    expect(c.files['shop/wsgi.py']).toBe(
      '"""WSGI entry."""\nfrom __future__ import annotations\n\nimport ape_agent\n\nape_agent.start()  # reads APE_TOKEN, APE_SERVICE, APE_ENDPOINT\n\nfrom shop import create_app\napp = create_app()\n',
    );
  });

  it('python helpers', () => {
    expect(entryFromCommand('web: uvicorn app.main:app --port $PORT')).toBe('app/main.py');
    expect(entryFromCommand('python manage.py runserver')).toBeNull();
    expect(insertPythonStart('#!/usr/bin/env python\nimport os\n')).toBe(
      '#!/usr/bin/env python\nimport ape_agent\n\nape_agent.start()  # reads APE_TOKEN, APE_SERVICE, APE_ENDPOINT\n\nimport os\n',
    );
    expect(
      addPyprojectDependency('[project]\nname = "x"\ndependencies = [\n    "fastapi",\n]\n'),
    ).toBe('[project]\nname = "x"\ndependencies = [\n    "ape-agent>=0.1.0",\n    "fastapi",\n]\n');
    expect(addPyprojectDependency('[project]\ndependencies = []\n')).toBe(
      '[project]\ndependencies = ["ape-agent>=0.1.0"]\n',
    );
    expect(addPyprojectDependency('[tool.poetry.dependencies]\npython = "^3.12"\n')).toBe(
      '[tool.poetry.dependencies]\nape-agent = ">=0.1.0"\npython = "^3.12"\n',
    );
    expect(addDockerEnv('FROM x\n', ['ENV A=1'])).toBe('FROM x\n\nENV A=1');
  });

  it('deploy workflow uses OIDC and no secrets', () => {
    const y = deployWorkflow({
      service: 'shop',
      environment: 'production',
      apiUrl: 'https://api.example.com',
      audience: 'ape',
      branch: 'main',
    });
    expect(y).toContain('id-token: write');
    expect(y).toContain('"$APE_URL/ingest/github-deploys"');
    expect(y).not.toMatch(/secrets\./);
  });
});
