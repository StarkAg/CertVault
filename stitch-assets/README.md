# Stitch assets – CertVault project

Project **CertVault** (ID: `4117629537245596710`).  
Screens downloaded via Stitch MCP `get_screen` and `curl -L`.

## Screens

| # | Screen ID | Files | Notes |
|---|-----------|--------|--------|
| 1 | `0a0d98636c3647519db7eeb01a4094ae` | `.png`, `.html` | Animated premium home (tall) |
| 2 | `3a76ae915b4441689f3a46ae348a1243` | `.png`, `.html` | Hero section |
| 3 | `891cac576f904ad0b544bc9636b4801e` | `.png`, `.html` | How it works |
| 4 | `91b81c72719a4a86a579345ed06e94c1` | `.png`, `.html` | Verify certificate |
| 5 | `a587e214095b476085c9f29dff803add` | `.png`, `.html` | Club login |
| 6 | `d55415446cfd4e25a3db1c3a130d46b8` | `.png`, `.html` | Comprehensive home |
| 7 | `fc11b6e85096415c8a5f87bde379dd35` | `.png`, `.html` | For clubs |

## Files

- **`screens/screen-N-<screenId>.png`** – Screenshot (thumbnail from Google CDN; ~132–512px on a side).
- **`screens/screen-N-<screenId>.html`** – Full HTML export: Tailwind CSS, Material Symbols, inline styles. Open in a browser or use as reference for layout and styles.

## Using the HTML

The `.html` files are standalone pages (Tailwind CDN, fonts, CSS variables). You can:

- Open any `.html` in a browser to view the design.
- Copy sections or styles into the CertVault React app.
- Reuse CSS variables (e.g. `--apple-bg`, `--apple-accent`) and class patterns.

## Re-downloading

From project root:

```bash
cd stitch-assets/screens
# Screenshot (may be thumbnail without auth)
curl -L -o "screen-1-0a0d98636c3647519db7eeb01a4094ae.png" "https://lh3.googleusercontent.com/aida/..."
# HTML
curl -L -o "screen-1-0a0d98636c3647519db7eeb01a4094ae.html" "https://contribution.usercontent.google.com/download?c=..."
```

Use the URLs returned by Stitch MCP `get_screen` for each screen.
