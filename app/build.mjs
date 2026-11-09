// Bundles the server into CommonJS so OpenTelemetry's require hooks can
// instrument fastify, http, pino and openai at runtime. node_modules stay
// external: instrumentation only works on modules loaded with require().
import { build } from 'esbuild';

await build({
  entryPoints: {
    server: 'src/server/index.ts',
    telemetry: 'src/server/telemetry.ts',
  },
  outdir: 'dist',
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  packages: 'external',
  sourcemap: true,
  logLevel: 'info',
});
