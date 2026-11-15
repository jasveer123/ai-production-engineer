const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../web/src');
const cache = new Map();
function load(filename) {
  let file = filename;
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory())
    file = fs.existsSync(file + '.ts') ? file + '.ts' : path.join(file, 'index.ts');
  if (!file.startsWith(root + path.sep))
    throw new Error('Source import outside product web source');
  if (file.endsWith('.svg')) return () => null;
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  const localRequire = (name) => {
    if (name === 'lucide-react') return require(name);
    if (name.startsWith('@/')) return load(path.join(root, name.slice(2)));
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name));
    throw new Error('Unexpected integration catalogue dependency: ' + name);
  };
  new Function('require', 'module', 'exports', source)(localRequire, module, module.exports);
  return module.exports;
}
const catalogue = load(
  path.join(root, 'features/integrations/catalog/integrations.ts'),
).INTEGRATIONS;
const context = {
  webUrl: 'https://YOUR_PRAMAAN_URL',
  ingestUrl: 'https://YOUR_INGEST_URL',
  containerIngestUrl: 'https://YOUR_INGEST_URL',
  token: 'YOUR_TOKEN',
  service: 'my-app',
  environment: 'production',
};
const guides = catalogue.map(({ icon, methods, ...entry }) => ({
  ...entry,
  methods: methods.map(({ steps, ...method }) => ({
    ...method,
    steps: steps(context),
  })),
}));
const destination = path.resolve(__dirname, '../data/integrations.json');
fs.writeFileSync(destination, JSON.stringify(guides, null, 2) + '\n');
const downloads = [
  ['packages/sdk-node/README.md', 'node-sdk.md'],
  ['packages/sdk-python/README.md', 'python-sdk.md'],
  ['packages/collector/README.md', 'collector.md'],
  ['docs/architecture/024-one-click-integration-setup.md', 'integration-architecture.md'],
];
for (const [from, to] of downloads)
  fs.copyFileSync(
    path.resolve(root, '../../..', from),
    path.resolve(__dirname, '../public/reference', to),
  );
console.log(
  `Synced ${guides.length} product integration guides and ${downloads.length} source references.`,
);
const icons = [
  'opentelemetry',
  'docker',
  'kubernetes',
  'linux-server',
  'cloud',
  'fluent-bit',
  'javascript',
  'python',
  'http-request',
];
const iconDirectory = path.resolve(__dirname, '../public/brand/integrations');
fs.mkdirSync(iconDirectory, { recursive: true });
for (const name of icons) {
  const svg = fs.readFileSync(path.join(root, 'assets/svg', name + '.svg'), 'utf8');
  fs.writeFileSync(
    path.join(iconDirectory, name + '.svg'),
    svg.replaceAll('currentColor', '#4f46e5'),
  );
}
