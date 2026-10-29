// SPDX-License-Identifier: Apache-2.0

// Creates a throwaway self-signed certificate for localhost with openssl, and makes requests that
// trust only that certificate, for tests that connect to the server over HTTPS.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface TestCertificate {
  cert: string;
  key: string;
  certFile: string;
  keyFile: string;
  remove(): void;
}

export function createTestCertificate(): TestCertificate {
  const folder = mkdtempSync(join(tmpdir(), "fathom-tls-"));
  const certFile = join(folder, "cert.pem");
  const keyFile = join(folder, "key.pem");
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "1",
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=DNS:localhost,IP:127.0.0.1",
      "-keyout",
      keyFile,
      "-out",
      certFile,
    ],
    { stdio: "ignore" },
  );
  return {
    certFile,
    keyFile,
    cert: readFileSync(certFile, "utf8"),
    key: readFileSync(keyFile, "utf8"),
    remove: () => {
      rmSync(folder, { recursive: true, force: true });
    },
  };
}

export interface TestResponse {
  statusCode: number;
  body: string;
}

// Requests a URL over HTTPS, trusting only the given certificate.
export function httpsGet(url: string, ca: string): Promise<TestResponse> {
  return new Promise((resolve, reject) => {
    httpsRequest(url, { ca }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => (body += chunk));
      response.on("end", () => {
        resolve({ statusCode: response.statusCode ?? 0, body });
      });
    })
      .on("error", reject)
      .end();
  });
}

// Requests a URL over plain HTTP, which the server must refuse.
export function httpGet(url: string): Promise<TestResponse> {
  return new Promise((resolve, reject) => {
    httpRequest(url, (response) => {
      response.resume();
      resolve({ statusCode: response.statusCode ?? 0, body: "" });
    })
      .on("error", reject)
      .end();
  });
}
