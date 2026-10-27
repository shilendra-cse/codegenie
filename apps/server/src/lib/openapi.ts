import fs from "node:fs";
import path from "node:path";
import type { Express } from "express";
import swaggerUi from "swagger-ui-express";

function resolveOpenApiSpecPath(): string {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, "docs/api/openapi.yaml"),
    path.resolve(cwd, "../docs/api/openapi.yaml"),
    path.resolve(cwd, "../../docs/api/openapi.yaml"),
  ];

  const specPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!specPath) {
    throw new Error(
      "OpenAPI spec not found. Expected docs/api/openapi.yaml in repository.",
    );
  }

  return specPath;
}

export function registerOpenApiDocs(app: Express): void {
  // Resolved here, not on import: production images don't include the spec.
  const openApiSpecPath = resolveOpenApiSpecPath();
  app.get("/api/openapi.yaml", (_req, res) => {
    res.sendFile(openApiSpecPath);
  });

  app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      swaggerOptions: {
        url: "/api/openapi.yaml",
      },
    }),
  );
}
