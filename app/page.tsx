import Link from "next/link";
import PortalLink from "@/components/PortalLink";
import OrbitArtwork from "@/components/OrbitArtwork";
import CosmicJourney from "@/components/CosmicJourney";
import Nav from "@/components/Nav";
import Brand, { BrandMark } from "@/components/Brand";
import HeroGalaxy from "@/components/HeroGalaxy";
import ModelPaper from "@/components/ModelPaper";
import CopyButton from "@/components/CopyButton";

const request = `curl https://aisathi.io/api/v1/chat/completions \\
  -H "Authorization: Bearer np-your-key" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"MODEL_ID_FROM_CATALOGUE",
       "messages":[{"role":"user","content":"नमस्ते!"}]}'`;
const questions = [
  ["How do I choose a model?","Browse the model catalogue for availability, context limits, and input/output prices in NPR. The catalogue is the source of truth; availability can change."],
  ["How do local payments work?","The top-up page shows the payment options and plans available from the service. A payment is credited only after server-side verification. Check your balance after returning from checkout."],
  ["Can I use AIsathi in my application?","The developer documentation covers the chat-completions gateway, streaming, model IDs, and authentication. Create an API key in your account and keep it on your server."],
  ["Where are my conversations stored?","The playground keeps browser conversation history and can sync signed-in conversations through the existing service. Prompts are sent to the selected model provider. Read the privacy policy before sharing sensitive information."],
  ["What do credits cover?","Usage depends on the selected model and its input/output rates. Review current model pricing and the top-up plan details before purchasing."],
];
export default function Home(){return <CosmicJourney><div className="cosmic-home">
  <Nav/>
  <main id="main-content" tabIndex={-1}>
    <section className="cosmic-hero" data-chapter="arrival">
      <div className="hero-coordinate"><span>AI / SATHI</span><span>27.7172° N · 85.3240° E</span></div>
      <div className="home-wrap grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div className="relative z-10">
          <p className="hero-eyebrow"><span lang="ne">तपाईंको AI साथी</span>&nbsp; · YOUR AI COMPANION</p>
          <h1>Your AI.<br/>Your choice.<br/><span className="cosmic-gradient">Closer to home.</span></h1>
          <p className="home-copy mt-7 max-w-lg text-lg">A universe of models, one local connection. Explore ideas in chat or bring AI into your application, with usage priced in Nepali rupees.</p>
          <div className="home-cta"><PortalLink /><Link className="home-secondary" href="/docs">Read the docs</Link></div>
          <p className="mt-7 text-sm text-zinc-400"><span lang="ne">सँगै, अझ अगाडि।</span> &nbsp; Made with Nepal in mind.</p>
        </div>
        <div className="hero-observatory"><div className="observatory-rings"/><HeroGalaxy/><span className="observatory-label observatory-label--a">Ideas without borders</span><span className="observatory-label observatory-label--b">A little closer to home</span></div>
      </div>
      <div className="hero-bottom"><a href="#models-sector"><span>↓</span> Explore the universe</a><span>Chat · Build · Discover</span></div>
    </section>
    <section id="models-sector" data-chapter="models" className="home-wrap model-sector"><div className="chapter-orbit"><OrbitArtwork/></div>
      <p className="home-kicker">01 / A universe of possibilities</p><h2 className="home-heading">Find the right mind<br/>for what’s on yours.</h2>
      <p className="home-copy mt-5 max-w-xl">Writing, reasoning, coding, and the questions in between. Explore the models available through the same catalogue used by the playground.</p>
      <div className="mt-9"><ModelPaper/></div>
      <Link className="home-secondary mt-7 inline-block" href="/models">Explore models & pricing ↗</Link>
    </section>
    <section data-chapter="workspace" className="home-wrap workspace-sector grid gap-6 md:grid-cols-2">
      <article className="home-panel"><div className="panel-coordinate">01 / Conversation space</div><p className="home-kicker">For everyday ideas</p><h2 className="home-heading">A fresh perspective.<br/>One conversation away.</h2><p className="home-copy mt-5">Choose a model, ask a question, and keep your work together. The playground brings conversations, model selection, and useful tools into one focused space.</p><Link href="/playground" className="primary-action mt-7 inline-block">Open the playground ↗</Link></article>
      <article className="home-panel"><div className="panel-coordinate">02 / Creation space</div><p className="home-kicker">For your next build</p><h2 className="home-heading">Your idea.<br/>Your integration.</h2><p className="home-copy mt-5">Use the chat-completions endpoint with a model from the catalogue. Manage keys in your account and inspect usage in your dashboard.</p><div className="home-cta"><Link href="/account" className="home-secondary">Manage API keys</Link><Link href="/dashboard" className="text-sm text-zinc-300">View usage ↗</Link></div></article>
    </section>
    <section data-chapter="journey" className="journey-sector"><div className="home-wrap"><p className="home-kicker">02 / Global possibilities. A familiar way in.</p><h2 className="home-heading">From a question<br/>to your next creation.</h2><div className="mt-12 grid gap-8 md:grid-cols-3">{[
      ["01","Find your fit.","Compare models and their current rates. Choose what suits the task in front of you."],
      ["02","Make it local.","Review the available top-up plans and payment methods, with clear amounts before checkout."],
      ["03","Make something.","Chat or build with the API. Follow your balance and request history in the usage dashboard."],
    ].map(([n,title,copy])=><article key={n} className="border-t border-zinc-700 pt-5"><span className="text-sm text-purple-300">{n}</span><h3 className="mt-5 text-xl font-semibold">{title}</h3><p className="home-copy mt-3">{copy}</p></article>)}</div></div></section>
    <section data-chapter="developers" className="home-wrap developer-sector grid items-center gap-12 lg:grid-cols-2"><div className="transmission-lines"><OrbitArtwork variant="signal"/></div><div><p className="home-kicker">03 / Hello, builders</p><h2 className="home-heading">A little code.<br/><span className="cosmic-gradient">A lot of possibility.</span></h2><p className="home-copy mt-5">Connect your app to the chat-completions gateway. Choose a model from the catalogue, add your key, and send your first request. Keep API secrets on your server.</p><Link href="/docs" className="home-secondary mt-7 inline-block">Explore developer documentation ↗</Link></div><div className="home-panel relative min-w-0"><p className="home-kicker">cURL / chat completions</p><CopyButton text={request}/><pre className="overflow-x-auto pt-6 font-mono text-xs leading-7 text-purple-200"><code>{request}</code></pre></div></section>
    <section data-chapter="credits" className="home-wrap credits-sector"><div className="chapter-orbit"><OrbitArtwork/></div><p className="home-kicker">04 / Keep it clear</p><div className="grid gap-8 md:grid-cols-2"><div><h2 className="home-heading">Rupees in.<br/>Possibilities out.</h2><p className="home-copy mt-5">Model rates and purchase plans come from the service. See current prices before deciding what to use.</p></div><div className="home-panel"><h3 className="text-xl font-semibold">Know the cost before you create.</h3><p className="home-copy mt-4">Input and output rates differ by model. Your account keeps usage and balance together.</p><div className="home-cta"><Link href="/topup" className="primary-action">View top-up options</Link><Link href="/models" className="text-sm">Compare model rates ↗</Link></div></div></div></section>
    <section data-chapter="questions" className="home-wrap faq-sector grid gap-12 md:grid-cols-2"><div><p className="home-kicker">A few things, explained</p><h2 className="home-heading">Good questions.<br/>Clear answers.</h2></div><div>{questions.map(([q,a])=><details key={q} className="border-b border-zinc-800 py-5"><summary className="cursor-pointer font-medium">{q}</summary><p className="home-copy pt-4">{a}</p></details>)}</div></section>
    <section data-chapter="destination" className="final-sector"><div className="destination-art"><OrbitArtwork variant="portal"/></div><div><BrandMark width={54} className="final-mark"/><p className="home-kicker">Your next chapter</p><h2 className="home-heading">A big idea?<br/>Bring a <span className="cosmic-gradient">sathi.</span></h2><p className="home-copy mt-5">You bring the curiosity. Find your starting point.</p><PortalLink className="mt-7">Start a conversation</PortalLink></div></section>
  </main>
  <footer className="home-footer"><Brand/><nav aria-label="Footer"><Link href="/docs">Docs</Link><Link href="/models">Models</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav></footer>
</div></CosmicJourney>}
