# Ventarc Stitch HTML Exports

Raw HTML for all screens in the **Ventarc** Stitch project (`projects/4726697925696762711`), downloaded via curl from each screen’s `htmlCode.downloadUrl`.

**Used in the site:** Copies of these files live in **`public/ventarc/`** and are linked from the app. The home page header links to `/ventarc/ventarc-features-dark.html`, `/ventarc/ventarc-solutions-dark.html`, etc. Nav inside each Stitch page links back to `/` (home), `/login`, `/dashboard`, and to the other Ventarc pages.

## Files (9 screens)

| File | Stitch title | Size |
|------|----------------------|------|
| `ventarc-event-management-landing-pages-mobile.html` | Ventarc Event Management Landing Pages | 390×884 (MOBILE) |
| `ventarc-home-dark.html` | Ventarc Home (Dark Mode) | 2560×7504 |
| `ventarc-features-dark.html` | Ventarc Features (Dark Mode) | 2560×4678 |
| `ventarc-features-obsidian.html` | Ventarc Features (Obsidian Mode) | 2560×7772 |
| `ventarc-solutions-dark.html` | Ventarc Solutions (Dark Mode) | 2560×7106 |
| `ventarc-solutions-obsidian.html` | Ventarc Solutions (Obsidian Mode) | 2560×8228 |
| `ventarc-pricing-dark.html` | Ventarc Pricing (Dark Mode) | 2560×4770 |
| `ventarc-pricing-obsidian.html` | Ventarc Pricing (Obsidian Mode) | 2560×5870 |
| `ventarc-resources-dark.html` | Ventarc Resources (Dark Mode) | 2560×5694 |

## How these were downloaded

1. List screens: Stitch MCP `list_screens` with `projectId: "4726697925696762711"`.
2. From each screen’s `htmlCode.downloadUrl`, run:
   ```bash
   curl -sL "<downloadUrl>" -o "<filename>.html"
   ```
3. Filenames were derived from each screen’s `title` (lowercase, spaces → hyphens, parentheses kept for Dark/Obsidian).

## Re-downloading later

Get fresh URLs from Stitch:

```bash
# In Cursor, call Stitch MCP:
# list_screens(projectId: "4726697925696762711")
# Then for each screen.htmlCode.downloadUrl, run:
cd stitch-ventarc-html
curl -sL "URL_HERE" -o "screen-name.html"
```

Or use the URLs stored in `docs/STITCH_VENTARC_PROJECT.md` if you add them there after each list_screens run.
