// SPDX-License-Identifier: Apache-2.0

// Tests for accepting connections from Fathom's proxy: reading valid PROXY protocol headers for IPv4,
// IPv6, and the proxy's health checks, rejecting anything else, refusing connections from anywhere
// but the proxy, closing connections whose header is too slow, and passing each connection on to a
// listening HTTPS server, which sees the client in place of the proxy and still applies its own
// time limits.

import {
  createTestCertificate,
  httpsGetAfter,
  proxyProtocolHeader,
  type TestCertificate,
} from "@fathom/test-utils";
import { once } from "node:events";
import {
  createServer as createHttpsServer,
  type Server as HttpsServer,
} from "node:https";
import { type AddressInfo, connect, type Server, type Socket } from "node:net";
import { connect as tlsConnect } from "node:tls";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  acceptProxyProtocol,
  parseProxyHeader,
  type ProxyProtocolOptions,
} from "./proxy-protocol.ts";

const signature = "0d0a0d0a000d0a515549540a";

// A header with the given version and command, address family, and bytes after the fixed part.
function header(versionAndCommand: number, family: number, variable: Buffer) {
  const fixed = Buffer.alloc(4);
  fixed.writeUInt8(versionAndCommand, 0);
  fixed.writeUInt8(family, 1);
  fixed.writeUInt16BE(variable.length, 2);
  return Buffer.concat([Buffer.from(signature, "hex"), fixed, variable]);
}

function ipv6Header(source: string) {
  const addresses = Buffer.alloc(36);
  Buffer.from(source, "hex").copy(addresses);
  addresses.writeUInt16BE(50001, 32);
  return header(0x21, 0x21, addresses);
}

describe("reading the PROXY protocol header", () => {
  it("reads an IPv4 client", () => {
    const data = proxyProtocolHeader("192.0.2.77");
    expect(parseProxyHeader(data)).toEqual({
      client: { address: "192.0.2.77", family: "IPv4", port: 50000 },
      length: data.length,
    });
  });

  it("reads an IPv6 client, in the address's usual short form", () => {
    expect(
      parseProxyHeader(ipv6Header("20010db8000000000000000000000042")),
    ).toEqual({
      client: { address: "2001:db8::42", family: "IPv6", port: 50001 },
      length: 52,
    });
  });

  it("reads an IPv4 client carried in an IPv6 address as IPv4", () => {
    expect(
      parseProxyHeader(ipv6Header("00000000000000000000ffffc0000237"))?.client,
    ).toEqual({ address: "192.0.2.55", family: "IPv4", port: 50001 });
  });

  it("reads the proxy's health checks, which name no client", () => {
    expect(parseProxyHeader(proxyProtocolHeader())).toEqual({
      client: undefined,
      length: 16,
    });
  });

  it("waits for the rest of a header that has only partly arrived", () => {
    const data = proxyProtocolHeader("192.0.2.77");
    expect(parseProxyHeader(data.subarray(0, 5))).toBeUndefined();
    expect(parseProxyHeader(data.subarray(0, 20))).toBeUndefined();
  });

  it("rejects data that is not a header", () => {
    expect(() => parseProxyHeader(Buffer.from("GET / HTTP/1.1"))).toThrow(
      "The connection did not start with a PROXY protocol header",
    );
  });

  it("rejects other versions, unknown commands, and long headers", () => {
    expect(() =>
      parseProxyHeader(header(0x11, 0x11, Buffer.alloc(12))),
    ).toThrow("Only version 2");
    expect(() =>
      parseProxyHeader(header(0x22, 0x11, Buffer.alloc(12))),
    ).toThrow("Unknown PROXY protocol command");
    expect(() =>
      parseProxyHeader(header(0x21, 0x11, Buffer.alloc(513))),
    ).toThrow("too long");
  });

  it("rejects address families other than TCP, and addresses that are too short", () => {
    for (const [family, length] of [
      [0x31, 216],
      [0x12, 12],
      [0x11, 4],
      [0x21, 12],
    ] as const) {
      expect(() =>
        parseProxyHeader(header(0x21, family, Buffer.alloc(length))),
      ).toThrow("Unsupported PROXY protocol address family");
    }
  });
});

describe("accepting connections from the proxy", () => {
  let certificate: TestCertificate;
  let httpsServer: HttpsServer;
  const fronts: Server[] = [];

  // A front listener for the shared HTTPS server, with the given options.
  async function frontFor(
    options: Partial<ProxyProtocolOptions> = {},
    { host = "127.0.0.1", target = httpsServer } = {},
  ): Promise<string> {
    const front = acceptProxyProtocol(target, {
      proxyHost: "localhost",
      headerTimeoutMilliseconds: 300,
      ...options,
    });
    fronts.push(front);
    front.listen(0, host);
    await once(front, "listening");
    return `https://127.0.0.1:${String((front.address() as AddressInfo).port)}/`;
  }

  // Connects over the given loopback address, sends a header, and reports whether the connection was
  // closed rather than passed on, which leaves it waiting for the encrypted connection to start.
  async function refused(url: string, over = "127.0.0.1") {
    const connection = connect(Number(new URL(url).port), over);
    connection.on("error", () => undefined);
    connection.write(proxyProtocolHeader("192.0.2.77"));
    // A refused connection may be reset, so its errors are expected.
    const closed = new Promise<boolean>((resolve) => {
      connection.on("close", () => {
        resolve(true);
      });
    });
    const waiting = new Promise<boolean>((resolve) => {
      setTimeout(() => {
        resolve(false);
      }, 200);
    });
    const result = await Promise.race([closed, waiting]);
    connection.destroy();
    return result;
  }

  beforeAll(async () => {
    certificate = createTestCertificate();
    // Short time limits, checked often, so the tests can show they apply.
    httpsServer = createHttpsServer(
      {
        cert: certificate.cert,
        key: certificate.key,
        headersTimeout: 300,
        requestTimeout: 300,
        connectionsCheckingInterval: 50,
      },
      ({ socket }, response) => {
        response.end(
          `${String(socket.remoteAddress)} ${String(socket.remoteFamily)} ${String(socket.remotePort)}`,
        );
      },
    );
    // Each test adds its own front listener to this one server, each watching its connections.
    httpsServer.setMaxListeners(30);
    httpsServer.listen(0, "127.0.0.1");
    await once(httpsServer, "listening");
  });

  afterAll(() => {
    for (const front of fronts) front.close();
    httpsServer.close();
    certificate.remove();
  });

  it("passes the connection on with the client in place of the proxy", async () => {
    const response = await httpsGetAfter(
      await frontFor(),
      certificate.cert,
      proxyProtocolHeader("192.0.2.77"),
    );
    expect(response).toEqual({
      statusCode: 200,
      body: "192.0.2.77 IPv4 50000",
    });
  });

  it("works when the header and the encrypted connection arrive together", async () => {
    const response = await httpsGetAfter(
      await frontFor(),
      certificate.cert,
      proxyProtocolHeader("192.0.2.78"),
      true,
    );
    expect(response.body).toMatch(/^192\.0\.2\.78 /);
  });

  it("keeps the proxy's own address for its health checks", async () => {
    const url = await frontFor();
    const first = await httpsGetAfter(
      url,
      certificate.cert,
      proxyProtocolHeader(),
    );
    expect(first.body).toMatch(/^127\.0\.0\.1 IPv4 /);
    // The proxy's address is known from the first connection.
    const second = await httpsGetAfter(
      url,
      certificate.cert,
      proxyProtocolHeader(),
    );
    expect(second.statusCode).toBe(200);
  });

  it("refuses connections from anywhere but the proxy", async () => {
    for (const proxyHost of ["192.0.2.1", "proxy.invalid"]) {
      await expect(
        httpsGetAfter(
          await frontFor({ proxyHost }),
          certificate.cert,
          proxyProtocolHeader("192.0.2.77"),
        ),
      ).rejects.toThrow();
    }
  });

  it("keeps the proxy's known address when a later lookup fails", async () => {
    let lookups = 0;
    const url = await frontFor(
      {
        minimumLookupIntervalMilliseconds: 0,
        resolveProxy: () =>
          (lookups += 1) === 1
            ? Promise.resolve(["127.0.0.1"])
            : Promise.reject(new Error("A fictional lookup failure")),
      },
      { host: "::" },
    );
    expect(await refused(url)).toBe(false);
    // A connection from an unknown address looks the proxy up again, and that lookup fails.
    expect(await refused(url, "::1")).toBe(true);
    expect(lookups).toBe(2);
    expect(await refused(url)).toBe(false);
  });

  it("shares one lookup among connections, and looks up at most once a second", async () => {
    let lookups = 0;
    const url = await frontFor({
      resolveProxy: () => {
        lookups += 1;
        return Promise.resolve(["192.0.2.1"]);
      },
    });
    const results = await Promise.all([
      refused(url),
      refused(url),
      refused(url),
    ]);
    expect(results).toEqual([true, true, true]);
    expect(await refused(url)).toBe(true);
    expect(lookups).toBe(1);
  });

  it("closes connections that arrive after the HTTPS server has stopped", async () => {
    const stopped = createHttpsServer({
      cert: certificate.cert,
      key: certificate.key,
    });
    // The proxy's address is fixed, so the connection is always from the proxy and is closed for the
    // stopped server, never as one from elsewhere, however this computer looks up localhost.
    const url = await frontFor(
      { resolveProxy: () => Promise.resolve(["127.0.0.1"]) },
      { target: stopped },
    );
    expect(await refused(url)).toBe(true);
  });

  it("closes connections that do not start with a header", async () => {
    await expect(
      httpsGetAfter(await frontFor(), certificate.cert, Buffer.alloc(0)),
    ).rejects.toThrow();
  });

  it("closes connections whose header does not arrive in time, however it is sent", async () => {
    const connection = connect(
      Number(new URL(await frontFor()).port),
      "127.0.0.1",
    );
    // A byte at a time, each well within the time limit, never completing the header in time.
    const header = proxyProtocolHeader("192.0.2.77");
    let sent = 0;
    // The server may reset the connection rather than close it, which is just as good.
    connection.on("error", () => undefined);
    const closed = new Promise<void>((resolve) => {
      connection.on("close", () => {
        resolve();
      });
    });
    const drip = setInterval(() => {
      if (sent < header.length && !connection.destroyed) {
        connection.write(header.subarray(sent, (sent += 1)));
      }
    }, 50);
    try {
      await closed;
      expect(sent).toBeLessThan(header.length);
    } finally {
      clearInterval(drip);
    }
  });

  it("keeps serving after a connection fails part-way through the header", async () => {
    const url = await frontFor();
    const front = fronts.at(-1);
    const failed = new Promise<Socket>((resolve) => {
      front?.once("connection", (serverSide: Socket) => {
        serverSide.once("data", () => {
          serverSide.emit("error", new Error("A fictional connection failure"));
          resolve(serverSide);
        });
      });
    });
    const connection = connect(Number(new URL(url).port), "127.0.0.1");
    connection.write(proxyProtocolHeader("192.0.2.77").subarray(0, 10));
    expect((await failed).destroyed).toBe(true);
    await once(connection, "close");
    const response = await httpsGetAfter(
      url,
      certificate.cert,
      proxyProtocolHeader("192.0.2.79"),
    );
    expect(response.body).toMatch(/^192\.0\.2\.79 /);
  });

  it("leaves the HTTPS server's own time limits in force", async () => {
    const connection = connect(
      Number(new URL(await frontFor()).port),
      "127.0.0.1",
    );
    connection.write(proxyProtocolHeader("192.0.2.77"));
    const tlsConnection = tlsConnect({
      socket: connection,
      servername: "localhost",
      ca: certificate.cert,
    });
    await once(tlsConnection, "secureConnect");
    // A request whose headers never finish.
    tlsConnection.write("GET / HTTP/1.1\r\nHost: localhost\r\n");
    let answer = "";
    tlsConnection.setEncoding("utf8");
    tlsConnection.on("data", (chunk: string) => (answer += chunk));
    await once(tlsConnection, "close");
    expect(answer).toMatch(/^HTTP\/1\.1 408/);
  });
});
