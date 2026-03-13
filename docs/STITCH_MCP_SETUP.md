# Stitch MCP setup (Cursor)

The Stitch MCP server in Cursor uses **gcloud Application Default Credentials** (API keys are not supported for MCP). Follow these steps so the Stitch MCP works.

## 1. Install Google Cloud CLI

- **macOS:** `brew install google-cloud-sdk`
- Or download from: https://cloud.google.com/sdk/docs/install

## 2. Log in and set project

```bash
gcloud auth application-default login
gcloud config set project YOUR_GCP_PROJECT_ID
gcloud auth application-default set-quota-project YOUR_GCP_PROJECT_ID
```

Use the **Google Cloud project ID** where you want to use Stitch (not the Stitch design project ID like `4117629537245596710`).

## 3. Enable Stitch API

```bash
gcloud services enable stitch.googleapis.com --project=YOUR_GCP_PROJECT_ID
```

Billing must be enabled on the project.

## 4. Set project ID in Cursor MCP config

1. Open **Cursor → Settings → Cursor Settings → Tools & Integrations** (or edit `~/.cursor/mcp.json`).
2. Find the `stitch` server and set `GOOGLE_CLOUD_PROJECT` to your actual GCP project ID (replace `YOUR_GCP_PROJECT_ID`).
3. Save and **restart Cursor**.

## 5. Verify

In terminal:

```bash
npx @_davideast/stitch-mcp doctor --verbose
```

If everything is OK, the Stitch MCP in Cursor should connect. You can then use Stitch tools (e.g. `list_projects`, `get_screen`, `generate_screen_from_text`) from the agent.

## Reference

- Stitch MCP (npm): https://www.npmjs.com/package/@_davideast/stitch-mcp  
- Forum fix (API key not supported): https://discuss.ai.google.dev/t/stitch-mcp-not-working-with-api-key/120933  
