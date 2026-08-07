// =============================================================================
//  gris-icones.mjs — Passe des PNG en niveaux de gris, sur place, sans dépendance.
//
//  Node pur (zlib intégré) : le projet n'embarque aucune bibliothèque d'image et
//  n'a pas à en embarquer une pour un outil d'assets ponctuel.
//
//  Usage :
//    node scripts/gris-icones.mjs public/assets/spells            (récursif)
//    node scripts/gris-icones.mjs public/assets/spells --essai    (n'écrit rien)
//    node scripts/gris-icones.mjs <dossier> --sauvegarde <dossier_de_copie>
//
//  IDEMPOTENT : un fichier déjà gris est laissé tel quel. Le relancer ne coûte rien
//  et ne dégrade rien — utile, les icônes arrivant par vagues au fil des refontes.
//
//  Coefficients de luminance Rec.709 (0.2126 / 0.7152 / 0.0722) : ce sont ceux du
//  `filter: grayscale(1)` du CSS, donc un fichier converti ici et une icône grisée
//  par le navigateur rendent la MÊME nuance. Ne pas les remplacer par du Rec.601
//  sans le vouloir : les deux voies divergeraient visuellement.
//
//  Limites assumées : PNG 8 bits non entrelacés, couleur vraie avec ou sans alpha
//  (types 2 et 6). Tout autre format est refusé bruyamment plutôt que corrompu.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const TABLE_CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABLE_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Découpe un PNG en sa liste de chunks, dans l'ordre du fichier. */
function lireChunks(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error("signature PNG absente");
  const chunks = [];
  let i = 8;
  while (i < buf.length) {
    const taille = buf.readUInt32BE(i);
    const type = buf.toString("ascii", i + 4, i + 8);
    chunks.push({ type, data: buf.subarray(i + 8, i + 8 + taille) });
    i += 12 + taille;
  }
  return chunks;
}

function ecrireChunks(chunks) {
  const morceaux = [SIGNATURE];
  for (const { type, data } of chunks) {
    const entete = Buffer.alloc(4);
    entete.writeUInt32BE(data.length, 0);
    const corps = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(corps), 0);
    morceaux.push(entete, corps, crc);
  }
  return Buffer.concat(morceaux);
}

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** Retire le filtre de chaque scanline (types 0 à 4 de la spec PNG). */
function defiltrer(brut, largeur, hauteur, bpp) {
  const parLigne = largeur * bpp;
  const sortie = Buffer.alloc(hauteur * parLigne);
  for (let y = 0; y < hauteur; y++) {
    const filtre = brut[y * (parLigne + 1)];
    const src = y * (parLigne + 1) + 1;
    const dst = y * parLigne;
    const prec = dst - parLigne;
    for (let x = 0; x < parLigne; x++) {
      const val = brut[src + x];
      const a = x >= bpp ? sortie[dst + x - bpp] : 0;
      const b = y > 0 ? sortie[prec + x] : 0;
      const c = y > 0 && x >= bpp ? sortie[prec + x - bpp] : 0;
      let out;
      switch (filtre) {
        case 0: out = val; break;
        case 1: out = val + a; break;
        case 2: out = val + b; break;
        case 3: out = val + ((a + b) >> 1); break;
        case 4: out = val + paeth(a, b, c); break;
        default: throw new Error(`filtre de scanline inconnu : ${filtre}`);
      }
      sortie[dst + x] = out & 0xff;
    }
  }
  return sortie;
}

/** Ré-encode sans filtre (type 0) : la compression suffit sur des icônes. */
function refiltrer(pixels, largeur, hauteur, bpp) {
  const parLigne = largeur * bpp;
  const sortie = Buffer.alloc(hauteur * (parLigne + 1));
  for (let y = 0; y < hauteur; y++) {
    sortie[y * (parLigne + 1)] = 0;
    pixels.copy(sortie, y * (parLigne + 1) + 1, y * parLigne, (y + 1) * parLigne);
  }
  return sortie;
}

/** Convertit un PNG en gris. Renvoie `null` si l'image est DÉJÀ grise (rien à faire). */
export function grisPng(buf) {
  const chunks = lireChunks(buf);
  const ihdr = chunks.find((c) => c.type === "IHDR");
  if (!ihdr) throw new Error("IHDR absent");
  const largeur = ihdr.data.readUInt32BE(0);
  const hauteur = ihdr.data.readUInt32BE(4);
  const profondeur = ihdr.data[8];
  const typeCouleur = ihdr.data[9];
  const entrelace = ihdr.data[12];

  if (profondeur !== 8) throw new Error(`profondeur ${profondeur} non gérée (8 attendue)`);
  if (entrelace !== 0) throw new Error("PNG entrelacé non géré");
  if (typeCouleur !== 2 && typeCouleur !== 6)
    throw new Error(`type de couleur ${typeCouleur} non géré (2 ou 6 attendus)`);

  const bpp = typeCouleur === 6 ? 4 : 3;
  const idat = Buffer.concat(chunks.filter((c) => c.type === "IDAT").map((c) => c.data));
  const pixels = defiltrer(zlib.inflateSync(idat), largeur, hauteur, bpp);

  let modifie = false;
  for (let i = 0; i < pixels.length; i += bpp) {
    const r = pixels[i], v = pixels[i + 1], b = pixels[i + 2];
    if (r === v && v === b) continue; // pixel déjà neutre
    const g = Math.round(0.2126 * r + 0.7152 * v + 0.0722 * b);
    pixels[i] = pixels[i + 1] = pixels[i + 2] = g;
    modifie = true;
  }
  if (!modifie) return null;

  const compresse = zlib.deflateSync(refiltrer(pixels, largeur, hauteur, bpp), { level: 9 });
  // Les chunks non-IDAT sont préservés dans leur ordre d'origine ; les IDAT multiples
  // sont fusionnés en un seul, à la place du premier.
  const sortie = [];
  let idatPose = false;
  for (const c of chunks) {
    if (c.type !== "IDAT") { sortie.push(c); continue; }
    if (!idatPose) { sortie.push({ type: "IDAT", data: compresse }); idatPose = true; }
  }
  return ecrireChunks(sortie);
}

function* pngs(racine) {
  for (const e of fs.readdirSync(racine, { withFileTypes: true })) {
    const p = path.join(racine, e.name);
    if (e.isDirectory()) yield* pngs(p);
    else if (e.name.toLowerCase().endsWith(".png")) yield p;
  }
}

const args = process.argv.slice(2);
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || args.length) {
  const racine = args.find((a) => !a.startsWith("--"));
  if (!racine) {
    console.error("usage : node scripts/gris-icones.mjs <dossier> [--essai] [--sauvegarde <dossier>]");
    process.exit(1);
  }
  const essai = args.includes("--essai");
  const iSauv = args.indexOf("--sauvegarde");
  const sauvegarde = iSauv >= 0 ? args[iSauv + 1] : null;

  let convertis = 0, deja = 0;
  const echecs = [];
  for (const f of pngs(racine)) {
    let sortie;
    try { sortie = grisPng(fs.readFileSync(f)); }
    catch (e) { echecs.push(`${f} : ${e.message}`); continue; }
    if (sortie === null) { deja++; continue; }
    convertis++;
    if (essai) { console.log("  à convertir :", f); continue; }
    if (sauvegarde) {
      const cible = path.join(sauvegarde, path.relative(racine, f));
      fs.mkdirSync(path.dirname(cible), { recursive: true });
      fs.copyFileSync(f, cible);
    }
    fs.writeFileSync(f, sortie);
  }
  console.log(`${convertis} converti(s), ${deja} déjà gris${essai ? " (essai : rien écrit)" : ""}`);
  // Un format refusé est une ALERTE, pas un détail : le fichier reste en couleur et
  // dépareillerait en silence si l'échec passait inaperçu.
  if (echecs.length) {
    console.error(`\n${echecs.length} échec(s) — ces fichiers restent en couleur :`);
    for (const e of echecs) console.error("  " + e);
    process.exit(1);
  }
}
