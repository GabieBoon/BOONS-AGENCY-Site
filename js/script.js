
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

// Booking form: basic client-side note (Formspree handles the actual submission)
const bookingForm = document.getElementById('bookingForm');
const formNote = document.getElementById('formNote');
if (bookingForm) {
  bookingForm.addEventListener('submit', () => {
    if (formNote) formNote.textContent = 'Versturen...';
  });
}

