const API = '^services/api/src';
const FEATURES = `${API}/(modules|connectors|ingest)`;

module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment: 'Circular dependencies make modules impossible to reason about or split.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'packages-never-import-apps-or-services',
      comment: 'packages/* are consumed by apps and services, never the reverse.',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^(apps|services)/' },
    },
    {
      name: 'api-domain-stays-pure',
      comment:
        'domain/ holds pure logic: it never imports application, infrastructure, activities, controllers or modules.',
      severity: 'error',
      from: { path: `${FEATURES}/[^/]+/domain/` },
      to: {
        path: `${FEATURES}/[^/]+/(application|infrastructure|activities)/|\\.(controller|module)\\.ts$`,
      },
    },
    {
      name: 'api-core-never-imports-features',
      comment: 'core/ is shared plumbing: features depend on it, never the reverse.',
      severity: 'error',
      from: { path: `${API}/core/` },
      to: { path: `${FEATURES}/` },
    },
    {
      name: 'web-no-cross-feature-deep-imports',
      comment: 'Import another feature only through its index.ts.',
      severity: 'error',
      from: { path: '^apps/web/src/features/([^/]+)/' },
      to: {
        path: '^apps/web/src/features/([^/]+)/',
        pathNot: ['^apps/web/src/features/$1/', '^apps/web/src/features/[^/]+/index\\.tsx?$'],
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(dist|\\.next|coverage|node_modules)/|\\.(spec|test)\\.tsx?$|/test/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.depcruise.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
