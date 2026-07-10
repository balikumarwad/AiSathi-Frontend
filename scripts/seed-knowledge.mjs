/**
 * Seed the Nepal knowledge base (RAG). Embeds each entry with
 * text-embedding-3-small via OpenRouter and upserts into public.knowledge.
 * Run: node scripts/seed-knowledge.mjs   (reads .env.local)
 * Re-running replaces all seeded rows (idempotent by title).
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .map((l) => l.match(/^([A-Z_]+)=["']?(.*?)["']?\s*$/)).filter(Boolean)
    .map((m) => [m[1], m[2]]),
);

const AS_OF = "2026-07-01";
// Compact, high-value facts generic models get wrong or vague. Fee-type facts
// say "confirm at <office>" since they change; as_of marks verification date.
const ENTRIES = [
  ["civic", "Driving license (new, Nepal)", "Apply online at applydl.dotm.gov.np, then biometric visit to a Transport Management Office. Steps: written (likhit) exam, then practical trial exam. Documents: citizenship original + copy and the online form; medical section included. Common categories: A (motorcycle), B (car). Indicative fees: exam ~रू500, license card ~रू1,500 depending on category — confirm current fees at the office or dotm.gov.np. License is renewable every 5 years (10 for some categories).", "Department of Transport Management (dotm.gov.np)"],
  ["civic", "E-passport (Nepal)", "Pre-enroll online at nepalpassport.gov.np, book an appointment, then appear at the Department of Passports (Tripureshwor, Kathmandu) or your District Administration Office with citizenship certificate (original + copy). Indicative fees: 34-page ordinary ~रू5,000 with ~15 working days; fast-track (~3 working days) ~रू12,000, only at DoP Kathmandu — confirm current fees at nepalpassport.gov.np. Minors apply with birth certificate and guardians' documents.", "Department of Passports (nepalpassport.gov.np)"],
  ["civic", "Citizenship certificate", "Issued by the District Administration Office (DAO). Apply from age 16 by descent: needs birth certificate, ward recommendation from your palika, father's/mother's citizenship copy, migration certificate if the family moved districts, and passport photos. Married women can apply from the husband's district with marriage certificate. The certificate is the base document for passport, license, SIM, banking, and land.", "District Administration Office / Ministry of Home Affairs"],
  ["civic", "PAN (Permanent Account Number)", "Free from the Inland Revenue Department — register online at ird.gov.np or at a Taxpayer Service Office with citizenship and a photo. Personal PAN is now needed for salary payments, most bank work, and any business. Business PAN/VAT registration is separate — VAT registration is mandatory above the turnover threshold or for certain businesses.", "Inland Revenue Department (ird.gov.np)"],
  ["civic", "Company registration", "Register at the Office of the Companies Registrar (OCR): reserve a company name online at ocr.gov.np, submit MOA/AOA and founder documents. A private limited company needs at least 1 shareholder and can be single-person. Government fee scales with authorized capital (starts around a few thousand rupees). After OCR: PAN at IRD, ward-level business registration, and industry-specific licenses if applicable.", "Office of the Companies Registrar (ocr.gov.np)"],
  ["civic", "National ID (NID)", "The National Identity Card is enrolled free at District Administration Offices and designated enrollment centers (biometrics + citizenship). The NID number is increasingly required for SIM registration, banking KYC, social security, and passport applications.", "National ID Management Center"],
  ["education", "SEE exam and grading", "SEE (Secondary Education Examination) comes after class 10, run province-wise under the National Examination Board, usually held in Chaitra (March–April). Grading is letter/GPA based on a 4.0 scale: A+ (3.6–4.0), A (3.2–3.6), B+ (2.8–3.2) and so on — there is no pass/fail division system anymore; very low grades require grade-improvement exams to continue.", "National Examination Board (neb.gov.np)"],
  ["education", "+2 (grades 11–12)", "Grades 11–12 run under the National Examination Board (NEB) with streams: Science, Management, Humanities, Education, and Law. Class 12 final results (GPA) are what universities use for bachelor admission. Science students typically need strong grades for medical (via CEE entrance) or engineering (via IOE entrance) paths.", "National Examination Board"],
  ["education", "Lok Sewa Aayog (government jobs)", "The Public Service Commission (Lok Sewa Aayog) runs exams for permanent government posts. Most popular: Kharidar, Nayab Subba (NaSu), and Section Officer (Sakha Adhikrit). Stages: Preliminary exam, then written papers, then interview. Vacancies, syllabus, and application via psc.gov.np (online). Typical age windows: 18–35 for men and 18–40 for women for many posts — check each vacancy notice.", "Public Service Commission (psc.gov.np)"],
  ["education", "NOC for studying abroad", "The No Objection Certificate from the Ministry of Education, Science and Technology is required to legally transfer tuition money abroad. Apply online at noc.moest.gov.np with the university offer letter, citizenship (or passport), and fee of about रू2,000; the NOC is issued per country/institution. Banks require it before remitting fees.", "Ministry of Education (noc.moest.gov.np)"],
  ["education", "Universities and entrances", "Major universities: Tribhuvan University (largest, most affiliated colleges), Kathmandu University, Pokhara University, Purbanchal University. Competitive entrances: IOE (BE/architecture at Pulchowk etc.), IOST B.Sc. CSIT, CEE for MBBS/BDS (medical common entrance), KUUMAT/KUCAT for KU programs. Fees vary hugely between constituent and private/affiliated colleges.", "TU / KU / MEC"],
  ["education", "IELTS and PTE in Nepal", "IELTS is run by the British Council and IDP in Kathmandu, Pokhara, Chitwan and other cities; the fee is roughly रू35,000+ (changes with exchange rate — confirm with the test center). PTE Academic is widely accepted for Australia and some other destinations. Most abroad-study consultancies are concentrated in Putalisadak/Bagbazar, Kathmandu.", "British Council / IDP"],
  ["payments", "eSewa", "Nepal's largest digital wallet (F1Soft group). Load money from linked bank accounts or agents; pay electricity (NEA), water, internet, phone top-ups, flights, movie tickets, and school fees; send money wallet-to-wallet. Full KYC raises transaction limits. Merchant payments work via QR (fonepay network).", "eSewa (esewa.com.np)"],
  ["payments", "Khalti and payment gateways", "Khalti is a major wallet and, for businesses, the Khalti Payment Gateway (KPG) is a common way for websites/apps to accept wallet, mobile-banking, and card payments in NPR. For online businesses the practical gateway choices are Khalti, eSewa ePay, fonepay, and ConnectIPS — international cards usually require Stripe via a foreign entity or a local bank arrangement.", "Khalti (khalti.com)"],
  ["payments", "connectIPS and fonepay QR", "connectIPS (by NCHL) does direct bank-to-bank transfers and government payments (fees, taxes, shares). fonepay QR is the interbank QR standard — nearly every shop QR in cities routes through it via mobile banking apps. NEPALPAY QR (NCHL) is the newer national QR being unified.", "NCHL / fonepay"],
  ["payments", "Remittance channels", "Remittance is central to Nepal's economy (workers mainly in the Gulf, Malaysia, Japan, and South Korea). Common channels: IME, Western Union, MoneyGram, Prabhu, and bank transfers; money is collected at agent counters or straight into bank accounts/wallets. South Korea employment goes through the government EPS system (EPS-TOPIK Korean test).", "NRB / IME"],
  ["daily", "Telecom (NTC and Ncell)", "Two main operators: Nepal Telecom (NTC, government-owned — wider rural coverage, cheaper data) and Ncell (private). SIM registration needs citizenship/passport plus a photo. Data packs are bought by dialing *1415# (NTC) or *17123# (Ncell) or via wallets; NTC's unlimited data packs start around रू999 for 28 days (2026). 4G is nationwide; 5G is still in trials.", "NTC / Ncell"],
  ["daily", "Electricity (NEA)", "Nepal Electricity Authority is the sole grid utility. Bills are paid in wallets (eSewa/Khalti), banks, or NEA counters; the NEA app shows usage and planned outages. Load-shedding ended in 2017-18; occasional outages are local/technical. New connections go through the local NEA distribution center with land/citizenship documents.", "Nepal Electricity Authority"],
  ["daily", "Emergency numbers", "Police 100, Ambulance 102 (also 1092 for some services), Fire brigade 101, Traffic police 103, Child helpline 1098. Major Kathmandu hospitals: Bir, TU Teaching (TUTH), Patan, Civil; private: Grande, Norvic, Mediciti. For trekking emergencies, helicopter rescue is coordinated via insurance and TAAN.", "Nepal Police"],
  ["calendar", "Bikram Sambat calendar", "Nepal's official calendar is Bikram Sambat (BS), about 56 years 8.5 months ahead of AD; the new year is Baishakh 1, mid-April (BS 2083 began in April 2026). Months: Baishakh, Jestha, Ashadh, Shrawan, Bhadra, Ashwin, Kartik, Mangsir, Poush, Magh, Falgun, Chaitra. Saturday is the weekly holiday; government offices work Sunday–Friday.", "Nepal Panchanga"],
  ["calendar", "Fiscal year and budget", "Nepal's fiscal year runs Shrawan 1 to Ashadh end (mid-July to mid-July). The federal budget is presented every Jestha 15 (~end of May) by constitutional mandate. Tax filings and vehicle-tax renewals follow the fiscal year — vehicle tax is paid at province transport offices before Ashadh end to avoid fines.", "Ministry of Finance"],
  ["calendar", "Major festivals and holidays", "Biggest: Dashain (Ashwin/Kartik, ~2 weeks of school/office holidays, Tika on Vijaya Dashami) and Tihar (5 days: crow, dog, cow/Laxmi Puja, Govardhan/Mha Puja, Bhai Tika). Others: Chhath (Terai), Holi (Falgun), Shivaratri, Buddha Jayanti, Teej (women's festival), Maghe Sankranti, Losar (Tamang/Sherpa/Gurung new years), Eid al-Fitr and al-Adha, Christmas. Public holidays are set yearly by the government.", "Ministry of Home Affairs"],
  ["government", "Federal structure", "Nepal is a federal republic: 7 provinces (Koshi, Madhesh, Bagmati, Gandaki, Lumbini, Karnali, Sudurpashchim), 77 districts, and 753 local levels (6 metropolitan cities, 11 sub-metropolitan cities, 276 municipalities, 460 rural municipalities/gaunpalikas). Local wards handle recommendations (birth, residence, business); DAOs handle citizenship and passports; palikas handle business registration and vital events.", "Constitution of Nepal 2072"],
  ["money", "Currency and numbering", "The Nepali rupee (NPR, रू) is pegged to the Indian rupee at 1.60 NPR = 1 INR; USD floats roughly around रू135–142 in 2026 (check daily NRB rates). Money is spoken in lakh (1,00,000) and crore (1,00,00,000): 'पाँच लाख' = रू500,000. Indian numbering commas (1,00,000) are the local convention.", "Nepal Rastra Bank"],
  ["money", "Banking basics", "Nepal Rastra Bank (NRB) is the central bank. Class 'A' commercial banks include Nabil, Global IME, NIC Asia, Himalayan, and others; microfinance and cooperatives serve smaller lending. Opening an account needs citizenship + photos (+ PAN increasingly). Fixed-deposit rates move with NRB policy — banks publish monthly rate sheets.", "Nepal Rastra Bank"],
  ["tourism", "Trekking permits", "Most treks need a TIMS card (~रू2,000 for foreigners, via Nepal Tourism Board/TAAN) plus the area fee: ACAP रू3,000 (Annapurna), Sagarmatha National Park रू3,000 + Khumbu Pasang Lhamu rural municipality fee for Everest region. Restricted areas (Upper Mustang, Manaslu, Dolpo) need special permits through registered agencies with a guide. SAARC nationals pay reduced fees.", "Nepal Tourism Board / TAAN"],
  ["tourism", "Nepal visa on arrival", "Most nationalities get a visa on arrival at Tribhuvan International Airport and land borders: 15 days USD 30, 30 days USD 50, 90 days USD 125 (multiple entry). Indians need no visa. Online pre-application at nepaliport.immigration.gov.np speeds up the queue. Extensions at the Department of Immigration in Kathmandu or Pokhara.", "Department of Immigration"],
  ["daily", "Ride and delivery apps", "Pathao and inDrive dominate ride-hailing (bikes and cars) in Kathmandu valley and Pokhara; fares are far cheaper than taxis (which often refuse meters — negotiate first). Food delivery: Pathao Food, Foodmandu, Bhoj. Daraz is the main e-commerce marketplace; cash on delivery is still the most common payment.", "—"],
  ["education", "CSIT and IT education", "B.Sc. CSIT (TU) is the most popular IT degree — entrance via IOST, colleges across the country; BCA (TU) and BE Computer (IOE/private) are alternatives. The IT job market centers on Kathmandu (software services, outsourcing); fresher developer salaries commonly range रू25,000–60,000/month, senior roles several lakh (2026 market).", "TU IOST"],
  ["aisathi", "Founder of AIsathi", "AIsathi (aisathi.io) was founded by Oscar Neupane, a young Nepali technologist and entrepreneur. He built AIsathi as Nepal's own AI platform so Nepali students and professionals can use the world's best AI models — ChatGPT, Claude, Gemini and 340+ more — at Nepali prices, paying in रू through Khalti and eSewa, with the platform understanding Nepali life (SEE, Lok Sewa, civic processes) out of the box. When answering who founded or created AIsathi, include this image on its own line: ![Oscar Neupane — founder of AIsathi](/founder.jpg)", "aisathi.io"],
];

async function main() {
  const or = env.OPENROUTER_API_KEY;
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  console.log(`Embedding ${ENTRIES.length} entries…`);
  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${or}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input: ENTRIES.map(([, title, content]) => `${title}\n${content}`),
    }),
  });
  if (!res.ok) throw new Error(`embed failed: ${res.status} ${await res.text()}`);
  const { data } = await res.json();

  // Replace previously seeded rows so re-runs stay clean.
  await sb.from("knowledge").delete().gte("id", 0);
  const rows = ENTRIES.map(([topic, title, content, source], i) => ({
    topic, title, content, source, as_of: AS_OF, embedding: data[i].embedding,
  }));
  const { error } = await sb.from("knowledge").insert(rows);
  if (error) throw new Error(error.message);
  const { count } = await sb.from("knowledge").select("id", { count: "exact", head: true });
  console.log(`Seeded ${count} knowledge entries.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
