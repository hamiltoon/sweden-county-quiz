# Sverigespelet

Ett geografispel i webbläsaren om Sveriges 21 län och residensstäder. Klicka rätt på kartan, samla poäng och slå ditt bästa resultat – fungerar lika bra på mobilen som på datorn.

![Sverigespelet](docs/screenshot.png)

## Spela

Spelet finns på **https://sverigespelet.REPLACE_ME.workers.dev**

Källkod: [github.com/hamiltoon/sweden-county-quiz](https://github.com/hamiltoon/sweden-county-quiz)

Det är en PWA, så det går att lägga till på hemskärmen och spela offline.

## Spellägen och poäng

- **Län** – klicka på rätt län.
- **Residensstad** – klicka där staden ligger (inom 40 km, `cityRadiusKm` i `src/game/config.ts`).
- **Blandat** – slumpar mellan län- och stadsfrågor.

En omgång går igenom alla 21 län i slumpad ordning. Rätt på första, andra eller tredje försöket ger 3, 2 respektive 1 poäng; därefter visas rätt svar och frågan ger 0 poäng (max 63 poäng per omgång). Poängfunktionen är utbytbar (`defaultScoring` i `src/game/config.ts`). Bästa resultat per läge sparas i `localStorage`.

## Kör lokalt

```sh
npm install
npm run dev          # Vite dev-server med hot reload
npm run build        # bygger till dist/
npm run preview:cf   # bygger + wrangler dev, serverar dist/ precis som på Cloudflare
```

`npm run typecheck` kör `tsc --noEmit`.

## Deploya

```sh
npx wrangler login   # en gång
npm run deploy       # npm run build && wrangler deploy
```

Sajten deployas som en statisk site på Cloudflare Workers. `wrangler.jsonc` pekar ut `dist/` som static assets med `not_found_handling: "single-page-application"` (SPA-fallback till `index.html`) – det finns inget Worker-script, bara filerna.

## Kartdata

`public/data/lan.topo.json` (ca 65 kB TopoJSON, WGS84) innehåller Sveriges 21 län. Den är byggd från Natural Earth 1:10m *Admin 1 – States, Provinces* ([naturalearthdata.com](https://www.naturalearthdata.com/), [nvkelso/natural-earth-vector](https://github.com/nvkelso/natural-earth-vector)), filtrerad på Sverige, med länskod från ISO 3166-2 och namn satta till de officiella länsnamnen.

Natural Earth är public domain – ingen attribution krävs, men spelet länkar till källan i sidfoten. *Made with Natural Earth.*

Bygg om kartdatan (laddar ner källfilen, ca 40 MB, och kör mapshaper via `npx`):

```sh
./scripts/build-geodata.sh [sökväg/till/ne_10m_admin_1_states_provinces.geojson]
```

Residensstädernas koordinater ligger i `src/data/counties.ts`.

Ikonerna i `public/icons/` renderas från `icon.svg` med `node scripts/make-icons.mjs` (kräver [Playwright](https://playwright.dev/) med Chromium; sätt `PLAYWRIGHT_PKG` om paketet inte finns lokalt).

## Kodstruktur

Vite + TypeScript utan ramverk (vanilla DOM). Kartan ritas som SVG med [d3-geo](https://github.com/d3/d3-geo) (transversal Mercator), [d3-zoom](https://github.com/d3/d3-zoom) för pinch-zoom/panorering och [topojson-client](https://github.com/topojson/topojson-client).

- `src/main.ts` – startar appen och kopplar ihop spel, karta och UI.
- `src/data/` – länen med koder, namn, residensstäder och koordinater.
- `src/game/` – spellogik: frågor, försök, poäng (`config.ts`), avståndsberäkning och lagring av bästa resultat.
- `src/map/` – SVG-kartan: projektion, zoom, klick, markeringar.
- `src/ui/` – start- och resultatskärm, DOM-hjälpare, toast.
- `src/pwa.ts` – registrerar service workern i produktion.
- `src/style.css` – stilar, mobile first, dark mode via `prefers-color-scheme`.
- `public/` – kartdata, ikoner och `manifest.webmanifest`.
- `scripts/` – bygger kartdata och ikoner.
- `vite.config.ts` – Vite-konfig med ett litet plugin som genererar `sw.js` (precachar appen och kartdatan).
- `wrangler.jsonc` – Cloudflare Workers-konfig (static assets).

## Licens

MIT, se [LICENSE](LICENSE). © John Mårtensson.

Kartdata från [Natural Earth](https://www.naturalearthdata.com/), public domain.
