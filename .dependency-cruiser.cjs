/** Import boundaries from docs/engineering/CODE-STANDARDS.md section 1. */
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
      comment:
        'Dependencies point inward: packages/* are consumed by apps and services, never the reverse.',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^(apps|services)/' },
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
