// SPDX-License-Identifier: Apache-2.0

// Creates a throwaway self-signed certificate for localhost with openssl, and makes requests that
// trust only that certificate, for tests that connect to the server over HTTPS, directly or as
// Fathom's proxy does, sending a PROXY protocol header first.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { connect } from "node:net";
import { Duplex } from "node:stream";
import { connect as tlsConnect } from "node:tls";
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

// Builds a PROXY protocol header, version 2, as Fathom's proxy sends it: for a client at the given
// IPv4 address, or with no address, as for the proxy's own health checks.
export function proxyProtocolHeader(clientAddress?: string): Buffer {
  const signature = Buffer.from("0d0a0d0a000d0a515549540a", "hex");
  if (clientAddress === undefined) {
    return Buffer.concat([signature, Buffer.from([0x20, 0x00, 0x00, 0x00])]);
  }
  const addresses = Buffer.alloc(12);
  Buffer.from(clientAddress.split(".").map(Number)).copy(addresses, 0);
  Buffer.from([127, 0, 0, 1]).copy(addresses, 4);
  addresses.writeUInt16BE(50000, 8);
  addresses.writeUInt16BE(8443, 10);
  return Buffer.concat([
    signature,
    Buffer.from([0x21, 0x11, 0x00, addresses.length]),
    addresses,
  ]);
}

// Requests a URL over HTTPS on a connection that first sends the given bytes, trusting only the
// given certificate. With together set, the bytes go out in one write with the start of the
// encrypted connection, as a proxy may send them.
export function httpsGetAfter(
  url: string,
  ca: string,
  before: Buffer,
  together = false,
): Promise<TestResponse> {
  const { hostname, port, pathname } = new URL(url);
  return new Promise((resolve, reject) => {
    const connection = connect(Number(port), hostname);
    connection.on("error", reject);
    let pending: Buffer | undefined = before;
    if (!together) {
      connection.write(before);
      pending = undefined;
    }
    // Passes the encrypted connection through, adding any pending bytes to its first write.
    const carrier = new Duplex({
      read: () => undefined,
      write: (chunk: Buffer, _encoding, done) => {
        connection.write(
          pending ? Buffer.concat([pending, chunk]) : chunk,
          done,
        );
        pending = undefined;
      },
      final: (done) => {
        connection.end(done);
      },
    });
    connection.on("data", (chunk: Buffer) => carrier.push(chunk));
    connection.on("end", () => carrier.push(null));
    connection.on("close", () => carrier.destroy());
    const tlsConnection = tlsConnect({
      socket: carrier,
      servername: "localhost",
      ca,
    });
    tlsConnection.on("error", reject);
    httpRequest(
      {
        path: pathname,
        headers: { host: "localhost" },
        createConnection: () => tlsConnection,
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => (body += chunk));
        response.on("end", () => {
          resolve({ statusCode: response.statusCode ?? 0, body });
        });
      },
    )
      .on("error", reject)
      .end();
  });
}
