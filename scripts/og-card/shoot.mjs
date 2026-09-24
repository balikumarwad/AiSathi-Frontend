// Render card.html at 2x and report whether the canvas actually painted.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const [FILE, OUT, Wc, Hc] = [process.argv[2], process.argv[3], +process.argv[4], +process.argv[5]];
const PORT = 9347, sleep = (ms) => new Promise(r => setTimeout(r, ms));
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, "--no-first-run",
  "--hide-scrollbars", "--allow-file-access-from-files",
  `--user-data-dir=${mkdtempSync(join(tmpdir(), "og-"))}`, "about:blank"], { stdio: "ignore" });
let ws;
for (let i = 0; i < 40 && !ws; i++) {
  try { const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
    ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  } catch { ws = undefined; await sleep(250); }
}
let id = 0; const pending = new Map(); let loaded = false; const errs = [];
ws.onmessage = (ev) => { const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? {}); pending.delete(m.id); }
  if (m.method === "Page.loadEventFired") loaded = true;
  if (m.method === "Runtime.exceptionThrown") errs.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
};
const send = (m, p = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: Wc, height: Hc, deviceScaleFactor: 2, mobile: false });
await send("Page.navigate", { url: "file:///" + FILE.split(String.fromCharCode(92)).join("/") });
for (let t = 0; !loaded && t < 300; t++) await sleep(100);
await ev("document.fonts.ready.then(()=>1)");
await sleep(900);
const painted = await ev(`(()=>{const c=document.getElementById('g');const g=c.getContext('2d');
  const d=g.getImageData(0,0,c.width,c.height).data;let max=0,lit=0;
  for(let i=0;i<d.length;i+=4){const v=d[i]+d[i+1]+d[i+2];if(v>max)max=v;if(v>40)lit++;}
  return {painted:document.documentElement.dataset.painted||'0',max,lit};})()`);
console.log("probe", JSON.stringify(painted));
if (errs.length) console.log("errors", JSON.stringify(errs).slice(0, 600));
const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true,
  clip: { x: 0, y: 0, width: Wc, height: Hc, scale: 2 } });
writeFileSync(OUT, Buffer.from(shot.data, "base64"));
console.log("wrote", OUT);
ws.close(); chrome.kill();
