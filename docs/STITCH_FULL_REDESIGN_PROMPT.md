# CertVault Full Website Redesign — Stitch Prompt (Enhanced)

Use this prompt with Stitch MCP `generate_screen_from_text` for a premium Apple-style redesign with animations and mass mailing.

---

## Title

**CertVault — Premium Apple-style Website Redesign with Animations**

---

## Prompt (copy into Stitch)

Design a complete, cohesive CertVault website redesign in a premium Apple-like style.

CertVault is a certificate issuance and verification platform for clubs and organizations: they create events, add participants via CSV, generate certificates with unique IDs, send certificates to recipients, and anyone can verify certificates publicly by ID.

The platform also supports **mass emailing certificates to participants automatically**.

Create a full desktop layout showing the entire site experience, including landing sections and product pages.

The result should feel like Apple.com level product marketing: minimal, elegant, spacious, with subtle motion and polished visuals.

**Desktop width:** 2560px

---

### Design System

Apply consistently across the entire site.

**Color System**

| Role | Color |
|------|--------|
| Background | #fafafa |
| Card Surface | #ffffff |
| Primary Text | #1d1d1f |
| Secondary Text | #6e6e73 |
| Muted Text | #86868b |
| Accent Color | #0071e3 |

Accent is used sparingly for buttons, links, highlights. Use best colors for contrast and premium feel.

**Typography**

- **Font stack:** -apple-system, SF Pro Display, Segoe UI
- **Hero Headline:** 56px, semibold, letter-spacing -0.02em
- **Section Headline:** 40px
- **Body text:** 17–19px, line-height 1.47
- **Small labels:** 13px uppercase, letter-spacing 0.06em

**Components**

- **Buttons:** radius 12px, padding 14–17px
- **Cards:** radius 18px, border 1px solid #e8e8ed, shadow 0 2px 8px rgba(0,0,0,0.04)
- **Inputs:** radius 12px, clean Apple-like forms

**Spacing**

- Section vertical padding: 80–120px
- Max content width: Hero 720px, Sections 980px
- Large whitespace everywhere.

---

### Motion & Animation System

Subtle premium animations inspired by Apple product pages.

**Scroll animations:**
- Fade-in + upward movement
- Section reveals
- Staggered card appearance

**Hover animations:**
- Buttons slightly darken
- Cards lift slightly
- Links animate underline

**Background motion:**
- Slow gradient shifts
- Soft parallax shapes
- Floating certificate cards

**Hero visuals may include:**
- Certificate cards floating slowly
- ID verification animation
- Certificate issuing animation

Animations should remain clean and restrained, never flashy.

---

### Global Header

Sticky header.

- **Left:** CertVault logo
- **Center tagline:** "Distributed by CertVault"
- **Right navigation:** Home, How It Works, For Clubs, Verify Certificate, Login

Minimal Apple-style navigation. Active page uses accent blue.

---

### Home Page

**Hero Section**

Centered layout.

- **Headline:** "Your achievements, securely anchored."
- **Subline:** "The definitive vault for professional certifications and credentials."
- **Buttons:** Primary "Get Started", Secondary "View Demo"
- **Hero visual concept:** Floating certificate cards with unique IDs. Background subtle motion gradient.

**Trusted By**

- Label: "Trusted by clubs & organizations"
- Logos / text marks: IEEE SRM, GradeX, Student Clubs
- Minimal grayscale logos.

**The Complete Certificate Platform**

3 feature cards side-by-side.

1. **Digital Certificates** — Issue certificates with unique IDs and host them online.
2. **Public Verification** — Anyone can verify certificates instantly using the certificate ID.
3. **Bulk Generator** — Upload CSV files to generate hundreds of certificates instantly.

Each card: title, description, "Learn more" link.

**Mass Mailing System (NEW FEATURE)**

- Section title: "Send certificates instantly to everyone."
- Show how clubs can: Upload participant list → Generate certificates → Automatically email certificates to recipients
- Features: Automatic certificate email delivery, Custom email templates, Bulk mailing system, Delivery tracking, Cloud storage links
- Include illustration of email sending workflow.
- CTA: "Send Certificates Automatically"

**How It Works**

Four steps displayed horizontally.

1. **Design** — Upload or design certificate templates.
2. **Generate** — Upload participant CSV and generate certificates.
3. **Send** — CertVault automatically emails certificates to participants.
4. **Verify** — Anyone can verify authenticity using certificate ID.

Include simple icons and connecting line.

**Bulk Certificate Generator**

- Feature highlights with checkmarks: Upload CSV participant lists, Generate hundreds of certificates instantly, Unique ID for each certificate, Cloudinary export, Mass email delivery
- Primary CTA: Club Login

**Benefits**

Three cards: Save Time (Automate certificate creation), Verifiable (Unique IDs prevent fraud), Professional (Deliver polished digital certificates).

**FAQ**

Accordion style. Example questions: How do certificate IDs work, Is verification public, Can clubs revoke certificates. Smooth expand animations.

**Final CTA**

- Headline: "Ready to issue certificates?"
- Subline encouraging clubs to start.
- Buttons: "Start for free", "Verify Certificate"

---

### For Clubs Page

- Title: "For Clubs & Organizations"
- Lead paragraph explaining CertVault.
- Feature list: Create certificate events, Upload participants via CSV, Generate certificates with unique IDs, Send certificates through mass email, Manage, track, and revoke certificates
- Include dashboard preview illustration.
- Disclaimer card. Primary CTA: Club Login

---

### How It Works Page

- Title: "How CertVault Works"
- Short intro. Step list: Organizations create events, Upload CSV, CertVault generates unique IDs, Certificates sent via email, Anyone can verify publicly.
- Buttons: Verify Certificate, For Clubs

---

### Verify Certificate Page

- Title: Verify Certificate
- Description: Enter a certificate ID to confirm authenticity.
- Input: Certificate ID field, Primary button "Verify"
- Result states: Valid (recipient, event, date, Verified badge), Invalid (Certificate not found), Revoked (Certificate revoked warning)

---

### Login / Signup Page

- Centered card. Title: Club Login. Subtitle: Access your club dashboard.
- Form: Email, Password; Signup adds Club Name.
- Primary button: Login / Create Account. Link to toggle login/signup. Error message area. Max width 400px.

---

### Visual Style Guidance

Use premium product-style visuals: floating certificates, verification UI mockups, email automation illustration, dashboard preview. Images should feel like Apple product graphics—clean and modern. Use best colors for contrast and premium feel.

---

### Deliverable

Produce one comprehensive desktop design showing: Design system, All landing sections, Feature explanations, All pages (Home, For Clubs, How It Works, Verify, Login).

Everything should feel like a premium SaaS product website with elegant motion and minimal design.

**Desktop only. 2560px width. Clean, premium, minimal.**

---

## Usage

- **Stitch projectId:** `4117629537245596710`
- **Tool:** `generate_screen_from_text`
- **Parameters:** `projectId`, `prompt` (the Prompt section above), `deviceType: "DESKTOP"`
