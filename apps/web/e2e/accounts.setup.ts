// SPDX-License-Identifier: Apache-2.0

// Signs each development account the UI tests use in once a run, through the API rather than the
// sign-in page, so no page snapshot or trace holds the password, and keeps its session.

import { test as setup } from "@playwright/test";
import { accounts, developmentPassword, signedInAs } from "./test-accounts.ts";

// The server allows about six sign-ins a minute, so the list stays short.
for (const { name, email } of accounts) {
  setup(`signs in as ${email}`, async ({ request, baseURL }) => {
    // The server refuses a sign-in that names no origin, as a browser's always does.
    const response = await request.post("/api/auth/sign-in/email", {
      data: { email, password: developmentPassword() },
      headers: { origin: new URL(String(baseURL)).origin },
    });
    if (!response.ok())
      throw new Error(
        `Couldn't sign in as ${email}: ${String(response.status())}`,
      );
    await request.storageState({ path: signedInAs(name) });
  });
}
