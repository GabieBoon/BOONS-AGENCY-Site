
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

// Pre-fill "artist" select when a specific "Book X" button is clicked
document.querySelectorAll('[data-artist]').forEach(btn => {
  btn.addEventListener('click', () => {
    const artistSelect = document.getElementById('artist');
    if (artistSelect) artistSelect.value = btn.dataset.artist;
  });
});

// Roster tiles: click a compact tile to open the full artist modal
document.querySelectorAll('.roster-tile').forEach(tile => {
  tile.addEventListener('click', () => {
    const modal = document.getElementById(tile.dataset.open);
    if (modal) openModal(modal);
  });
});
function openModal(modal) {
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(modal) {
  modal.classList.remove('open');
  document.body.style.overflow = '';
}
document.querySelectorAll('.modal-overlay').forEach(modal => {
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });
  const closeBtn = modal.querySelector('[data-close]');
  if (closeBtn) closeBtn.addEventListener('click', () => closeModal(modal));
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(closeModal);
});

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
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending...'; }
    if (formNote) { formNote.textContent = ''; formNote.classList.remove('form-note-error'); }

    try {
      const res = await fetch(bookingForm.action, {
        method: 'POST',
        body: new FormData(bookingForm),
        headers: { 'Accept': 'application/json' }
      });

      if (res.ok) {
        // carry the chosen artist over, so the thank-you page shows the right press kit
        const target = new URL('thanks.html', window.location.href);
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
          ? ('Something went wrong: ' + detail)
          : 'Something went wrong. Please mail Bookings@boons-agency.nl instead.';
        formNote.classList.add('form-note-error');
      }
    } catch (_) {
      if (formNote) {
        formNote.textContent = 'No connection. Please check your internet, or mail Bookings@boons-agency.nl.';
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
    nextField.value = new URL('thanks.html', window.location.href).href;
  } catch (e) { /* keep the hardcoded fallback */ }
}


// Thank-you page: show the press kit of the artist that was requested.
// The value comes from the URL, so it is only ever used to look up a fixed page -
// never written into the page as markup.
const presskitLink = document.getElementById('presskitLink');
const forArtist = document.getElementById('forArtist');
if (presskitLink || forArtist) {
  const PAGES = { GIBBS: 'gibbs.html', BURNEY: 'burney.html' };
  const raw = new URLSearchParams(window.location.search).get('artist') || '';
  const key = raw.trim().toUpperCase();
  if (forArtist && PAGES[key]) forArtist.textContent = ' for ' + key;
  if (presskitLink && PAGES[key]) {
    presskitLink.setAttribute('href', PAGES[key]);
    presskitLink.textContent = key + ' press kit';
    presskitLink.hidden = false;
  }
}
