# -*- coding: utf-8 -*-
"""Assemble the share card from the catalogue snapshot + the mark."""
import io, os

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))

data = io.open(os.path.join(HERE, "catalogue.json"), encoding="utf-8").read()
mark = io.open(os.path.join(REPO, "public", "mark.svg"), encoding="utf-8").read()
card = io.open(os.path.join(HERE, "card.js"), encoding="utf-8").read()

HTML = u"""<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Mukta:wght@600;700&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1200px;height:630px;overflow:hidden;background:#0d0d0d}
  .card{position:relative;width:1200px;height:630px;background:#0d0d0d;
        font-family:Inter,system-ui,sans-serif;color:#fff;overflow:hidden}
  /* The galaxy bleeds off the right edge and dissolves, exactly as on the
     site — no panel, no border, so the card reads as one surface. */
  canvas{position:absolute;right:-70px;top:-30px;width:760px;height:690px;
    -webkit-mask-image:radial-gradient(ellipse 50% 50% at 50% 50%,#000 0%,#000 46%,rgba(0,0,0,.5) 74%,transparent 100%);
            mask-image:radial-gradient(ellipse 50% 50% at 50% 50%,#000 0%,#000 46%,rgba(0,0,0,.5) 74%,transparent 100%)}
  .left{position:absolute;left:74px;top:0;height:630px;width:620px;
        display:flex;flex-direction:column;justify-content:center;gap:0}
  .lock{display:flex;align-items:center;gap:13px;margin-bottom:34px}
  .lock svg{height:44px;width:auto;display:block}
  .wm{font-size:31px;font-weight:700;letter-spacing:-.02em}
  .wm b{color:#f4564e;font-weight:700}
  h1{font-size:66px;font-weight:700;letter-spacing:-.03em;line-height:1.04}
  h1 .np{font-family:Mukta,Inter,sans-serif;font-weight:700;line-height:1.3}
  h1 .coral{color:#f4564e}
  .sub{margin-top:26px;font-size:21px;line-height:1.5;color:#a3a3a3;max-width:540px}
  .strip{position:absolute;left:74px;bottom:46px;display:flex;align-items:center;gap:14px;
         font-family:"IBM Plex Mono",monospace;font-size:13.5px;letter-spacing:.12em;
         text-transform:uppercase;color:#71717a}
  .dot{width:4px;height:4px;border-radius:50%;background:#f4564e;flex:none}
</style>
<div class="card">
  <canvas id="g" width="1520" height="1380"></canvas>
  <div class="left">
    <div class="lock">__MARK__<span class="wm"><b>AI</b>sathi</span></div>
    <h1>Any AI model.<br><span class="coral">Pay in <span class="np">&#2352;&#2369;&#2346;&#2376;&#2351;&#2366;&#2305;</span>.</span></h1>
    <p class="sub">One login for 454 models &mdash; GPT, Claude, Gemini, Llama and more.
      Top up with eSewa or Khalti. No USD card.</p>
  </div>
  <div class="strip"><span class="dot"></span>aisathi.io &nbsp;&middot;&nbsp; built in Nepal &nbsp;&middot;&nbsp; 55 vendors, one key</div>
</div>
<script>const DATA = __DATA__;</script>
<script>__CARD__</script>
"""

# The mark is white-on-dark artwork already; only its box needs constraining.
mark = mark.replace('width="522" height="542"', 'height="44"')

out = (HTML.replace("__MARK__", mark)
           .replace("__DATA__", data)
           .replace("__CARD__", card))
path = os.path.join(HERE, "card.html")
io.open(path, "w", encoding="utf-8").write(out)
print("card.html", round(os.path.getsize(path) / 1024, 1), "KB")
