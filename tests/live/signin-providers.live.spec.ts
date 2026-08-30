import { test, expect } from '@playwright/test';
import { PROVIDERS, SIGNUP } from '../../src/signin/providers';

// @live: do the registered providers still exist, still speak OAuth, and still
// have the signup posture we claim? (docs/DESIGN.md § Flows › Sign in.)
//
// The registry is hardcoded on purpose: the sheet paints synchronously, and
// probing four third-party servers on the front door to avoid drift would be a
// bad trade. The drift lives here instead — the pattern forage established in
// e2e/hosts-live.workflow.mjs. Hardcoded facts about someone else's service rot
// silently. Local-only (`npm run e2e:live`); never in push CI.
//
// A host that is DOWN and a host that CHANGED are different findings: the
// first is not our regression, so it is reported and skipped, not failed.
for (const p of PROVIDERS) {
  test(`@live ${p.id}: ${p.entryway} still matches the registry`, async ({ request }) => {
    const desc = await request.get(`${p.entryway}/xrpc/com.atproto.server.describeServer`, { timeout: 15_000 });
    test.skip(!desc.ok(), `${p.id} unreachable (describeServer ${desc.status()}) — not our regression`);
    const d = (await desc.json()) as { inviteCodeRequired?: boolean };
    const posture = d.inviteCodeRequired ? SIGNUP.INVITE : SIGNUP.OPEN;
    expect(posture, `${p.id}: we say '${p.signups}', the server says '${posture}' — update src/signin/providers.json`).toBe(p.signups);

    const oauth = await request.get(`${p.entryway}/.well-known/oauth-authorization-server`, { timeout: 15_000 });
    expect(oauth.ok(), `${p.id}: no oauth-authorization-server (${oauth.status()})`).toBe(true);
    const meta = (await oauth.json()) as { prompt_values_supported?: string[]; scopes_supported?: string[]; issuer?: string };
    expect(meta.prompt_values_supported ?? [], `${p.id}: no longer advertises prompt=create — the Create/Sign-in split is a lie for this host`).toContain('create');
    expect(meta.scopes_supported ?? [], `${p.id}: dropped the transition:generic scope we request`).toContain('transition:generic');

    // The build allowlists each ENTRYWAY in connect-src on the strength of the
    // provider being its own authorization server. If that stops being true,
    // discovery would pass and PAR would be CSP-refused — on a phone, silently.
    const pr = await request.get(`${p.entryway}/.well-known/oauth-protected-resource`, { timeout: 15_000 });
    if (pr.ok()) {
      const servers = ((await pr.json()) as { authorization_servers?: string[] }).authorization_servers ?? [];
      expect(servers.map((s) => s.replace(/\/+$/, '')), `${p.id}: authorization server moved off the entryway — connect-src no longer covers PAR/token`).toContain(p.entryway);
    }
  });
}
