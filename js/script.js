
// Language: the Dutch pages (/nl/...) have <html lang="nl">. t() picks the right text,
// BASE is the prefix for links to other pages in the same language.
const NL = document.documentElement.lang === 'nl';
const t = (en, nl) => (NL ? nl : en);
const BASE = NL ? '/nl' : '';

// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const mobileNav = document.getElementById('mobileNav');
if (navToggle) {
  navToggle.addEventListener('click', () => {
    const isOpen = mobileNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', isOpen);
  });
  mobileNav.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      mobileNav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

// Footer year
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Booking form.
// Formspree's own redirect (_next) is a paid feature, so we submit via fetch and
// send people to our own thank-you page ourselves. If JavaScript doesn't run, the
// form still posts normally and lands on Formspree's default page - nothing breaks,
// the confirmation is just less pretty.
const bookingForm = document.getElementById('bookingForm');
const formNote = document.getElementById('formNote');
if (bookingForm) {
  bookingForm.addEventListener('submit', async (e) => {
    if (!bookingForm.checkValidity()) return;   // let the browser show its own hints
    e.preventDefault();

    const submitBtn = bookingForm.querySelector('button[type="submit"]');
    const originalLabel = submitBtn ? submitBtn.textContent : null;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = t('Sending...', 'Versturen...'); }
    if (formNote) { formNote.textContent = ''; formNote.classList.remove('form-note-error'); }

    try {
      const res = await fetch(bookingForm.action, {
        method: 'POST',
        body: new FormData(bookingForm),
        headers: { 'Accept': 'application/json' }
      });

      if (res.ok) {
        // carry the chosen artist over, so the thank-you page shows the right press kit
        const target = new URL(BASE + '/thanks', window.location.href);
        const chosen = bookingForm.querySelector('#artist');
        if (chosen && chosen.value) target.searchParams.set('artist', chosen.value);
        window.location.href = target.href;
        return;
      }

      let detail = '';
      try {
        const data = await res.json();
        if (data && Array.isArray(data.errors)) detail = data.errors.map(x => x.message).join(', ');
      } catch (_) { /* no JSON body */ }

      if (formNote) {
        formNote.textContent = detail
          ? (t('Something went wrong: ', 'Er ging iets mis: ') + detail)
          : t('Something went wrong. Please mail Bookings@boons-agency.nl instead.',
              'Er ging iets mis. Mail ons in plaats daarvan op Bookings@boons-agency.nl.');
        formNote.classList.add('form-note-error');
      }
    } catch (_) {
      if (formNote) {
        formNote.textContent = t('No connection. Please check your internet, or mail Bookings@boons-agency.nl.',
                              'Geen verbinding. Check je internet, of mail naar Bookings@boons-agency.nl.');
        formNote.classList.add('form-note-error');
      }
    } finally {
      if (submitBtn) { submitBtn.disabled = false; if (originalLabel) submitBtn.textContent = originalLabel; }
    }
  });
}


// Formspree redirect: resolve the thank-you page against wherever this site is
// actually hosted, so moving to a custom domain needs no edit. The hardcoded
// value in the HTML stays as the fallback if JS doesn't run.
const nextField = document.querySelector('#bookingForm input[name="_next"]');
if (nextField) {
  try {
    nextField.value = new URL(BASE + '/thanks', window.location.href).href;
  } catch (e) { /* keep the hardcoded fallback */ }
}


// Thank-you page: show the press kit of the artist that was requested.
// The value comes from the URL, so it is only ever used to look up a fixed page -
// never written into the page as markup.
const presskitLink = document.getElementById('presskitLink');
const forArtist = document.getElementById('forArtist');
if (presskitLink || forArtist) {
  const PAGES = { GIBBS: BASE + '/gibbs', BURNEY: BASE + '/burney' };
  const raw = new URLSearchParams(window.location.search).get('artist') || '';
  const key = raw.trim().toUpperCase();
  if (forArtist && PAGES[key]) forArtist.textContent = t(' for ', ' voor ') + key;
  if (presskitLink && PAGES[key]) {
    presskitLink.setAttribute('href', PAGES[key]);
    presskitLink.textContent = t(key + ' press kit', 'Press kit van ' + key);
    presskitLink.hidden = false;
  }
}


// Press kit: "Copy" buttons next to the short bios
document.querySelectorAll('.copy-btn[data-copy]').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const source = document.getElementById(btn.dataset.copy);
    if (!source) return;
    // keep paragraph breaks for multi-paragraph bios, tidy the whitespace inside them
    const clean = el => el.textContent.replace(/\s+/g, ' ').trim();
    const paras = source.querySelectorAll('p');
    const text = paras.length ? [...paras].map(clean).join('\n\n') : clean(source);
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = t('Copied', 'Gekopieerd');
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = t('Copy', 'Kopieer'); btn.classList.remove('copied'); }, 1800);
    } catch (_) {
      // clipboard blocked (old browser / insecure context): select the text instead
      const range = document.createRange();
      range.selectNodeContents(source);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  });
});


// Booking form: no event dates in the past
const dateInput = document.getElementById('date');
if (dateInput) {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());   // local date, not UTC
  dateInput.min = now.toISOString().slice(0, 10);
}


// Rider: open the collapsed block when someone follows a link to it (#rider)
function openRiderFromHash() {
  if (window.location.hash !== '#rider') return;
  const details = document.querySelector('#rider details');
  if (details) details.open = true;
}
window.addEventListener('hashchange', openRiderFromHash);
openRiderFromHash();


// Homepage form: pre-select the artist when arriving from an artist page (?artist=GIBBS)
const artistSelect = document.getElementById('artist');
if (artistSelect) {
  const wanted = (new URLSearchParams(window.location.search).get('artist') || '').trim().toUpperCase();
  const match = [...artistSelect.options].find(o => o.value.toUpperCase() === wanted);
  if (match) artistSelect.value = match.value;
}


// Press kit lightbox: click a preview to see the original photo full size.
// Without JavaScript the preview is a plain link to the original, so nothing breaks.
const lightboxLinks = [...document.querySelectorAll('a[data-lightbox]')];
if (lightboxLinks.length) {
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', t('Photo viewer', 'Fotoviewer'));
  box.innerHTML =
    '<button class="lightbox-btn lightbox-close mono" aria-label="' + t('Close', 'Sluiten') + '">✕</button>' +
    '<button class="lightbox-btn lightbox-prev" aria-label="' + t('Previous photo', 'Vorige foto') + '">←</button>' +
    '<figure class="lightbox-stage"><span class="lightbox-loading mono">' + t('Loading full size…', 'Volledige foto laden…') + '</span><img alt=""></figure>' +
    '<button class="lightbox-btn lightbox-next" aria-label="' + t('Next photo', 'Volgende foto') + '">→</button>' +
    '<div class="lightbox-bar"><span class="lightbox-count mono"></span>' +
    '<a class="btn btn-primary btn-small lightbox-dl" download>' + t('Download original ↓', 'Download origineel ↓') + '</a></div>';
  document.body.appendChild(box);

  const img = box.querySelector('img');
  const count = box.querySelector('.lightbox-count');
  const dl = box.querySelector('.lightbox-dl');
  let current = 0, opener = null;

  function show(i) {
    current = (i + lightboxLinks.length) % lightboxLinks.length;
    const link = lightboxLinks[current];
    const preview = link.querySelector('img');
    box.classList.add('is-loading');             // label stays until the original is in
    img.src = preview ? preview.src : '';        // sharp-enough preview straight away...
    const full = new Image();                    // ...swapped for the original once it's in
    full.onload = () => { if (lightboxLinks[current] === link) { img.src = full.src; box.classList.remove('is-loading'); } };
    full.src = link.href;
    img.alt = preview ? preview.alt : '';
    dl.href = link.href;
    dl.setAttribute('download', '');
    count.textContent = (current + 1) + ' / ' + lightboxLinks.length;
  }
  function openBox(i) {
    opener = document.activeElement;
    box.classList.add('open');
    document.body.style.overflow = 'hidden';
    show(i);
    box.querySelector('.lightbox-close').focus();
  }
  function closeBox() {
    box.classList.remove('open');
    document.body.style.overflow = '';
    img.removeAttribute('src');
    if (opener) opener.focus();
  }

  lightboxLinks.forEach((link, i) => link.addEventListener('click', (e) => { e.preventDefault(); openBox(i); }));
  box.querySelector('.lightbox-close').addEventListener('click', closeBox);
  box.querySelector('.lightbox-prev').addEventListener('click', () => show(current - 1));
  box.querySelector('.lightbox-next').addEventListener('click', () => show(current + 1));
  box.addEventListener('click', (e) => { if (e.target === box || e.target.classList.contains('lightbox-stage')) closeBox(); });
  document.addEventListener('keydown', (e) => {
    if (!box.classList.contains('open')) return;
    if (e.key === 'Escape') closeBox();
    if (e.key === 'ArrowLeft') show(current - 1);
    if (e.key === 'ArrowRight') show(current + 1);
  });
  // swipe on phones
  let touchX = null;
  box.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  box.addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
    touchX = null;
  });
}


// Press kit: show one row of photos, the rest behind a "Show all" button,
// so the grid doesn't swallow the page. Without JavaScript every photo shows.
document.querySelectorAll('.photo-grid').forEach(grid => {
  const VISIBLE = 4;
  const cards = grid.querySelectorAll('.photo-card');
  if (cards.length <= VISIBLE) return;
  grid.classList.add('is-collapsed');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-outline photo-more';
  btn.setAttribute('aria-expanded', 'false');
  const label = () => grid.classList.contains('is-collapsed')
    ? t('Show all ' + cards.length + ' photos ↓', 'Toon alle ' + cards.length + " foto's ↓")
    : t('Show fewer ↑', 'Toon minder ↑');
  btn.textContent = label();
  btn.addEventListener('click', () => {
    const collapsing = !grid.classList.contains('is-collapsed');
    grid.classList.toggle('is-collapsed');
    btn.textContent = label();
    btn.setAttribute('aria-expanded', String(!collapsing));
    if (collapsing) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  grid.after(btn);
});
