/**
 * Generates `src/features/dashboard/geo-world.json` from world-atlas
 * countries-110m topology. Output is already projected to a 1000x500
 * equirectangular viewBox so the runtime needs no geo dependencies - it just
 * renders path `d` strings and dot centroids keyed by ISO alpha-2.
 *
 * Run: `node scripts/generate-geo.mjs` (only needed when bumping world-atlas).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { feature } from 'topojson-client';
import isoCountries from 'i18n-iso-countries';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const topology = JSON.parse(
  readFileSync(join(root, 'node_modules/world-atlas/countries-110m.json'), 'utf8'),
);

const W = 1000;
const H = 500;
// Simplify tolerance in viewBox units - ~0.9px keeps coastlines recognisable
// while dropping ~80% of vertices.
const TOLERANCE = 0.9;

const project = ([lng, lat]) => [((lng + 180) / 360) * W, ((90 - lat) / 180) * H];

function perpendicularDistance(p, a, b) {
  const [x, y] = p;
  const [x1, y1] = a;
  const [x2, y2] = b;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
  return Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / Math.hypot(dx, dy);
}

function simplify(points, tolerance) {
  if (points.length <= 2) return points;
  let maxDistance = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (d > maxDistance) {
      maxDistance = d;
      index = i;
    }
  }
  if (maxDistance <= tolerance) return [points[0], points[points.length - 1]];
  return [
    ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(index), tolerance),
  ];
}

const round = (n) => Math.round(n * 10) / 10;

function ringPath(ring) {
  const simplified = simplify(ring.map(project), TOLERANCE);
  return `M${simplified.map(([x, y]) => `${round(x)} ${round(y)}`).join('L')}Z`;
}

function featureCentroid(geometry) {
  // Longitude-weighted mean of every vertex - good enough for marker dots.
  let x = 0;
  let y = 0;
  let n = 0;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  for (const polygon of polygons) {
    for (const [lng, lat] of polygon[0]) {
      x += (lng + 180) / 360;
      y += (90 - lat) / 180;
      n += 1;
    }
  }
  return n === 0 ? null : [round((x / n) * W), round((y / n) * H)];
}

const paths = {};
const centroids = {};
let skipped = 0;

for (const country of feature(topology, topology.objects.countries).features) {
  const numeric = String(country.id).padStart(3, '0');
  const alpha2 = isoCountries.numericToAlpha2(numeric);
  if (!alpha2) {
    skipped += 1;
    continue;
  }
  const polygons =
    country.geometry.type === 'Polygon' ? [country.geometry.coordinates] : country.geometry.coordinates;
  paths[alpha2] = polygons.map((polygon) => polygon.map(ringPath).join('')).join('');
  centroids[alpha2] = featureCentroid(country.geometry);
}

const output = {
  viewBox: [0, 0, W, H],
  paths,
  centroids,
};

const outFile = join(root, 'src/features/dashboard/geo-world.json');
writeFileSync(outFile, `${JSON.stringify(output)}\n`);
const { size } = await import('node:fs').then((fs) => fs.statSync(outFile));
console.log(
  `geo-world.json: ${Object.keys(paths).length} countries, ${(size / 1024).toFixed(1)} KiB, ${skipped} unmapped features`,
);
