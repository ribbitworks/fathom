# Edge Proxy and Network Isolation

- **ADR:** 0003
- **Status:** Accepted
- **Date:** 2026-10-30

## Context

[ADR 0001](0001-tech-stack.md) requires that Fathom's containers cannot reach the internet at runtime, and planned two containers: the application and PostgreSQL. Users must still reach the application.

Docker Compose cannot give one container both. A container on an internal network has no route out, but its ports cannot be published. On a normal network, its ports can be published, but it can reach the internet. Turning off the network's address translation, or using its routed mode, did not stop outbound traffic in testing. Blocking outbound traffic with host firewall rules would depend on the host and container runtime, and could not be tested on development machines.

## Options

- **A pass-through proxy:** A third container, the only one users reach, passes encrypted connections through to the application unchanged. The application keeps the certificate, and the proxy names each user's address with the PROXY protocol.
- **A proxy that ends HTTPS:** The proxy holds the certificate, decrypts every request, and adds the user's address as a header. The application needs no new code, but the proxy sees all data, and the link to the application needs its own encryption.
- **Host firewall rules:** Two containers on a normal network, with outbound traffic blocked on the host.

## Decision

Fathom adds a pass-through proxy, HAProxy, as a third container:

- **The proxy** is on a normal network, with the HTTPS port published, and on an internal network shared with the application. It holds no certificate and cannot read the traffic.
- **The application and the database** are on internal networks with no route out. The database's network is shared with the application and the migration run, not with the proxy.
- **Users' addresses** reach the application in a PROXY protocol header at the start of each connection, which the application reads before HTTPS begins, so request logs and rate limiting see each user.

The [Architecture](../design/architecture.md) shows the result.

## Consequences

- **Neither the application nor the database can reach the internet,** and container tests prove it.
- **The proxy can reach the internet.** It sees only encrypted traffic and has no secrets. Blocking its outbound traffic on the host is left to the host setup.
- **A third container to run and update,** a small operational cost.
- **The application reads the PROXY protocol header itself,** a small piece of code that every connection passes through, so it is fully tested.
