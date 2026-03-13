# Certifier session scripts

Use Playwright to log in once to [app.certifier.io](https://app.certifier.io) and reuse the session.

## First-time setup

```bash
cd /path/to/CertVault
npm install
npx playwright install chromium
```

## 1. Log in once and save session

```bash
npm run certifier:login
```

- A browser window opens to **https://app.certifier.io**
- Log in with your email/password in that window
- When you’re fully logged in, switch back to the terminal and **press Enter**
- Cookies are saved to `.certifier-session.json` (gitignored)

## 2. Open Certifier with saved session

```bash
npm run certifier:run
```

- Loads the saved cookies and opens a browser already logged in
- Use the app as normal; close the window or press Ctrl+C when done

## Optional: use your installed Chrome

In `login-once.js` and `run-with-session.js`, change:

```js
const browser = await chromium.launch({ headless: false });
```

to:

```js
const browser = await chromium.launch({
  headless: false,
  channel: 'chrome',  // use system Chrome
});
```

Then install the Chrome channel: `npx playwright install chrome`

## Session expiry

If Certifier logs you out after a while, run `npm run certifier:login` again to refresh the saved session.
