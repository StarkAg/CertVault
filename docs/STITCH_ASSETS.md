# Using Stitch’s design assets in CertVault

## What we can get from Stitch

### 1. Screenshot URLs (designs as images)

Stitch returns a **screenshot** for each screen (full-page PNG). We can use that URL in the app so the **exact Stitch visual** appears on the page.

- **Home (full page):**  
  `https://lh3.googleusercontent.com/aida/AOfcidX937LSKubCC0ofl2ggzdIIlRKgbrsTHyPEl51yymIIJM1nRwLQuffgp8Fpqi8e8aZmyXVd3b6nVf4l-tlDCD9H2afnhBIop7ZMnvSZ1rjW7e_79IR8U4AU6E8VArsRGh0HraDfkfKNjaYTxbJqzeBM39Uva2eOgHHT5s8QHE7KWG2YIMw5Nyv8vYA0pA1XDeR2MrwV9Yu7IlMLPLlQUfDF2stYqScja5TCi94afboTHZNDnbrheh7z8A`
- Size: 2560×9952 (desktop, full scroll).

If the URL loads in the browser (no auth), we can use it in an `<img>` (e.g. show the top part as the hero visual). If it 403s or expires, use option 2.

### 2. Download screenshot manually and host it yourself

1. In Stitch, open the screen and download the screenshot (or use the link above in a browser where you’re signed into the same Google account).
2. Crop the part you need (e.g. hero only) and save under `public/`, e.g.:
   - `public/stitch-hero.png` – hero section
   - `public/stitch-mass-mailing.png` – mass mailing block
3. In the app, use `/stitch-hero.png` etc. in `<img src="...">`. Then you have Stitch’s **exact visuals** with no dependency on Stitch’s URLs.

### 3. HTML export

Stitch also returns an **HTML** export URL for each screen. When we fetch it here, we get a **text summary** of the page (headings, copy, icon names), not the raw HTML/CSS. So from this environment we **cannot**:

- Get the full HTML/CSS to embed or parse.
- Extract Stitch’s exact layout and styles automatically.

To get real HTML/CSS you’d need to:

- Download the HTML from Stitch in a browser (same account) and save the file, or  
- Use any Stitch export that gives a file (e.g. Figma/design export) and work from that.

## Summary

| Asset            | Can we get it here? | How to use it |
|-----------------|----------------------|----------------|
| Screenshot URL  | Yes (from `get_screen`) | Use in `<img src="...">` if URL is public; otherwise download and host under `public/`. |
| Screenshot file | Only if you download it | Save to `public/`, reference as `/stitch-hero.png` etc. |
| HTML/CSS        | No (only text summary) | Download in browser from Stitch and adapt or host the HTML yourself. |

The app is set up to show Stitch’s hero screenshot when the URL loads: see `CertVaultHome.jsx` and the `STITCH_HERO_IMAGE_URL` constant. If the image fails (e.g. 403), a short note suggests saving the screenshot as `public/stitch-hero.png` and using that instead.

**Using the downloaded Stitch HTML/code:** The Home page (`CertVaultHome.jsx`) is built from the Stitch screen-1 HTML in `stitch-assets/screens/screen-1-0a0d98636c3647519db7eeb01a4094ae.html`. The project uses Tailwind CSS and the same CSS variables (e.g. `--apple-bg`, `--apple-accent`) and classes (`.apple-card`, `.floating-cert`, `.bg-mesh`) as the Stitch design. Other pages (For Clubs, How It Works, Verify, Login) can be updated to match their Stitch screen HTML in the same way.
