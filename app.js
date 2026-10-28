const menu = document.querySelector('#mobile-toggle');
const nav = document.querySelector('#site-nav');
const smallScreen = matchMedia('(max-width: 900px)');
menu.hidden = false;
let lastFocus = document.activeElement;
document.addEventListener('focusin', event => { lastFocus = event.target; });
document.addEventListener('pointerdown', () => { lastFocus = null; });

function closeMenu(returnFocus = false) {
  menu.setAttribute('aria-expanded', 'false');
  nav.classList.remove('is-open');
  if (returnFocus) menu.focus();
}

menu.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  nav.classList.toggle('is-open', open);
});
nav.addEventListener('click', event => {
  if (event.target.closest('a') && smallScreen.matches) closeMenu();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') closeMenu(true);
});
document.addEventListener('click', event => {
  if (!event.target.closest('.header-inner')) closeMenu();
});
smallScreen.addEventListener('change', () => {
  const previous = lastFocus;
  closeMenu();
  if (smallScreen.matches && nav.contains(previous)) menu.focus();
  else if (!smallScreen.matches && previous === menu) nav.querySelector('a').focus();
});

document.querySelector('#api-panel').hidden = true;
document.querySelectorAll('[data-mode]').forEach(button => {
  button.disabled = false;
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-mode]').forEach(item => {
      const selected = item === button;
      item.setAttribute('aria-pressed', String(selected));
      document.querySelector(`#${item.dataset.mode}-panel`).hidden = !selected;
    });
  });
});

const copyButton = document.querySelector('#copy-code');
const copyStatus = document.querySelector('#copy-status');
copyButton.disabled = false;
copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(document.querySelector('#request-code').textContent);
    copyStatus.textContent = 'Request copied. Replace the placeholders before running.';
  } catch {
    copyStatus.textContent = 'Copy is unavailable. Select and copy the request manually.';
  }
});

// Native details remain usable without JavaScript; open linked notes before scrolling.
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', () => {
    const target = document.getElementById(link.hash.slice(1));
    if (target?.tagName === 'DETAILS') target.open = true;
  });
});
