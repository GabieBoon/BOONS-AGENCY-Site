
// Language: the Dutch pages (/nl/...) have <html lang="nl">. t() picks the right text,
// BASE is the prefix for links to other pages in the same language.
const NL = document.documentElement.lang === 'nl';
const t = (en, nl) => (NL ? nl : en);
const BASE = NL ? '/nl' : '';

// Visitor stats (GoatCounter, cookieless): events show up next to the pages in the dashboard.
// Downloads, press kit photos and the share button count themselves via data-goatcounter-click;
// track() covers the rest. sendBeacon in count.js makes it survive a page change.
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const PAGE = slug(location.pathname.replace(/^\/nl/, '').replace(/\.html$/, '')) || 'home';
const track = (name, title) => {
  if (window.goatcounter && typeof window.goatcounter.count === 'function') {
    window.goatcounter.count({ path: name, title: title || name, event: true });
  }
};

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

    // Reference like BOONS-2609-4821 (year, month, 4 random digits): it goes into the
    // subject of Finn's email and onto the thank-you page, so both sides can refer to it.
    const val = id => { const el = bookingForm.querySelector('#' + id); return el ? el.value.trim() : ''; };
    const now = new Date();
    const rand = window.crypto && crypto.getRandomValues
      ? crypto.getRandomValues(new Uint32Array(1))[0] % 10000
      : Math.floor(Math.random() * 10000);
    const ref = 'BOONS-' + String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0')
      + '-' + String(rand).padStart(4, '0');
    const data = new FormData(bookingForm);
    data.set('reference', ref);
    data.set('_subject', 'Booking request ' + ref + ': ' + [val('artist'), val('date'), val('event')].filter(Boolean).join(', '));

    try {
      const res = await fetch(bookingForm.action, {
        method: 'POST',
        body: data,
        headers: { 'Accept': 'application/json' }
      });

      if (res.ok) {
        // carry the chosen artist over, so the thank-you page shows the right press kit
        const target = new URL(BASE + '/thanks', window.location.href);
        const chosen = bookingForm.querySelector('#artist');
        if (chosen && chosen.value) target.searchParams.set('artist', chosen.value);
        target.searchParams.set('ref', ref);
        // the summary on the thank-you page; sessionStorage is gone when the tab closes
        try {
          sessionStorage.setItem('boons-request', JSON.stringify({
            ref, artist: val('artist'), date: val('date'), event: val('event'), city: val('city'), email: val('email')
          }));
        } catch (_) { /* storage blocked: the page just shows the reference */ }
        track('booking-sent-' + slug(chosen && chosen.value ? chosen.value : 'unknown'), 'Booking request sent');
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


// Thank-you page: reference number, a summary of the request and "Save a copy" (print / PDF).
// Everything is written with textContent, so nothing from the URL or storage becomes markup.
const passRef = document.getElementById('passRef');
if (passRef) {
  const ref = new URLSearchParams(window.location.search).get('ref') || '';
  if (/^BOONS-\d{4}-\d{4}$/.test(ref)) {
    passRef.textContent = ref;
    let req = null;
    try { req = JSON.parse(sessionStorage.getItem('boons-request') || 'null'); } catch (_) { /* no storage */ }
    const summary = document.getElementById('requestSummary');
    if (summary && req && req.ref === ref) {
      const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text || '–'; };
      let when = req.date;
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(req.date || '');
      if (m) {
        when = new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString(NL ? 'nl-NL' : 'en-GB',
          { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
      }
      set('sumRef', ref);
      set('sumArtist', req.artist);
      set('sumDate', when);
      set('sumEvent', [req.event, req.city].filter(Boolean).join(', '));
      set('sumEmail', req.email);
      summary.hidden = false;
      const save = document.getElementById('saveCopy');
      if (save) {
        save.hidden = false;
        save.addEventListener('click', () => { track('request-saved', 'Request copy saved'); window.print(); });
      }
    }
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
    img.src = preview ? (preview.currentSrc || preview.src) : '';   // sharp-enough preview straight away...
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


// 404 page on a /nl/ address: send the header and footer links to the Dutch pages too
if (NL && document.body.classList.contains('page-404')) {
  document.querySelectorAll('.site-header a[href^="/"], .mobile-nav a[href^="/"], .site-footer a[href^="/"]').forEach(a => {
    const href = a.getAttribute('href');
    if (!href.startsWith('/nl/') && !/^\/(assets|css|js)\//.test(href)) a.setAttribute('href', '/nl' + href);
  });
}


// "On the floor" clip player: one clip at a time, the next one starts when a clip ends.
// Plays only while on screen (saves data and battery). Clips start muted, because browsers
// only autoplay without sound; once someone turns the sound on, it stays on for the next clip.
// People who ask for reduced motion get the posters and start a clip themselves.
const clipPlayer = document.getElementById('clipPlayer');
if (clipPlayer) {
  const videos = [...clipPlayer.querySelectorAll('.clip-video')];
  const tabs = [...clipPlayer.querySelectorAll('.clip-tab')];
  const soundBtn = clipPlayer.querySelector('.clip-sound');
  const insta = document.getElementById('clipInsta');
  const credit = document.getElementById('clipCredit');
  const creditDefault = credit ? { href: credit.href, text: credit.textContent } : null;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let current = 0;
  let soundOn = false;
  let inView = false;
  let started = !still;          // reduced motion: nothing plays until someone asks for it

  const playCurrent = () => {
    const v = videos[current];
    v.muted = !soundOn;
    if (inView && started) v.play().catch(() => {});
  };
  const show = (i) => {
    const old = videos[current];
    old.pause();
    current = (i + videos.length) % videos.length;
    const v = videos[current];
    if (v.preload === 'none') v.preload = 'metadata';
    v.currentTime = 0;
    videos.forEach((x, k) => x.classList.toggle('is-active', k === current));
    clipPlayer.style.setProperty('--progress', '0%');
    tabs.forEach((x, k) => {
      x.classList.toggle('is-active', k === current);
      x.setAttribute('aria-pressed', String(k === current));
    });
    if (insta && v.dataset.insta) insta.href = v.dataset.insta;
    // who filmed it: Thomas unless the clip says otherwise (data-credit / data-credit-url)
    if (credit) {
      credit.href = v.dataset.creditUrl || creditDefault.href;
      credit.textContent = v.dataset.credit || creditDefault.text;
    }
    // on phones the tabs are a swipeable row: bring the playing one into view (sideways only)
    const row = tabs[current].parentElement;
    if (row.scrollWidth > row.clientWidth) {
      const left = row.scrollLeft + tabs[current].getBoundingClientRect().left - row.getBoundingClientRect().left;
      row.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    }
    playCurrent();
  };

  videos.forEach((v, k) => {
    v.loop = videos.length === 1;
    v.addEventListener('ended', () => show(k + 1));
    v.addEventListener('timeupdate', () => {
      if (k === current && v.duration) clipPlayer.style.setProperty('--progress', (v.currentTime / v.duration * 100) + '%');
    });
  });
  tabs.forEach((tab, k) => tab.addEventListener('click', () => { started = true; show(k); }));
  const prev = clipPlayer.querySelector('.clip-prev');
  const next = clipPlayer.querySelector('.clip-next');
  if (videos.length < 2) { [prev, next].forEach(b => b && b.remove()); clipPlayer.querySelector('.clip-tabs').hidden = true; }
  if (prev) prev.addEventListener('click', () => { started = true; show(current - 1); });
  if (next) next.addEventListener('click', () => { started = true; show(current + 1); });

  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      soundOn = !soundOn;
      started = true;
      soundBtn.setAttribute('aria-pressed', String(soundOn));
      soundBtn.querySelector('.clip-sound-label').textContent = soundOn ? t('Sound off', 'Geluid uit') : t('Sound on', 'Geluid aan');
      if (soundOn) track('clip-sound-on', 'Clip sound turned on');
      playCurrent();
    });
  }

  // a tap on the clip itself plays or pauses it
  clipPlayer.querySelector('.clip-screen').addEventListener('click', e => {
    if (e.target.closest('button')) return;
    const v = videos[current];
    started = true;
    if (v.paused) { v.muted = !soundOn; v.play().catch(() => {}); } else { v.pause(); }
  });

  // swipe left / right on phones
  let touchX = null;
  const screen = clipPlayer.querySelector('.clip-screen');
  screen.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
  screen.addEventListener('touchend', e => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 50 && videos.length > 1) { started = true; show(current + (dx < 0 ? 1 : -1)); }
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      if (inView) playCurrent(); else videos[current].pause();
    }, { threshold: 0.4 }).observe(screen);
  } else {
    inView = true;
    playCurrent();
  }
}


// Artist pages on phones: a "Book <artist>" bar at the bottom of the screen, shown
// once the booking buttons in the hero are out of view, hidden again near the
// closing booking block (so there's never two booking buttons on screen).
const stickyBook = document.getElementById('stickyBook');
if (stickyBook) {
  const heroButtons = document.querySelector('.artist-actions');
  const closing = document.querySelector('.book-cta');
  const update = () => {
    const passedHero = heroButtons.getBoundingClientRect().bottom < 0;          // scrolled past, not just below the fold
    const nearEnd = closing && closing.getBoundingClientRect().top < window.innerHeight;
    stickyBook.classList.toggle('is-visible', passedHero && !nearEnd);
  };
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  stickyBook.hidden = false;
  update();
}


// Artist pages: show the two most recent years of shows, earlier years behind a button.
document.querySelectorAll('.shows').forEach(section => {
  const years = section.querySelectorAll('.year-block');
  if (years.length <= 2) return;
  const earlier = [...years].slice(2);
  earlier.forEach(y => { y.hidden = true; });
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-outline btn-small shows-more';
  btn.setAttribute('aria-expanded', 'false');
  btn.textContent = t('Show earlier years ↓', 'Toon eerdere jaren ↓');
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    earlier.forEach(y => { y.hidden = !open; });
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? t('Show fewer ↑', 'Toon minder ↑') : t('Show earlier years ↓', 'Toon eerdere jaren ↓');
  });
  years[years.length - 1].after(btn);
});


// Booking page: pre-fill the date that came from an artist page (?date=2026-11-14).
// Only a valid, future yyyy-mm-dd date is used; anything else is ignored.
const bookDate = document.getElementById('date');
if (bookDate && document.getElementById('bookingForm')) {
  const wantedDate = new URLSearchParams(window.location.search).get('date') || '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(wantedDate) && (!bookDate.min || wantedDate >= bookDate.min)) bookDate.value = wantedDate;
}


// Scroll reveal: sections fade up gently as they come into view.
// Off for people who ask for reduced motion, and without JavaScript
// everything is simply visible.
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
  const targets = document.querySelectorAll(
    'main > section:not(.hero):not(.artist-hero) .section-head, .roster-tile:not(.roster-tile-large), .clip-player, .about-item, ' +
    '.timeline li, .year-block, .record-card, .photo-card, .stat, .team-card, .about-cta-card, ' +
    '.b2b-card, .book-cta-inner, .home-book-inner, .about-story-grid > *, .bio-inner, .listen-item'
  );
  const seen = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      seen.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  targets.forEach(el => {
    // cards in the same row come in one after another
    const siblings = [...el.parentElement.children].filter(c => c.matches && targets.length && [...targets].includes(c));
    const i = siblings.indexOf(el);
    if (i > 0) el.style.transitionDelay = Math.min(i, 4) * 70 + 'ms';
    el.classList.add('reveal');
    seen.observe(el);
  });
}


// Artist pages: "Share" opens the phone's share sheet (WhatsApp, mail, ...);
// where that doesn't exist (most desktops) it copies the link instead.
document.querySelectorAll('.share-btn').forEach(btn => {
  const label = btn.textContent;
  btn.addEventListener('click', async () => {
    const url = window.location.origin + window.location.pathname;
    if (navigator.share) {
      try { await navigator.share({ title: btn.dataset.shareTitle || document.title, url }); } catch (_) { /* closed */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      btn.textContent = t('Link copied ✓', 'Link gekopieerd ✓');
    } catch (_) {
      btn.textContent = url;
    }
    setTimeout(() => { btn.textContent = label; }, 2000);
  });
});


// Booking form in two steps: 1) you + artist + date + city, 2) event details.
// Same fields and same submit as before; without JavaScript it is one long form.
if (bookingForm && bookingForm.querySelector('.form-step')) {
  const steps = [...bookingForm.querySelectorAll('.form-step')];
  const nextBtn = bookingForm.querySelector('.form-next');
  const backBtn = bookingForm.querySelector('.form-back');
  const submitRow = bookingForm.querySelector('.form-actions');
  const legal = bookingForm.querySelector('.form-legal');
  const progress = document.getElementById('formProgress');
  const labels = [t('Step 1 of 2 · You & the date', 'Stap 1 van 2 · Jij & de datum'),
                  t('Step 2 of 2 · Event details', 'Stap 2 van 2 · Details van het event')];
  let current = 0;
  const show = (i, focus) => {
    current = i;
    steps.forEach((s, k) => { s.hidden = k !== i; });
    nextBtn.hidden = i !== 0;
    backBtn.hidden = i === 0;
    submitRow.hidden = i === 0;
    if (legal) legal.hidden = i === 0;
    progress.hidden = false;
    progress.querySelector('.form-progress-label').textContent = labels[i];
    progress.style.setProperty('--progress', ((i + 1) / steps.length * 100) + '%');
    if (focus) {
      const first = steps[i].querySelector('input, select, textarea');
      if (first) first.focus({ preventScroll: true });
      progress.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };
  const stepValid = (i) => {
    const bad = [...steps[i].querySelectorAll('input, select, textarea')].find(f => !f.checkValidity());
    if (bad) { bad.reportValidity(); return false; }
    return true;
  };
  bookingForm.classList.add('is-stepped');
  nextBtn.addEventListener('click', () => { if (stepValid(0)) show(1, true); });
  backBtn.addEventListener('click', () => show(0, true));
  // Enter in step 1 goes to step 2 instead of sending half a form
  bookingForm.addEventListener('submit', (e) => {
    if (current === 0) { e.preventDefault(); e.stopImmediatePropagation(); if (stepValid(0)) show(1, true); }
  }, true);
  show(0, false);
}


// Homepage: the navigation floats over the hero video without its own logo
// (the big BOONS logo in the video is the brand there). The hero content sits
// low in the video and scrolls with it; the moment it reaches the bar, the bar
// turns solid and the small logo fades in: the logo "moves" into the bar.
if (document.body.classList.contains('has-overlay-nav')) {
  const header = document.querySelector('.site-header');
  const mark = document.querySelector('.hero-logo-mark');
  const menu = document.getElementById('mobileNav');
  const update = () => {
    const reached = mark.getBoundingClientRect().top < header.offsetHeight + 12;
    header.classList.toggle('is-solid', reached || (menu && menu.classList.contains('open')));
  };
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  if (navToggle) navToggle.addEventListener('click', () => setTimeout(update, 0));
  update();
}

// Which Book button gets used, and where people leave to (socials, SoundCloud, email).
document.addEventListener('click', e => {
  const link = e.target.closest('a[href]');
  if (!link || link.hasAttribute('data-goatcounter-click')) return;
  const url = new URL(link.href, location.href);
  if (url.protocol === 'mailto:') { track('email-' + PAGE, 'Email link on ' + PAGE); return; }
  if (url.host !== location.host) {
    const site = url.hostname.replace(/^www\./, '').split('.')[0];
    track('out-' + site + '-' + PAGE, 'To ' + url.hostname + ' from ' + PAGE);
    return;
  }
  if (/^(\/nl)?\/book\/?$/.test(url.pathname) && PAGE !== 'book') {
    const spot = link.closest('.site-header') ? 'nav'
      : link.closest('.mobile-nav') ? 'menu'
      : link.closest('#stickyBook') ? 'sticky'
      : link.closest('.b2b-card') ? 'b2b'
      : link.closest('.hero, .artist-hero') ? 'hero'
      : 'page';
    track('book-' + PAGE + '-' + spot, 'Book button: ' + PAGE + ', ' + spot);
  }
});
