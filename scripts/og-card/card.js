/* The share card's galaxy: the same construction as components/HeroGalaxy.tsx,
   drawn once into a still. Seeded so the card is reproducible — a share image
   that shuffles every time it is regenerated cannot be diffed or approved. */
(function () {
  var seed = 20260925;
  function rnd() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }

  var cv = document.getElementById('g'), ctx = cv.getContext('2d');
  var W = cv.width, H = cv.height, CX = W / 2, CY = H / 2;
  var HUES = [8, 352, 20, 340], COOL = [255, 233, 226], HOT = [244, 86, 78];
  var D = Math.ceil(Math.hypot(W, H)), NX = CX - D / 2, NY = CY - D / 2;

  function layer(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  var neb = layer(D, D), nx = neb.getContext('2d');
  nx.globalCompositeOperation = 'lighter';
  for (var arm = 0; arm < 3; arm++) {
    var off = (arm / 3) * Math.PI * 2;
    for (var i = 0; i < 46; i++) {
      var a = off + i * 0.19 + rnd() * 0.06, r = 26 + i * (H / 68);
      var px = D / 2 + Math.cos(a) * r * 1.62 + (rnd() - 0.5) * 42;
      var py = D / 2 + Math.sin(a) * r * 0.74 + (rnd() - 0.5) * 24;
      var rad = Math.max((H / 5.4) * (0.5 + rnd()) - i * 0.22, 8);
      var hue = HUES[(arm + (i % 2)) % 4] + (rnd() * 18 - 9);
      var al = 0.085 * (1 - i / 60) + 0.012;
      var gr = nx.createRadialGradient(px, py, 0, px, py, rad);
      gr.addColorStop(0, 'hsla(' + hue + ',88%,66%,' + al + ')');
      gr.addColorStop(0.55, 'hsla(' + (hue + 12) + ',85%,52%,' + al * 0.45 + ')');
      gr.addColorStop(1, 'hsla(' + hue + ',80%,40%,0)');
      nx.fillStyle = gr; nx.beginPath(); nx.arc(px, py, rad, 0, 7); nx.fill();
    }
  }
  var blur = layer(D, D), bx = blur.getContext('2d');
  bx.filter = 'blur(16px)'; bx.drawImage(neb, 0, 0);

  var fld = layer(W, H), fx = fld.getContext('2d');
  fx.fillStyle = 'rgb(255,233,226)';
  for (var k = 0; k < 1400; k++) {
    var fxp = rnd() * W, fyp = rnd() * H;
    var d = Math.hypot((fxp - CX) / (W * 0.5), (fyp - CY) / (H * 0.5));
    if (rnd() < d * 0.45) continue;
    fx.globalAlpha = 0.18 + rnd() * 0.75;
    var fr = rnd() < 0.9 ? rnd() * 0.8 + 0.25 : rnd() * 1.5 + 0.7;
    fx.beginPath(); fx.arc(fxp, fyp, fr, 0, 7); fx.fill();
  }

  // Real models, placed by real price — the same mapping the site uses.
  var prices = DATA.m.map(function (m) { return m[2]; }).filter(function (v) { return v > 0; });
  var lo = Math.log(Math.min.apply(null, prices)), hi = Math.log(Math.max.apply(null, prices));
  var cl = Math.log(4096), ch = Math.log(2000000);
  function norm(v, a, b) { return Math.max(0, Math.min(1, (Math.log(Math.max(v, 1)) - a) / (b - a))); }
  var rMax = Math.min((W / 2) * 0.94 / 1.6, (H / 2) * 0.94 / 0.73);
  var reach = Math.max(rMax - H * 0.07, H * 0.12);

  ctx.clearRect(0, 0, W, H);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.72; ctx.drawImage(blur, NX, NY); ctx.restore();
  ctx.globalAlpha = 0.85; ctx.drawImage(fld, 0, 0); ctx.globalAlpha = 1;

  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  DATA.m.forEach(function (m, i) {
    var pn = m[2] > 0 ? norm(m[2], lo, hi) : 0.02;
    var cn = m[3] > 0 ? norm(m[3], cl, ch) : 0.2;
    var rr = H * 0.07 + pn * reach, ang = i * 2.399963;
    var sx = CX + Math.cos(ang) * rr * 1.6, sy = CY + Math.sin(ang) * rr * 0.73;
    ctx.fillStyle = 'rgb(' + Math.round(COOL[0] + (HOT[0] - COOL[0]) * pn) + ',' +
      Math.round(COOL[1] + (HOT[1] - COOL[1]) * pn) + ',' +
      Math.round(COOL[2] + (HOT[2] - COOL[2]) * pn) + ')';
    ctx.globalAlpha = 0.3 + 0.5 * cn;
    ctx.beginPath(); ctx.arc(sx, sy, (0.8 + cn * 2.6) * 2, 0, 7); ctx.fill();
  });
  ctx.restore();

  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  var beam = H * 0.42;
  ctx.save(); ctx.translate(CX, CY); ctx.scale(0.075, 1);
  var g1 = ctx.createRadialGradient(0, 0, 0, 0, 0, beam);
  g1.addColorStop(0, 'rgba(255,255,255,0.8)');
  g1.addColorStop(0.25, 'rgba(255,214,204,0.2)');
  g1.addColorStop(1, 'rgba(255,150,132,0)');
  ctx.fillStyle = g1; ctx.beginPath(); ctx.arc(0, 0, beam, 0, 7); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(CX, CY); ctx.scale(1, 0.1);
  var g2 = ctx.createRadialGradient(0, 0, 0, 0, 0, beam * 0.74);
  g2.addColorStop(0, 'rgba(255,255,255,0.5)');
  g2.addColorStop(1, 'rgba(255,160,140,0)');
  ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(0, 0, beam * 0.74, 0, 7); ctx.fill(); ctx.restore();
  var g3 = ctx.createRadialGradient(CX, CY, 0, CX, CY, H * 0.06);
  g3.addColorStop(0, '#ffffff');
  g3.addColorStop(0.35, 'rgba(255,246,244,0.55)');
  g3.addColorStop(1, 'rgba(255,246,244,0)');
  ctx.fillStyle = g3; ctx.beginPath(); ctx.arc(CX, CY, H * 0.06, 0, 7); ctx.fill();
  ctx.restore();

  document.documentElement.dataset.painted = '1';
})();
