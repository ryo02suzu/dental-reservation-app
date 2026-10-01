import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { injectClinicSplash } from "./clinic-splash";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  const indexPath = path.resolve(distPath, "index.html");
  const indexHtml = fs.readFileSync(indexPath, "utf-8");

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (req, res) => {
    const page = injectClinicSplash(indexHtml, req.originalUrl, distPath);
    if (page === indexHtml) {
      res.sendFile(indexPath);
      return;
    }
    res.status(200).set({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" }).end(page);
  });
}
