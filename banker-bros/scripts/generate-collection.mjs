import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "collection/generated");
const SUPPLY = 222;
const COLLECTION_SEED = process.env.COLLECTION_SEED ?? "banker-bros-genesis-222-voxel-v1";
const ASSET_BASE = process.env.ASSET_BASE_URI ?? "ipfs://REPLACE_ASSET_CID";

const traits = {
  Background: [
    ["Midnight Exchange", 25], ["Emerald Grid", 24], ["Art Deco Gold", 18],
    ["Neon Tower", 16], ["Degen Wharf", 10], ["Opening Bell", 6], ["Genesis Vault", 1],
  ],
  "Skin Tone": [
    ["Porcelain", 12], ["Warm Ivory", 13], ["Golden Beige", 14], ["Honey", 14],
    ["Caramel", 14], ["Copper", 12], ["Mahogany", 11], ["Deep Umber", 10],
  ],
  Presentation: [["Masculine", 38], ["Feminine", 38], ["Androgynous", 24]],
  Age: [["Young Professional", 30], ["Prime Executive", 40], ["Seasoned Partner", 22], ["Market Elder", 8]],
  Build: [["Lean", 25], ["Classic", 42], ["Athletic", 20], ["Broad", 13]],
  Face: [["Angular", 24], ["Oval", 24], ["Square", 22], ["Round", 18], ["Diamond", 12]],
  Hair: [
    ["Sculpted Crop", 14], ["Tight Coils", 14], ["Natural Curls", 13], ["Textured Waves", 13],
    ["Long Braids", 9], ["Locs", 8], ["Straight Bob", 8], ["Silver Sweep", 7],
    ["Professional Headscarf", 6], ["Bald", 5], ["High Fade", 3],
  ],
  "Hair Color": [["Midnight", 44], ["Espresso", 24], ["Chestnut", 13], ["Silver", 11], ["Copper", 5], ["Emerald Accent", 3]],
  "Facial Detail": [["Clean Shave", 32], ["Defined Brows", 20], ["Short Beard", 16], ["Goatee", 9], ["Freckles", 8], ["Beauty Mark", 6], ["Silver Beard", 5], ["Scar Detail", 4]],
  Suit: [
    ["Emerald Pinstripe", 30], ["Midnight Tuxedo", 23], ["Cream Double-Breasted", 17],
    ["Burgundy Trading Coat", 12], ["Cobalt Market Jacket", 10],
    ["Acid Lime Power Suit", 6], ["Liquid Gold Tailoring", 2],
  ],
  Eyewear: [
    ["None", 28], ["Round Gold", 24], ["Half-Rim Analyst", 18], ["Emerald Monocle", 12],
    ["Night Desk Shades", 10], ["Laser Ledger", 6], ["Diamond Oracle", 2],
  ],
  Tie: [
    ["Acid Lime", 28], ["Cream", 20], ["Gold", 18], ["Burgundy", 14],
    ["Cobalt", 10], ["No Tie", 8], ["Liquidity Bow", 2],
  ],
  Accessory: [
    ["Ledger", 24], ["Liquidity Orb", 22], ["Market Phone", 18], ["Espresso", 14],
    ["Tiny Bell", 10], ["Vault Key", 7], ["Diamond Hands", 4], ["Genesis Block", 1],
  ],
  District: [
    ["Neon Heights", 22], ["Old Exchange", 20], ["Degen Wharf", 18],
    ["Emerald Row", 16], ["Founders Square", 12], ["Oracle Park", 8], ["Genesis Vault", 4],
  ],
};

const palette = {
  "Skin Tone": { Porcelain: "#f0c8ad", "Warm Ivory": "#e2b08e", "Golden Beige": "#c99065", Honey: "#b9794c", Caramel: "#9a603b", Copper: "#7e482f", Mahogany: "#5c3528", "Deep Umber": "#3a241e" },
  "Hair Color": { Midnight: "#101316", Espresso: "#2a1712", Chestnut: "#5a321e", Silver: "#c5c8c2", Copper: "#a54b25", "Emerald Accent": "#176544" },
  Suit: { "Emerald Pinstripe": "#0f3d2b", "Midnight Tuxedo": "#101a17", "Cream Double-Breasted": "#dfdfc8", "Burgundy Trading Coat": "#572635", "Cobalt Market Jacket": "#183f68", "Acid Lime Power Suit": "#8ebd36", "Liquid Gold Tailoring": "#a77920" },
  Tie: { "Acid Lime": "#bdff51", Cream: "#f1ead1", Gold: "#d9ad38", Burgundy: "#8d2c45", Cobalt: "#2b66a1", "No Tie": "#d9e2d5", "Liquidity Bow": "#73f4c4" },
};

function hash(input) { return createHash("sha256").update(input).digest(); }
function hexHash(input) { return createHash("sha256").update(input).digest("hex"); }
function randomUnit(buffer, offset) { return buffer.readUInt32BE(offset % 28) / 0xffffffff; }
function choose(table, value) {
  const total = table.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = value * total;
  for (const [name, weight] of table) { if (cursor < weight) return name; cursor -= weight; }
  return table.at(-1)[0];
}
function escape(value) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;"); }

function generateTraits(id, nonce = 0) {
  const entropy = hash(`${COLLECTION_SEED}:${id}:${nonce}`);
  const result = {};
  Object.entries(traits).forEach(([category, table], index) => {
    result[category] = choose(table, randomUnit(entropy, index * 3));
  });
  return result;
}

function fingerprint(values) { return Object.values(values).join("|"); }

function background(name) {
  const colors = {
    "Midnight Exchange": ["#07110d", "#173226"], "Emerald Grid": ["#082219", "#1c7049"],
    "Art Deco Gold": ["#17150c", "#7f631e"], "Neon Tower": ["#091525", "#274c65"],
    "Degen Wharf": ["#241126", "#6d2d66"], "Opening Bell": ["#412414", "#d88737"],
    "Genesis Vault": ["#08140f", "#bdff51"],
  }[name];
  return `<defs><linearGradient id="bg" x2="0" y2="1"><stop stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient><pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M64 0H0V64" fill="none" stroke="#bdff51" stroke-opacity=".09" stroke-width="2"/></pattern><filter id="glow"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect width="1000" height="1000" fill="url(#bg)"/><rect width="1000" height="1000" fill="url(#grid)"/><circle cx="500" cy="320" r="280" fill="none" stroke="#d9ad38" stroke-opacity=".45" stroke-width="12"/><path d="M70 750V310M930 750V310M135 210H865M180 145H820" stroke="#d9ad38" stroke-opacity=".35" stroke-width="9"/><path d="M90 730l75-95 70 35 85-150 75 55 105-190 85 90 90-165 90 65 145-200" fill="none" stroke="#bdff51" stroke-opacity=".38" stroke-width="8"/>`;
}

function eyewear(name) {
  if (name === "None") return "";
  if (name === "Emerald Monocle") return `<circle cx="580" cy="388" r="61" fill="none" stroke="#bdff51" stroke-width="15"/><path d="M628 430v130" stroke="#d9ad38" stroke-width="8"/>`;
  if (name === "Night Desk Shades") return `<path d="M332 360h145l-18 88H350zm191 0h145l-18 88H541z" fill="#07110d" stroke="#d9ad38" stroke-width="12"/><path d="M477 382h46" stroke="#d9ad38" stroke-width="12"/>`;
  const stroke = name === "Diamond Oracle" ? "#dcfff3" : name === "Laser Ledger" ? "#ff5da2" : "#d9ad38";
  return `<g fill="none" stroke="${stroke}" stroke-width="13" ${name === "Diamond Oracle" ? 'filter="url(#glow)"' : ""}><circle cx="400" cy="396" r="66"/><circle cx="600" cy="396" r="66"/><path d="M466 396h68M330 377l-67-21M670 377l67-21"/></g>`;
}

function accessory(name) {
  if (name === "Liquidity Orb") return `<g filter="url(#glow)"><circle cx="750" cy="745" r="96" fill="#77f6c5" fill-opacity=".22" stroke="#bdff51" stroke-width="10"/><path d="M695 760l35-48 36 22 40-66" fill="none" stroke="#bdff51" stroke-width="10"/><circle cx="750" cy="745" r="18" fill="#bdff51"/></g>`;
  if (name === "Ledger") return `<g transform="translate(670 675) rotate(-8)"><rect width="190" height="145" rx="12" fill="#e8e8d2" stroke="#d9ad38" stroke-width="10"/><path d="M36 45h116M36 77h116M36 109h82" stroke="#1d4733" stroke-width="10"/></g>`;
  if (name === "Market Phone") return `<g transform="translate(702 660) rotate(9)"><rect width="128" height="205" rx="25" fill="#101814" stroke="#d9ad38" stroke-width="11"/><path d="M28 145l25-38 21 19 29-67" fill="none" stroke="#bdff51" stroke-width="8"/></g>`;
  if (name === "Espresso") return `<g transform="translate(675 710)"><path d="M20 0h140v120H20zM160 25h35q45 0 20 65-10 26-55 18" fill="#f2ead0" stroke="#d9ad38" stroke-width="10"/><path d="M50-30q-22-35 0-60M95-30q-22-35 0-60" fill="none" stroke="#d9eadf" stroke-width="7"/></g>`;
  if (name === "Tiny Bell") return `<g transform="translate(680 680)"><path d="M25 125h175L175 95q-8-80-63-80T49 95z" fill="#d9ad38" stroke="#f8df7a" stroke-width="9"/><rect y="125" width="225" height="28" rx="12" fill="#8a641c"/></g>`;
  if (name === "Vault Key") return `<g transform="translate(690 700) rotate(-25)" fill="none" stroke="#d9ad38" stroke-width="22"><circle cx="42" cy="42" r="38"/><path d="M77 72l145 145m-55-55 35-35m0 70 35-35"/></g>`;
  if (name === "Diamond Hands") return `<path d="M720 680l85-45 70 68-51 118-116-28z" fill="#bfffee" fill-opacity=".72" stroke="#fff" stroke-width="9"/><path d="M720 680l104 141 51-118-70-68-97 158" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="7"/>`;
  if (name === "Genesis Block") return `<g filter="url(#glow)"><path d="M710 675l95-50 95 50v112l-95 54-95-54z" fill="#bdff51" fill-opacity=".28" stroke="#bdff51" stroke-width="10"/><path d="M710 675l95 53 95-53M805 728v113" fill="none" stroke="#bdff51" stroke-width="8"/></g>`;
  return "";
}

function hairstyle(name, color, skin) {
  if (name === "Bald") return `<path d="M362 320q138-115 276 0" fill="none" stroke="${skin}" stroke-width="30"/>`;
  if (name === "Professional Headscarf") return `<path d="M332 372q12-194 168-200 156 6 168 200l-52 22-33-100q-83-73-166 0l-33 100z" fill="#172e56" stroke="#d9ad38" stroke-width="12"/><path d="M618 340q65 120 7 252" fill="none" stroke="#172e56" stroke-width="54"/>`;
  if (name === "Long Braids") return `<g fill="none" stroke="${color}" stroke-width="28" stroke-linecap="square"><path d="M350 260q-40 180-20 410M400 220q-35 210-18 475M600 220q35 210 18 475M650 260q40 180 20 410"/></g><path d="M340 302q30-160 160-165 130 5 160 165-155-80-320 0z" fill="${color}"/>`;
  if (name === "Locs") return `<g fill="none" stroke="${color}" stroke-width="34" stroke-linecap="round"><path d="M350 240q-40 155-16 360M400 195q-45 170-25 410M450 175q-30 155-17 355M550 175q30 155 17 355M600 195q45 170 25 410M650 240q40 155 16 360"/></g>`;
  if (name === "Tight Coils") return `<g fill="${color}">${Array.from({ length: 15 }, (_, i) => `<rect x="${330 + (i % 5) * 70}" y="${165 + Math.floor(i / 5) * 55}" width="82" height="72" rx="20"/>`).join("")}</g>`;
  if (name === "Natural Curls") return `<g fill="${color}">${Array.from({ length: 12 }, (_, i) => `<circle cx="${350 + (i % 4) * 100}" cy="${190 + Math.floor(i / 4) * 70}" r="68"/>`).join("")}</g>`;
  if (name === "Straight Bob") return `<path d="M330 365q5-210 170-218 165 8 170 218l-58 175-24-248q-88-74-176 0l-24 248z" fill="${color}"/>`;
  if (name === "Silver Sweep") return `<path d="M340 300q55-180 270-135l75 80q-190-48-345 55z" fill="${color}"/><path d="M405 185q95-55 210 8" stroke="#fff" stroke-opacity=".35" stroke-width="18"/>`;
  if (name === "High Fade") return `<path d="M365 290q45-142 230-100l48 72q-132-40-278 28z" fill="${color}"/><path d="M380 285v95M620 265v115" stroke="${color}" stroke-width="30"/>`;
  if (name === "Textured Waves") return `<path d="M340 298q40-170 160-170t160 170q-76-34-160-30t-160 30z" fill="${color}"/><path d="M375 210q55-34 105 0t105 0" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="16"/>`;
  return `<path d="M345 304q22-160 155-170 133 10 155 170l-85-54-70 28-70-28z" fill="${color}"/>`;
}

function facialDetail(name, hairColor, skin) {
  if (name === "Short Beard") return `<path d="M376 518q124 116 248 0l-20 148q-104 84-208 0z" fill="${hairColor}" fill-opacity=".88"/>`;
  if (name === "Goatee") return `<path d="M448 596q52 34 104 0l-18 82h-68z" fill="${hairColor}"/>`;
  if (name === "Silver Beard") return `<path d="M374 516q126 120 252 0l-26 162-100 58-100-58z" fill="#b9bdb8"/>`;
  if (name === "Freckles") return `<g fill="#713c2a" fill-opacity=".48"><circle cx="406" cy="480" r="7"/><circle cx="438" cy="490" r="6"/><circle cx="562" cy="490" r="6"/><circle cx="594" cy="480" r="7"/></g>`;
  if (name === "Beauty Mark") return `<circle cx="590" cy="520" r="9" fill="#3b211b"/>`;
  if (name === "Scar Detail") return `<path d="M605 360l-34 142" stroke="#7d3f35" stroke-width="11"/>`;
  if (name === "Defined Brows") return `<path d="M372 373q60-35 112 6M516 379q52-41 112-6" fill="none" stroke="${hairColor}" stroke-width="22"/>`;
  return "";
}

function renderSvg(id, t) {
  const skin = palette["Skin Tone"][t["Skin Tone"]];
  const hairColor = palette["Hair Color"][t["Hair Color"]];
  const suit = palette.Suit[t.Suit];
  const tie = palette.Tie[t.Tie];
  const stripe = t.Suit.includes("Pinstripe") ? `<path d="M270 930l90-355M380 980l70-405M620 980l-70-405M730 930l-90-355" stroke="#d9ad38" stroke-opacity=".28" stroke-width="5"/>` : "";
  const broad = t.Build === "Broad" ? 48 : t.Build === "Athletic" ? 24 : t.Build === "Lean" ? -25 : 0;
  const faceRx = t.Face === "Round" ? 165 : t.Face === "Square" ? 150 : t.Face === "Diamond" ? 132 : 143;
  const faceBottom = t.Face === "Angular" || t.Face === "Diamond" ? 680 : 650;
  const eyeColor = ["#28351f", "#4a2b1a", "#1f4456", "#695027"][id % 4];
  const ageDetail = t.Age === "Market Elder" || t.Age === "Seasoned Partner" ? `<path d="M350 455q55 20 105 0M545 455q50 20 105 0M420 545q80 24 160 0" fill="none" stroke="#6f4b3c" stroke-opacity=".35" stroke-width="9"/>` : "";
  const presentation = t.Presentation === "Feminine" ? `<path d="M415 575q85 35 170 0" fill="none" stroke="#8a394d" stroke-width="14" stroke-linecap="round"/>` : `<path d="M430 585q70 25 140 0" fill="none" stroke="#3d231d" stroke-width="12" stroke-linecap="round"/>`;
  const genesis = [t.Background, t.Accessory, t["Hair Color"]].some((value) => value.includes("Genesis") || value.includes("Emerald Accent"));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" role="img" aria-labelledby="title desc"><title id="title">Banker Bro #${id}</title><desc id="desc">${escape(t.Presentation)} voxel banker with ${escape(t["Skin Tone"])} skin and ${escape(t.Hair)} hair from ${escape(t.District)}</desc>${background(t.Background)}<path d="M${200 - broad} 1000q16-300 ${205 + broad} -388l95 92 95-92q${189 + broad} 88 ${205 + broad} 388z" fill="${suit}" stroke="#07110d" stroke-width="18"/>${stripe}<path d="M404 612l96 92 96-92 58 78-154 119-154-119z" fill="#f0ead7"/><path d="M470 700h60l40 220-70 65-70-65z" fill="${tie}" stroke="#07110d" stroke-width="9"/><g ${genesis ? 'filter="url(#glow)"' : ""}><rect x="${500 - faceRx}" y="245" width="${faceRx * 2}" height="${faceBottom - 245}" rx="${t.Face === "Square" ? 45 : 120}" fill="${skin}" stroke="#17120f" stroke-width="17"/><rect x="${500 - faceRx - 25}" y="400" width="38" height="105" rx="18" fill="${skin}"/><rect x="${500 + faceRx - 13}" y="400" width="38" height="105" rx="18" fill="${skin}"/>${hairstyle(t.Hair, hairColor, skin)}<path d="M370 380q55-30 115 0M515 380q60-30 115 0" fill="none" stroke="${hairColor}" stroke-width="20"/><ellipse cx="420" cy="420" rx="32" ry="22" fill="#f7f2df"/><ellipse cx="580" cy="420" rx="32" ry="22" fill="#f7f2df"/><circle cx="420" cy="420" r="13" fill="${eyeColor}"/><circle cx="580" cy="420" r="13" fill="${eyeColor}"/><path d="M500 420l-28 112 56 0" fill="none" stroke="#754632" stroke-opacity=".55" stroke-width="12"/>${ageDetail}${presentation}${facialDetail(t["Facial Detail"], hairColor, skin)}</g>${eyewear(t.Eyewear)}<circle cx="625" cy="785" r="26" fill="#d9ad38"/><path d="M625 770l8 13-8 18-8-18z" fill="#173d2b"/>${accessory(t.Accessory)}<path d="M44 950h912" stroke="#bdff51" stroke-width="8"/><text x="54" y="980" fill="#eff6e9" font-family="monospace" font-size="28" letter-spacing="4">BANKER BRO #${String(id).padStart(3, "0")}</text><text x="946" y="980" fill="#bdff51" font-family="monospace" font-size="22" text-anchor="end">${escape(t.District.toUpperCase())}</text></svg>`;
}

await mkdir(resolve(OUT, "images"), { recursive: true });
await mkdir(resolve(OUT, "metadata"), { recursive: true });

const used = new Set();
const counts = Object.fromEntries(Object.keys(traits).map((key) => [key, {}]));
const imageHashes = [];

for (let id = 1; id <= SUPPLY; id += 1) {
  let nonce = 0;
  let selected = generateTraits(id, nonce);
  while (used.has(fingerprint(selected))) selected = generateTraits(id, ++nonce);
  used.add(fingerprint(selected));
  Object.entries(selected).forEach(([category, value]) => {
    counts[category][value] = (counts[category][value] ?? 0) + 1;
  });

  const svg = renderSvg(id, selected);
  const imageHash = hexHash(svg);
  imageHashes.push(imageHash);
  const metadata = {
    name: `Banker Bro #${id}`,
    description: "One of 222 original human voxel Banker Bros. The NFT may control a token-bound game account and actively perform approved onchain work; it grants no passive yield, securities rights, brokerage license, or profit promise.",
    image: `${ASSET_BASE}/${id}.svg`,
    external_url: `https://bankerbros.example/collection/${id}`,
    attributes: Object.entries(selected).map(([trait_type, value]) => ({ trait_type, value })),
    compiler: "Banker Bros Genesis 222 deterministic voxel generator v2",
    image_sha256: imageHash,
  };
  await writeFile(resolve(OUT, "images", `${id}.svg`), svg);
  await writeFile(resolve(OUT, "metadata", `${id}.json`), `${JSON.stringify(metadata, null, 2)}\n`);
}

const orderedImageSha256 = hexHash(imageHashes.join(""));
const provenance = {
  name: "Banker Bros: Genesis 222",
  supply: SUPPLY,
  generatorSeedSha256: hexHash(COLLECTION_SEED),
  orderedImageSha256,
  provenanceCommitment: `0x${orderedImageSha256}`,
  algorithm: "sha256(concat(sha256(svg_1), ..., sha256(svg_222)))",
  duplicateTraitCombinations: 0,
};
await writeFile(resolve(OUT, "provenance.json"), `${JSON.stringify(provenance, null, 2)}\n`);
await writeFile(resolve(OUT, "trait-report.json"), `${JSON.stringify(counts, null, 2)}\n`);
await writeFile(resolve(OUT, "contract.json"), `${JSON.stringify({
  name: "Banker Bros: Genesis 222",
  description: "A fixed collection of 222 diverse human voxel bankers with owner-controlled token-bound accounts for approved onchain game activity.",
  image: `${ASSET_BASE}/collection.png`,
  external_link: "https://bankerbros.example",
  seller_fee_basis_points: 500,
  fee_recipient: "REPLACE_ROYALTY_RECEIVER",
}, null, 2)}\n`);

console.log(JSON.stringify({ supply: SUPPLY, output: OUT, orderedImageSha256, unique: used.size }, null, 2));
