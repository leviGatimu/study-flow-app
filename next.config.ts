import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(__dirname),
  /**
   * Keep the standalone server to the server.
   *
   * Tracing from the project root means Next walks the whole repo, and it was
   * dragging in everything that happens to sit there: `desktop-app/dist`, i.e.
   * the PREVIOUS packaged build - which itself contains a copy of a previous
   * standalone server. Every desktop build therefore nested the last one
   * inside it, and `.next/standalone` had reached 3.8 GB (2.9 GB of it that
   * one directory) for an app whose own server code is ~37 MB. The installer
   * payload was 2.16 GB.
   *
   * The rest are the same class of mistake, just smaller: marketing assets,
   * the developer's own uploads and SQLite database, and the orphaned Prisma
   * engine .tmp files that failed generates leave behind. None of it is read
   * by the server at runtime - uploads live in userData (see UPLOADS_DIR in
   * desktop-app/main.js) and the user's database is built by the migrations on
   * first boot.
   *
   * THIS LIST IS A HINT, NOT A GUARANTEE, AND IT HAS ALREADY FAILED ONCE. On
   * 2026-09-09 a build with every one of these entries in place still produced
   * a 950 MB .next/standalone containing desktop-app/dist, setup/ and
   * public/uploads. The tracer's behaviour changed and nothing announced it.
   * scripts/build-desktop.mjs now deletes these paths from the output after the
   * build and FAILS if they are still there, which is the check that actually
   * holds. Keep both: this one makes the build smaller, that one makes it safe.
   */
  outputFileTracingExcludes: {
    '*': [
      'desktop-app/**',
      'setup/**',
      'promo/**',
      'demo/**',
      'backups/**',
      'docs/**',
      'test/**',
      'public/uploads/**',
      '**/*.zip',
      '**/*.db',
      '**/*.db.bak*',
      '**/*.node.tmp*',
      'node_modules/.prisma/client-sqlite-test/**',
    ],
  },
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  experimental: {
    serverActions: {
      bodySizeLimit: '64mb' // song uploads (audio cap is 60 MB in lib/upload.ts)
    }
  }
};

export default nextConfig;
