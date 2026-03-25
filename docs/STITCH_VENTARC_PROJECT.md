# Stitch – Ventarc Landing Page Project

New Stitch project for the **Ventarc** SaaS landing (dark, premium, Stripe/Linear/Vercel style).

## Project

| Field | Value |
|-------|--------|
| **Project name** | `projects/4726697925696762711` |
| **Title** | Ventarc |
| **Visibility** | PRIVATE |
| **Project type** | PROJECT_DESIGN |

## All screens – HTML downloaded with curl

All Ventarc screens’ HTML is in **`stitch-ventarc-html/`**, one file per screen:

| File | Stitch title |
|------|----------------------|
| `ventarc-event-management-landing-pages-mobile.html` | Ventarc Event Management Landing Pages (MOBILE) |
| `ventarc-home-dark.html` | Ventarc Home (Dark Mode) |
| `ventarc-features-dark.html` | Ventarc Features (Dark Mode) |
| `ventarc-features-obsidian.html` | Ventarc Features (Obsidian Mode) |
| `ventarc-solutions-dark.html` | Ventarc Solutions (Dark Mode) |
| `ventarc-solutions-obsidian.html` | Ventarc Solutions (Obsidian Mode) |
| `ventarc-pricing-dark.html` | Ventarc Pricing (Dark Mode) |
| `ventarc-pricing-obsidian.html` | Ventarc Pricing (Obsidian Mode) |
| `ventarc-resources-dark.html` | Ventarc Resources (Dark Mode) |

See `stitch-ventarc-html/README.md` for how they were downloaded (list_screens → curl per htmlCode.downloadUrl).

## Generated screen

| Field | Value |
|-------|--------|
| **Screen name** | `projects/4726697925696762711/screens/c1986be545ab4009a7cbc7f8a95ec6fa` |
| **Title** | Ventarc Landing Page |
| **Size** | 2560 × 7236 px (full-page scroll) |
| **Theme** | DARK, Inter, ROUND_EIGHT, accent `#0d20f2` |
| **Agent** | HATTER_AGENT |

## Design summary (from Stitch)

- **Hero:** Headline “Run Events. Without the Chaos.”, subtext, dual CTAs (Get Started, Host an Event), subtle dot-grid background.
- **Features grid:** Five glassmorphism cards: Smart Registrations, QR Check-in, Mass Emailing, CertVault, Live Dashboard.
- **How it works:** Horizontal stepper with four steps (Create Event → Invite → Run Event → Issue Certificates).
- **Why Ventarc:** “Built for Modern Event Organizers” with benefit cards/icons.
- **CertVault highlight:** “Certificates You Can Trust” + certificate mock (name, date, Verified badge).
- **Final CTA:** “Make Your Next Event Effortless” + Start Free / Book Demo.
- **Footer:** Ventarc, “Event Management, Reimagined.”, links (How it works, Verify, Login).

## Assets

- **Screenshot:** [Stitch FIFE URL](https://lh3.googleusercontent.com/aida/ADBb0ujnBvwrrLaW8hvz66qf7vVldGIHjAYJb5QiRj3tI2_9hEtbCYqLwI7xyK9IN52L5g0UeN4zayJg_M3ia7NWKjbqurWZlLe0nK4tJs4vorkCKo0mZFgVigyoDDF1qIB5G2p4vuLCsPJVCoJ8OLk9WNq2SCLLW1uA4t-thsPImU7-Lz052LEYczRTMIK0320jC-Za-c2scavMdh_Th9kVnklebVSHvQP5ciDgj3EBgCPh515sOsXlpjZgQdU)
- **HTML export:** Available via Stitch file download (HTML code asset for the screen).

## 3D Motion Hero (Stitch)

A second screen was generated for an **advanced 3D moving** hero.

| Field | Value |
|-------|--------|
| **Screen name** | `projects/4726697925696762711/screens/af3b4dcbea3844c0b483a38bd7ee4672` |
| **Title** | Ventarc 3D Motion Hero |
| **Size** | 2560 × 2090 px |
| **Screenshot** | [Preview](https://lh3.googleusercontent.com/aida/ADBb0ui-jSfjVTATG-mMPnOF8508yVpgzeTUEeafvoqCdZfWQWivl-4qcBo1qhK8rEZqsgeD1fWjCElt6tQXf1RLM2PlTAtqnZDpS2-lLBt94V0Jup0TC-srLqNrWNjJnwBhjkJmG2RmACU1vMrd60lwoPn7-X-3WOd27gzWXzFHXG8RaEWIqBJhiYIjcp6c7tO9feJxREQxbpLqpe_x8v1iSPTke_3dX89S578512yPdwTxfhaX66yAIHq2jxU) |

### Full prompt (copy-paste for Stitch)

Use this in **Stitch → Generate from text** (project `4726697925696762711`, device DESKTOP) to get an advanced 3D motion hero:

```
Design a stunning hero section for Ventarc with an advanced 3D motion aesthetic. The whole scene should feel alive and premium.

3D MOTION & DEPTH:
- Multiple floating 3D-style orbs or spheres in purple and blue gradients, at different depths (foreground, mid, background), some larger and softer, some smaller and brighter. They should appear to drift or float slowly.
- Layered depth: use blur and scale to create parallax (closer elements sharper and larger, far elements softer and smaller).
- Optional: subtle grid or mesh plane in perspective (fading into the distance) to add tech/futuristic depth.
- Glowing gradient blobs or liquid shapes that feel like they are slowly moving or morphing.
- Light rays or soft volumetric beams in purple/blue for a premium 3D atmosphere.
- Consider a floating certificate or event-card shape in 3D space with soft shadow, as a product hint.

HERO CONTENT (on top of the 3D background):
- Headline: "Run Events. Without the Chaos." — large, bold, with a slight glass or gradient text treatment if it fits.
- Subtext: "Ventarc is your all-in-one platform to manage events — from registrations and QR check-ins to automated emails and verified certificates."
- Two CTAs: primary "Get Started", secondary outline "Host an Event".
- Content in a clear visual layer above the motion (glassmorphism card or clear typography hierarchy) so it stays readable.

STYLE:
- Dark theme (deep navy or black) with purple and blue as accent colors.
- Smooth, cinematic feel — like Apple or Stripe hero sections but with more 3D movement and depth.
- Inter or similar modern sans-serif.
- Rounded corners, soft shadows, glassmorphism where it helps separate content from the 3D background.
- The 3D elements should animate or suggest motion (motion blur hints, or overlapping layers that imply movement).

Deliver a single hero screen that looks like a high-end SaaS landing with real 3D moving elements: orbs, gradients, depth, and motion. Desktop, full-width hero.
```

### Implementation in app

The **exact** Stitch design is used on the home page:

- **Source:** `stitch-ventarc-hero.html` (downloaded from Stitch HTML export) and translated to React in `src/components/CertVaultHome.jsx`.
- **CSS:** Stitch classes (`.stitch-glass`, `.stitch-glass-card`, `.stitch-orb`, `.stitch-perspective-grid`, `.stitch-text-gradient`) are in `src/index.css`.
- **Font:** Inter is loaded in `index.html` to match Stitch.
- The home route (`/`) does **not** use `CertVaultLayout` so the Stitch header and hero are the only chrome; nav links point to `/login`, `/for-clubs`, `/how-it-works`, `/verify`.

### Stitch suggestions for this screen

1. Add a feature section with the same 3D style.
2. Change the orbs to liquid chrome shapes.
3. Make the headline even more bold and glass-like.

---

## Stitch suggestions for next steps (original landing)

1. Add a pricing section with three tiers.
2. Make the blue and purple gradients more vibrant.
3. Create a mobile version of the landing page.
4. Add a testimonials section from hackathon hosts.

## Using in Cursor

- Open the project in Stitch (Google AI Studio / Stitch UI) with project ID **4726697925696762711**.
- Use `get_screen` with screen name above to fetch latest HTML/screenshot.
- Use `edit_screens` or `generate_screen_from_text` to add variants (e.g. pricing, testimonials, mobile).
