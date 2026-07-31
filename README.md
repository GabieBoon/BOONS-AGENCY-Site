# BOONS AGENCY — website

Static site (HTML/CSS/JS), ready for GitHub Pages with the custom domain `boons-agency.nl`.

## What's in here

```
index.html          → the site
css/style.css        → all styling
js/script.js          → mobile nav, artist modals, form handling
assets/images/        → logo, artist photos
assets/video/          → hero background video
CNAME                → tells GitHub Pages to serve boons-agency.nl
```

## 1. Push to GitHub

```bash
cd boons-agency-site
git init
git add .
git commit -m "Init BOONS AGENCY site"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

## 2. Turn on GitHub Pages

1. Go to your repo → **Settings → Pages**.
2. Under "Build and deployment", choose **Deploy from a branch**.
3. Branch: `main`, folder: `/ (root)`. Save.
4. After a minute your site is live at `https://<your-username>.github.io/<repo-name>/`.

## 3. Point your domain (boons-agency.nl)

There's already a `CNAME` file in the root of this project containing `boons-agency.nl`,
so GitHub picks it up automatically — but double check under
**Settings → Pages → Custom domain** that it shows `boons-agency.nl`.

At your domain registrar, add these DNS records:

**For the apex domain (boons-agency.nl):**
```
A     @     185.199.108.153
A     @     185.199.109.153
A     @     185.199.110.153
A     @     185.199.111.153
```

**For www (optional, recommended):**
```
CNAME   www   <your-username>.github.io.
```

This can take up to 24 hours to propagate. Once it's active, check
**Enforce HTTPS** in Settings → Pages (GitHub issues the certificate for free).

## 4. Make the contact form work (Formspree)

The booking form in `index.html` currently points to:
```
action="https://formspree.io/f/YOUR_FORM_ID"
```

1. Create a free account at [formspree.io](https://formspree.io) and make a new form.
2. Copy your form ID and replace `YOUR_FORM_ID` in `index.html` with it.
3. Submit the form once live so Formspree can verify your email address.

## Notes

- Artist photos were compressed to JPEG to keep the site fast; the logo stays PNG for
  transparency.
- The roster tiles open a "backstage pass" style modal for each artist — click GIBBS or
  BURNEY to see it.
