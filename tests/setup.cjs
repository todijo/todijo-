// Next.js replaces this marker during bundling. Node's test runner does not,
// so preload a no-op marker while preserving the production-only guard.
const serverOnly = require.resolve("server-only");
require.cache[serverOnly] = {
  id: serverOnly,
  filename: serverOnly,
  loaded: true,
  exports: {},
  children: [],
  paths: [],
};
