// SPDX-License-Identifier: Apache-2.0

// Accepts connections from Fathom's proxy, which passes encrypted traffic through unchanged and
// starts each connection with a PROXY protocol header, version 2, naming the client. Connections
// from anywhere but the proxy are closed, so no other container can claim to be a client. The
// header is read and removed before the HTTPS server sees the connection, and the client's address
// replaces the proxy's, so logs and rate limiting see the real client. A connection whose header
// has not fully arrived within a few seconds of connecting is closed.

import { lookup } from "node:dns/promises";
import { createServer, type Server, type Socket } from "node:net";
import type { Server as TlsServer, TLSSocket } from "node:tls";

const signature = Buffer.from("0d0a0d0a000d0a515549540a", "hex");
// The signature, the version and command, the address family, and the length of what follows.
const fixedLength = 16;
// Enough for IPv6 addresses and the optional fields HAProxy can add, so a header cannot hold a
// connection's memory.
const maxVariableLength = 512;
const defaultHeaderTimeoutMilliseconds = 5_000;
const version2 = 2;
const localCommand = 0;
const proxyCommand = 1;
const tcpOverIpv4 = 0x11;
const tcpOverIpv6 = 0x21;
const ipv4AddressesLength = 12;
const ipv6AddressesLength = 36;
const ipv4MappedPrefix = Buffer.from("00000000000000000000ffff", "hex");

export interface Client {
  address: string;
  family: "IPv4" | "IPv6";
  port: number;
}

export interface ProxyHeader {
  // Undefined for the proxy's own health checks, which speak for no client.
  client: Client | undefined;
  length: number;
}

// Writes an IPv6 address in its usual short form, and an IPv4 address carried in IPv6 as IPv4.
function ipv6Client(bytes: Buffer, port: number): Client {
  if (bytes.subarray(0, 12).equals(ipv4MappedPrefix)) {
    return { address: [...bytes.subarray(12)].join("."), family: "IPv4", port };
  }
  const groups: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 2) {
    groups.push(bytes.readUInt16BE(offset).toString(16));
  }
  const { hostname } = new URL(`https://[${groups.join(":")}]`);
  return { address: hostname.slice(1, -1), family: "IPv6", port };
}

// Reads a header from the start of the data received so far. Returns undefined while more data is
// needed, and throws if the data cannot be a valid header.
export function parseProxyHeader(data: Buffer): ProxyHeader | undefined {
  const compared = Math.min(data.length, signature.length);
  if (!data.subarray(0, compared).equals(signature.subarray(0, compared))) {
    throw new Error(
      "The connection did not start with a PROXY protocol header",
    );
  }
  if (data.length < fixedLength) return undefined;
  const versionAndCommand = data.readUInt8(12);
  const command = versionAndCommand & 0x0f;
  if (versionAndCommand >> 4 !== version2) {
    throw new Error("Only version 2 of the PROXY protocol is supported");
  }
  const variableLength = data.readUInt16BE(14);
  if (variableLength > maxVariableLength) {
    throw new Error("The PROXY protocol header is too long");
  }
  const length = fixedLength + variableLength;
  if (data.length < length) return undefined;
  if (command === localCommand) return { client: undefined, length };
  if (command !== proxyCommand) {
    throw new Error("Unknown PROXY protocol command");
  }
  const family = data.readUInt8(13);
  const addresses = data.subarray(fixedLength, length);
  if (family === tcpOverIpv4 && variableLength >= ipv4AddressesLength) {
    const address = [...addresses.subarray(0, 4)].join(".");
    return {
      client: { address, family: "IPv4", port: addresses.readUInt16BE(8) },
      length,
    };
  }
  if (family === tcpOverIpv6 && variableLength >= ipv6AddressesLength) {
    return {
      client: ipv6Client(addresses.subarray(0, 16), addresses.readUInt16BE(32)),
      length,
    };
  }
  throw new Error("Unsupported PROXY protocol address family");
}

export type ResolveHost = (host: string) => Promise<string[]>;

async function resolveHost(host: string): Promise<string[]> {
  const found = await lookup(host, { all: true });
  return found.map((entry) => entry.address);
}

// Decides whether a connection comes from the proxy, found by its host name. The proxy's address
// changes if it restarts, so an unknown address is checked against a fresh lookup. Connections
// arriving together share one lookup, lookups run at most once a second, so connections from other
// containers cannot flood them, and a failed lookup keeps the addresses already known.
function proxyAddressCheck(
  proxyHost: string,
  resolve: ResolveHost,
  minimumLookupIntervalMilliseconds: number,
) {
  let known = new Set<string>();
  let lookingUp: Promise<void> | undefined;
  let lastLookup = Number.NEGATIVE_INFINITY;
  const refresh = () => {
    if (
      lookingUp === undefined &&
      Date.now() - lastLookup >= minimumLookupIntervalMilliseconds
    ) {
      lastLookup = Date.now();
      lookingUp = resolve(proxyHost)
        .then(
          (addresses) => {
            known = new Set(addresses);
          },
          () => undefined,
        )
        .finally(() => {
          lookingUp = undefined;
        });
    }
    return lookingUp;
  };
  return async (address: string) => {
    // A server listening on all IPv6 addresses sees IPv4 peers in IPv6 form.
    const peer = address.replace(/^::ffff:/, "");
    if (!known.has(peer)) await refresh();
    return known.has(peer);
  };
}

export interface ProxyProtocolOptions {
  // The proxy's host name; connections from any other address are closed.
  proxyHost: string;
  headerTimeoutMilliseconds?: number;
  // Tests replace the lookup of the proxy's address and how often it may run.
  resolveProxy?: ResolveHost;
  minimumLookupIntervalMilliseconds?: number;
}

// Returns a server that checks each connection comes from the proxy, reads its header, then passes
// the rest of the connection to the HTTPS server. The HTTPS server must itself be listening, on a
// private address, since Node.js applies its request time limits, and closes idle connections when
// asked, only for servers that listen.
export function acceptProxyProtocol(
  httpsServer: TlsServer,
  {
    proxyHost,
    headerTimeoutMilliseconds = defaultHeaderTimeoutMilliseconds,
    resolveProxy = resolveHost,
    minimumLookupIntervalMilliseconds = 1_000,
  }: ProxyProtocolOptions,
): Server {
  const clients = new WeakMap<Socket, Client>();
  const fromProxy = proxyAddressCheck(
    proxyHost,
    resolveProxy,
    minimumLookupIntervalMilliseconds,
  );

  // Node.js keeps the connection a TLS socket wraps as _parent. It is not documented, so the tests
  // check the client's address arrives through a real connection.
  httpsServer.on("secureConnection", (tlsSocket: TLSSocket) => {
    const { _parent: connection } = tlsSocket as TLSSocket & {
      _parent?: Socket;
    };
    const client = connection && clients.get(connection);
    if (client !== undefined) {
      Object.defineProperties(tlsSocket, {
        remoteAddress: { value: client.address },
        remoteFamily: { value: client.family },
        remotePort: { value: client.port },
      });
    }
  });

  return createServer((connection) => {
    // A fixed deadline, which a client sending a byte at a time cannot extend.
    const deadline = setTimeout(
      () => connection.destroy(),
      headerTimeoutMilliseconds,
    );
    connection.on("close", () => {
      clearTimeout(deadline);
    });
    // Without a handler, a connection error, such as a client resetting the connection, would
    // stop the whole server.
    connection.on("error", () => connection.destroy());
    // A connection that has already closed has no address, which never matches the proxy.
    const allowed = fromProxy(String(connection.remoteAddress));
    void allowed.then((isProxy) => {
      if (!isProxy) connection.destroy();
    });

    let received = Buffer.alloc(0);
    const readHeader = (chunk: Buffer) => {
      received = Buffer.concat([received, chunk]);
      let header: ProxyHeader | undefined;
      try {
        header = parseProxyHeader(received);
      } catch {
        connection.destroy();
        return;
      }
      if (header === undefined) return;
      const { client, length } = header;
      connection.off("data", readHeader);
      connection.pause();
      void allowed.then((isProxy) => {
        if (!isProxy || connection.destroyed) return;
        // Once the HTTPS server has stopped, it no longer applies its time limits.
        if (!httpsServer.listening) {
          connection.destroy();
          return;
        }
        clearTimeout(deadline);
        // Whatever arrived after the header is returned to the connection for the HTTPS server to
        // read; when nothing did, Node.js ignores the empty buffer.
        connection.unshift(received.subarray(length));
        if (client !== undefined) clients.set(connection, client);
        httpsServer.emit("connection", connection);
      });
    };
    connection.on("data", readHeader);
  });
}
