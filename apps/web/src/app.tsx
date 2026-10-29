// SPDX-License-Identifier: Apache-2.0

// Fathom's page: shows the greeting the server reads from the database, while it loads, and when it
// cannot be loaded. Styles come from the stylesheet, since the security policy blocks inline styles.

import { useQuery } from "@tanstack/react-query";
import { fetchGreeting } from "./greeting.ts";

function Greeting() {
  const greeting = useQuery({ queryKey: ["greeting"], queryFn: fetchGreeting });
  if (greeting.isPending) return <p role="status">Loading…</p>;
  if (greeting.isError) {
    return (
      <p role="alert">
        Fathom could not reach its server. Try again in a moment.
      </p>
    );
  }
  return <p className="greeting">{greeting.data.greeting}</p>;
}

export function App() {
  return (
    <main>
      <h1>Fathom</h1>
      <Greeting />
    </main>
  );
}
