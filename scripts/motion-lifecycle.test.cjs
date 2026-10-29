const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the actual effect bodies without a browser or additional dependencies.
function mount(file, { reduced = false, width = 1440, cores = 8 } = {}) {
  const frames = new Map(), windowEvents = new Map(), documentEvents = new Map(), media = new Map();
  let effect, id = 0, refs = 0, draws = 0;
  const context = new Proxy({}, { get: (_, key) => key === 'createRadialGradient'
    ? () => ({ addColorStop() {} }) : () => { if (key === 'clearRect') draws++; } });
  const canvas = { getContext: () => context, getBoundingClientRect: () => ({ width: 700, height: 600 }) };
  const light = { style: {}, dataset: {} };
  const doc = { hidden: false, documentElement: { scrollHeight: 6000 }, createElement: () => canvas,
    addEventListener: (name, fn) => documentEvents.set(name, fn), removeEventListener: name => documentEvents.delete(name) };
  const win = { scrollY: 0, addEventListener: (name, fn) => windowEvents.set(name, fn), removeEventListener: name => windowEvents.delete(name) };
  const module = { exports: {} };
  const sandbox = { module, exports: module.exports, Math, innerWidth: width, innerHeight: 900, devicePixelRatio: 2,
    navigator: { hardwareConcurrency: cores }, document: doc, window: win,
    requestAnimationFrame: fn => { frames.set(++id, fn); return id; }, cancelAnimationFrame: key => frames.delete(key),
    matchMedia: query => {
      const m = { matches: query.includes('reduced-motion') ? reduced : query.includes('max-width') ? width < 768 : true,
        listener: null, addEventListener: (_, fn) => { m.listener = fn; }, removeEventListener: () => { m.listener = null; } };
      media.set(query, m); return m;
    },
    IntersectionObserver: class { observe() {} disconnect() {} }, ResizeObserver: class { observe() {} disconnect() {} },
    require: name => name === 'react' ? { useEffect: fn => { effect = fn; }, useRef: () => ({ current: refs++ === 0 ? canvas : light }) }
      : name === 'next/navigation' ? { usePathname: () => '/' }
      : name === 'react/jsx-runtime' ? { jsx() {}, jsxs() {} } : { BrandMark() {} },
  };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
  } }).outputText;
  vm.runInNewContext(source, sandbox, { filename: file });
  module.exports.default();
  const cleanup = effect();
  return { frames, media, doc, light, documentEvents, windowEvents, cleanup, draws: () => draws,
    tick(now) { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(now)); } };
}

for (const file of ['components/Universe.tsx', 'components/HeroGalaxy.tsx']) {
  for (const scenario of [{ reduced: true }, { width: 390 }, { cores: 4 }]) {
    test(`${file}: static fallback ${JSON.stringify(scenario)}`, () => {
      const app = mount(file, scenario);
      assert.ok(app.draws() > 0, 'fallback must still render');
      assert.equal(app.frames.size, 0, 'fallback must not run an ambient frame loop');
      app.cleanup();
      assert.equal(app.windowEvents.size + app.documentEvents.size, 0);
    });
  }
  test(`${file}: visibility, live preference changes, cleanup`, () => {
    const app = mount(file);
    assert.equal(app.frames.size, 1);
    app.tick(50);
    assert.equal(app.frames.size, 1, 'only one animation loop');
    app.doc.hidden = true;
    app.documentEvents.get('visibilitychange')();
    assert.equal(app.frames.size, 0, 'hidden tabs stop rendering');
    app.doc.hidden = false;
    app.documentEvents.get('visibilitychange')();
    assert.equal(app.frames.size, 1);
    const reduce = app.media.get('(prefers-reduced-motion: reduce)');
    reduce.matches = true; reduce.listener();
    assert.equal(app.frames.size, 0, 'live reduced motion must stop rendering');
    reduce.matches = false; reduce.listener();
    assert.equal(app.frames.size, 1);
    app.cleanup();
    assert.equal(app.frames.size, 0);
    assert.equal(app.windowEvents.size + app.documentEvents.size, 0);
    assert.ok([...app.media.values()].every(m => m.listener === null));
  });
}
