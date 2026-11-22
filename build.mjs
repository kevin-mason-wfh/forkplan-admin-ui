import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const watch = process.argv.includes('--watch');
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('public', 'dist', { recursive: true });

const opts = {
  entryPoints: ['src/main.jsx'],
  bundle: true,
  minify: !watch,
  sourcemap: watch,
  outdir: 'dist/assets',
  jsx: 'automatic',
  loader: { '.css': 'css' },
  define: { 'process.env.NODE_ENV': watch ? '"development"' : '"production"' },
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(opts);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: 'dist', port: 5173 });
  console.log(`Dev server: http://localhost:${port}`);
} else {
  await esbuild.build(opts);
}
