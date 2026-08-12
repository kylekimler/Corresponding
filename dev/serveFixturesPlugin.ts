import fs from 'node:fs';
import path from 'node:path';
import type { Connect, Plugin } from 'vite';

export const FIXTURES_MOUNT = '/fixtures/';

/** Resolve a `/fixtures/...` request to a file under `fixtures/`, or null if invalid. */
export function resolveFixturePath(
  requestPath: string,
  fixturesRoot: string,
): string | null {
  const pathname = decodeURIComponent(requestPath.split('?')[0] ?? '');
  if (!pathname.startsWith(FIXTURES_MOUNT)) return null;

  const relative = pathname.slice(FIXTURES_MOUNT.length);
  if (!relative || relative.includes('\0') || path.isAbsolute(relative)) {
    return null;
  }

  const resolved = path.resolve(fixturesRoot, relative);
  if (resolved !== fixturesRoot && !resolved.startsWith(fixturesRoot + path.sep)) {
    return null;
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return null;
  }
  return resolved;
}

export function createFixturesMiddleware(
  projectRoot = process.cwd(),
): Connect.NextHandleFunction {
  const fixturesRoot = path.resolve(projectRoot, 'fixtures');

  return (req, res, next) => {
    const rawUrl = req.url ?? '';
    const pathname = decodeURIComponent(rawUrl.split('?')[0] ?? '');
    if (!pathname.startsWith(FIXTURES_MOUNT)) {
      next();
      return;
    }

    const resolved = resolveFixturePath(pathname, fixturesRoot);
    if (!resolved) {
      const traversalAttempt = pathname.includes('..');
      res.statusCode = traversalAttempt ? 400 : 404;
      res.end(traversalAttempt ? 'Bad fixture path' : 'Fixture not found');
      return;
    }

    if (resolved.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    } else if (resolved.endsWith('.csv')) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    } else if (resolved.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }

    fs.createReadStream(resolved).pipe(res);
  };
}

/**
 * Serve repo `fixtures/` from the existing WXT/Vite dev server (no second process).
 * Example: http://localhost:3000/fixtures/nature-mts-sample.html
 */
export function serveFixturesPlugin(projectRoot = process.cwd()): Plugin {
  return {
    name: 'corresponding-serve-fixtures',
    configureServer(server) {
      server.middlewares.use(createFixturesMiddleware(projectRoot));
    },
  };
}
