#!/usr/bin/env node
/**
 * Serves the saved examples in `public/visa-api.postman_collection.json` the
 * way a Postman mock server does, so the UI can run against the collection
 * without a Postman account.
 *
 *   node tools/collection-mock.mjs [--port 4010]
 *
 * Then point the frontend at it:
 *
 *   APPLICATION_SERVICE_URL=http://localhost:4010 \
 *   APPLICATION_SERVICE_PREFIX= \
 *   APPLICATION_SERVICE_MOCK=true \
 *   npm run dev
 *
 * Matching rules, mirrored from Postman:
 *  - method + path, where `{{variable}}` segments match anything;
 *  - `x-mock-response-name` picks a specific saved example;
 *  - otherwise the first example saved on that method + path wins.
 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const collectionPath = join(
  root,
  "public",
  "visa-api.postman_collection.json",
);

const port = Number(
  process.env.PORT ??
    (process.argv.includes("--port")
      ? process.argv[process.argv.indexOf("--port") + 1]
      : 4010),
);

/** Path segments of a request, with `{{var}}` marked as wildcards. */
function segmentsOf(request) {
  const path = request.url?.path ?? [];
  return path.map((segment) =>
    /^\{\{.+\}\}$/.test(segment) ? null : segment,
  );
}

function routeKey(method, segments) {
  return `${method} /${segments.map((s) => s ?? "*").join("/")}`;
}

async function loadRoutes() {
  const collection = JSON.parse(await readFile(collectionPath, "utf8"));
  const routes = [];

  const walk = (items) => {
    for (const item of items) {
      if (item.item) {
        walk(item.item);
        continue;
      }
      const method = item.request.method;
      const segments = segmentsOf(item.request);
      for (const example of item.response ?? []) {
        routes.push({
          method,
          segments,
          key: routeKey(method, segments),
          name: example.name,
          code: example.code,
          body: example.body ?? "",
          request: item.name,
        });
      }
    }
  };

  walk(collection.item);
  return routes;
}

function matches(route, method, segments) {
  if (route.method !== method) return false;
  if (route.segments.length !== segments.length) return false;
  return route.segments.every(
    (expected, index) => expected === null || expected === segments[index],
  );
}

const routes = await loadRoutes();

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const segments = url.pathname.split("/").filter(Boolean);
  const wanted = req.headers["x-mock-response-name"];

  // Drain the body so keep-alive connections are reusable; a mock ignores it.
  req.resume();

  const candidates = routes.filter((route) =>
    matches(route, req.method, segments),
  );

  const chosen =
    candidates.find((route) => wanted && route.name === wanted) ??
    candidates[0];

  const send = (code, payload, note) => {
    const body = typeof payload === "string" ? payload : JSON.stringify(payload);
    res.writeHead(code, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(body);
    console.log(
      `${req.method} ${url.pathname} → ${code} ${note}`.replace(/\s+$/, ""),
    );
  };

  if (!chosen) {
    send(
      404,
      {
        message: `No saved example matches ${req.method} ${url.pathname}. Add one to the collection.`,
      },
      "(no matching example)",
    );
    return;
  }

  if (wanted && chosen.name !== wanted) {
    console.warn(
      `  ! example "${wanted}" not found on this path; using "${chosen.name}"`,
    );
  }

  send(chosen.code, chosen.body, `"${chosen.name}"`);
});

server.listen(port, () => {
  console.log(
    `Postman-style mock of ${routes.length} saved examples on http://localhost:${port}`,
  );
  const keys = [...new Set(routes.map((route) => route.key))];
  for (const key of keys) {
    const names = routes
      .filter((route) => route.key === key)
      .map((route) => route.name);
    console.log(`  ${key}  ${names.join(" | ")}`);
  }
});
