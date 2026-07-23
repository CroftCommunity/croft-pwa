import { test, expect } from '@playwright/test';

// Hermetic: mock the AppView + PLC directory so the real read module runs with
// no network. Proves the demo wires resolve → read → render correctly.
test('atproto demo resolves a handle and shows DID/PDS/profile', async ({ page }) => {
  await page.route('**/xrpc/com.atproto.identity.resolveHandle*', (route) =>
    route.fulfill({ json: { did: 'did:plc:demo123' } }),
  );
  await page.route('**/plc.directory/did:plc:demo123', (route) =>
    route.fulfill({
      json: {
        id: 'did:plc:demo123',
        service: [
          { id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.example.test' },
        ],
      },
    }),
  );
  await page.route('**/xrpc/app.bsky.actor.getProfile*', (route) =>
    route.fulfill({ json: { did: 'did:plc:demo123', handle: 'demo.test', displayName: 'Demo Account' } }),
  );

  await page.goto('/atproto.html');
  await page.locator('[data-testid="handle-input"]').fill('demo.test');
  await page.locator('[data-testid="resolve-button"]').click();

  const result = page.locator('[data-testid="resolve-result"]');
  await expect(result).toContainText('did:plc:demo123');
  await expect(result).toContainText('https://pds.example.test');
  await expect(result).toContainText('Demo Account');
});

test('sealed-box demo seals a message and opens it (real WebCrypto)', async ({ page }) => {
  await page.goto('/atproto.html');
  await page.locator('[data-testid="seal-input"]').fill('the eagle lands at dawn');
  await page.locator('[data-testid="seal-button"]').click();
  const result = page.locator('[data-testid="seal-result"]');
  await expect(result).toContainText('ciphertext');
  await expect(page.locator('[data-testid="seal-recovered"]')).toContainText('the eagle lands at dawn');
});

test('atproto demo shows a friendly error when resolution fails', async ({ page }) => {
  await page.route('**/xrpc/com.atproto.identity.resolveHandle*', (route) =>
    route.fulfill({ status: 400, json: {} }),
  );
  await page.goto('/atproto.html');
  await page.locator('[data-testid="resolve-button"]').click();
  await expect(page.locator('[data-testid="resolve-result"]')).toContainText('Could not resolve');
});

// OAuth sign-in — hermetic end-to-end. The whole discovery→PAR→authorize→token
// chain is mocked on CSP-allowlisted hosts (bsky.social + *.host.bsky.network),
// so the real begin→redirect→callback→token-exchange path runs unmodified
// through the page's own code. Only the live consent screen and server-side
// DPoP validation are out of scope here (skylite's proven pattern).
test.describe('OAuth sign-in (PKCE + PAR + DPoP)', () => {
  const DID = 'did:plc:alice';
  const PDS = 'https://pds.host.bsky.network';
  const AUTH = 'https://bsky.social';

  test('signs in with a handle and completes the token exchange', async ({ page }) => {
    let parState = '';
    let parRedirect = '';

    await page.route('**/xrpc/com.atproto.identity.resolveHandle*', (route) => route.fulfill({ json: { did: DID } }));
    await page.route(`**/plc.directory/${DID}`, (route) =>
      route.fulfill({
        json: { id: DID, service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: PDS }] },
      }),
    );
    await page.route('**/.well-known/oauth-protected-resource', (route) =>
      route.fulfill({ json: { authorization_servers: [AUTH] } }),
    );
    await page.route('**/.well-known/oauth-authorization-server', (route) =>
      route.fulfill({
        json: {
          issuer: AUTH,
          authorization_endpoint: `${AUTH}/oauth/authorize`,
          token_endpoint: `${AUTH}/oauth/token`,
          pushed_authorization_request_endpoint: `${AUTH}/oauth/par`,
        },
      }),
    );
    await page.route('**/oauth/par', (route) => {
      const params = new URLSearchParams(route.request().postData() ?? '');
      parState = params.get('state') ?? '';
      parRedirect = params.get('redirect_uri') ?? '';
      void route.fulfill({ status: 201, json: { request_uri: 'urn:ietf:params:oauth:request_uri:abc', expires_in: 60 } });
    });
    await page.route('**/oauth/authorize*', (route) => {
      const back = new URL(parRedirect);
      back.searchParams.set('code', 'AUTH_CODE');
      back.searchParams.set('state', parState);
      back.searchParams.set('iss', AUTH);
      void route.fulfill({ status: 302, headers: { location: back.toString() } });
    });
    await page.route('**/oauth/token', (route) =>
      route.fulfill({ json: { access_token: 'ACCESS', refresh_token: 'REFRESH', token_type: 'DPoP', sub: DID } }),
    );

    await page.goto('/atproto.html');
    await page.locator('[data-testid="signin-handle-input"]').fill('alice.test');
    await page.locator('[data-testid="signin-button"]').click();

    await expect(page.locator('[data-testid="signin-did"]')).toContainText(DID);
    // The callback params are stripped so a refresh doesn't replay the exchange.
    await expect(page).toHaveURL(/atproto\.html$/);

    // ...and, signed in, write a DPoP record to the (mocked) repo.
    await page.route(`${PDS}/xrpc/com.atproto.repo.createRecord`, (route) =>
      route.fulfill({ json: { uri: `at://${DID}/ing.croft.croftpwa.note/rkey123`, cid: 'bafy' } }),
    );
    await page.locator('[data-testid="write-input"]').fill('e2e note');
    await page.locator('[data-testid="write-button"]').click();
    await expect(page.locator('[data-testid="write-uri"]')).toContainText('ing.croft.croftpwa.note/rkey123');
  });

  test('a normal load is not treated as a callback', async ({ page }) => {
    await page.goto('/atproto.html');
    await expect(page.locator('[data-testid="signin-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="signin-did"]')).toHaveCount(0);
  });

  test('the write demo asks you to sign in first', async ({ page }) => {
    await page.goto('/atproto.html');
    await page.locator('[data-testid="write-button"]').click();
    await expect(page.locator('[data-testid="write-result"]')).toContainText('Sign in above first');
  });
});

test('vault demo wraps a key behind a passphrase and unlocks it (real WebCrypto)', async ({ page }) => {
  await page.goto('/atproto.html');
  await page.locator('[data-testid="vault-button"]').click();
  await expect(page.locator('[data-testid="vault-status"]')).toContainText('unlocked', { timeout: 15_000 });
});
