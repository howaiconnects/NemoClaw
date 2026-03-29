// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * NemoClaw v0.1 plugin HTTP server.
 *
 * Three endpoints only (v0.1 scope):
 *   GET  /health    → 200 { status, version, uptime }
 *   GET  /teams     → 200 static team routing table
 *   POST /dispatch  → 202 { status: "queued" }  (logs body to stdout)
 */

import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PLUGIN_VERSION = "0.1.0";

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

function teamsFilePath(): string {
  return join(__dirname, "teams.json");
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf-8"));
    });
    req.on("error", reject);
  });
}

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  const url = req.url ?? "/";
  const method = req.method ?? "GET";

  // GET /health
  if (method === "GET" && url === "/health") {
    sendJson(res, 200, {
      status: "ok",
      version: PLUGIN_VERSION,
      uptime: process.uptime(),
    });
    return;
  }

  // GET /teams
  if (method === "GET" && url === "/teams") {
    try {
      const teams = readJson(teamsFilePath());
      sendJson(res, 200, teams);
    } catch {
      sendJson(res, 503, { error: "teams table unavailable" });
    }
    return;
  }

  // POST /dispatch
  if (method === "POST" && url === "/dispatch") {
    readBody(req)
      .then((body) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = body;
        }
        // Log to stdout for audit trail — Tier 1 / Tier 2 degraded mode
        console.log("[nemoclaw/dispatch]", JSON.stringify(parsed));
        sendJson(res, 202, { status: "queued" });
      })
      .catch(() => {
        sendJson(res, 400, { error: "could not read request body" });
      });
    return;
  }

  sendJson(res, 404, { error: "not found" });
}

/**
 * Start the NemoClaw plugin HTTP server.
 * Returns the bound server so callers can close it on teardown.
 */
export function startPluginServer(port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer(handleRequest);
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => {
      resolve(server);
    });
  });
}
