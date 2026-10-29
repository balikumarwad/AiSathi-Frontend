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

// One lifecycle for decorative motion; native scrolling and content remain independent.
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const scene = document.querySelector('.orbital-scene');
const depth = document.querySelector('.orbital-depth');
let motionCleanup = () => {};
function initializeMotion() {
  motionCleanup();
  if (motionPreference.matches) return;
  document.body.classList.add('motion-active');
  const controller = new AbortController();
  const options = { signal: controller.signal, passive: true };
  const observer = new IntersectionObserver(([entry]) => {
    scene.classList.toggle('motion-paused', !entry.isIntersecting || document.hidden);
  });
  observer.observe(scene);
  const onVisibility = () => scene.classList.toggle('motion-paused', document.hidden || scene.getBoundingClientRect().bottom < 0);
  document.addEventListener('visibilitychange', onVisibility, options);
  scene.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || smallScreen.matches) return;
    const bounds = scene.getBoundingClientRect();
    depth.style.setProperty('--tilt-x', `${((event.clientX-bounds.left)/bounds.width-.5)*7}deg`);
    depth.style.setProperty('--tilt-y', `${-((event.clientY-bounds.top)/bounds.height-.5)*5}deg`);
  }, options);
  scene.addEventListener('pointerleave', () => {
    depth.style.removeProperty('--tilt-x'); depth.style.removeProperty('--tilt-y');
  }, options);
  const sections = document.querySelectorAll('.steps article, .idea-board, .code-card');
  const reveals = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.animate([{transform:'translateY(18px)',opacity:.65},{transform:'translateY(0)',opacity:1}],{duration:750,easing:'cubic-bezier(.2,.7,.2,1)'});
      reveals.unobserve(entry.target);
    }
  },{threshold:.15});
  sections.forEach(section => reveals.observe(section));
  motionCleanup = () => {
    controller.abort(); observer.disconnect(); reveals.disconnect();
    sections.forEach(section => section.getAnimations().forEach(animation => animation.cancel()));
    document.body.classList.remove('motion-active'); depth.removeAttribute('style');
  };
}
motionPreference.addEventListener('change', initializeMotion);
window.addEventListener('pagehide', () => motionCleanup());
window.addEventListener('pageshow', initializeMotion);
initializeMotion();
