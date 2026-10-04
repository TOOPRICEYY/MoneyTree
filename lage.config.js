const BUILD_OUTPUT_GLOBS = ['dist/**'];

/** @type {import('lage').ConfigOptions} */
export default {
  pipeline: {
    test: {
      type: 'npmScript',
      options: {
        outputGlob: ['coverage/**'],
      },
    },
    build: {
      type: 'npmScript',
      dependsOn: ['^build'],
      cache: true,
      options: {
        outputGlob: BUILD_OUTPUT_GLOBS,
      },
    },
  },
  cacheOptions: {
    cacheStorageConfig: {
      provider: 'local',
      outputGlob: BUILD_OUTPUT_GLOBS,
    },
  },
  npmClient: 'yarn',
  concurrency: 2,
};
