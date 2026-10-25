# Sverigespelet

Ett geografispel i webbläsaren om Sveriges 21 län, residensstäder, 75 andra städer och tio största sjöar. Klicka rätt på kartan, samla poäng och ta dig in på topplistan – fungerar lika bra på mobilen som på datorn.

![Sverigespelet](docs/screenshot.png)

## Spela

Spelet finns på **https://sverigespelet.hamiltoon.workers.dev**

Källkod: [github.com/hamiltoon/sweden-county-quiz](https://github.com/hamiltoon/sweden-county-quiz)

Det är en PWA, så det går att lägga till på hemskärmen och spela offline.

## Spellägen och poäng

- **Län** – klicka på rätt län.
- **Residensstad** – klicka där staden ligger (inom 30 km, `cityRadiusKm` i `src/game/config.ts`).
- **Fler städer** – 20 slumpade av Sveriges 75 största städer som inte är residensstäder. Ett klick inom 30 km från staden ger poäng, precis som för residensstäderna.
- **Sjöar** – klicka på rätt sjö bland Sveriges tio största. Vid en miss på land visas hur långt bort klicket var.
- **Blandat** – slumpar mellan län- och stadsfrågor.

En omgång går igenom alla 21 län (alla tio sjöar, eller 20 av de andra städerna) i slumpad ordning. Rätt på första, andra eller tredje försöket ger 3, 2 respektive 1 poäng; därefter visas rätt svar och frågan ger 0 poäng (max 63 poäng per omgång, 60 för Fler städer, 30 i sjöläget).

Under omgången fylls kartan: grönt för rätt direkt, gult för rätt efter fler försök och rött för missade. Det gör de sista frågorna lättare genom uteslutning; stäng av med `fillMapDuringRound` i `src/game/config.ts`. Vid en missad fråga zoomar kartan mjukt in på rätt svar. Slutskärmen visar poängen i en ring och en minikarta över hur varje fråga gick.

I de andra lägena finns sjöarna kvar på kartan som riktmärken, utan namn. Klicken går igenom sjöarna till länen under. Poängfunktionen är utbytbar (`defaultScoring` i `src/game/config.ts`). Bästa resultat per läge sparas också i `localStorage` och visas på startskärmen.

## Topplista

Skriv ett namn (på startskärmen eller efter en omgång) så sparas varje avslutad omgång på topplistan. Topplistan visar varje spelares bästa resultat per läge, topp 10. Fliken **Totalt** summerar varje spelares bästa resultat i alla fem lägena (max 279 poäng). Lika poäng ger delad placering, och den som kom dit först står överst.

- **Tidigare resultat:** första gången man väljer namn laddas webbläsarens sparade rekord upp, ett per läge.
- **Offline:** resultat som inte går att skicka läggs i en kö i `localStorage` och skickas nästa gång startskärmen visas. Varje resultat har ett eget id, så ett omförsök sparar aldrig dubbelt.
- **Rimlighetskontroll:** servern godtar bara poäng som går att få i läget och som stämmer med andelen rätt. Den kan inte bevisa att en omgång faktiskt spelats, så topplistan bygger på förtroende.
- **Integritet:** namnet visas öppet för alla. IP-adressen används bara för att begränsa antalet sparningar (20 per minut) och sparas inte.

### Skydda namnet med passkey

Vem som helst kan spela med ett namn utan konto. Den som vill kan skydda sitt namn med en passkey (Face ID, Touch ID, skärmlåset eller en säkerhetsnyckel): då kan bara den som är inloggad spara resultat under namnet, och samma passkey loggar in på andra enheter (passkeys synkas via iCloud-nyckelringen eller Googles lösenordshanterare).

- Inga lösenord, ingen e-post. Servern sparar bara passkeyns publika nyckel.
- Inloggningen är en slumpad token i en `HttpOnly`-, `Secure`-, `SameSite=Strict`-cookie som gäller i 180 dagar; databasen har bara en hash av den. Spelets JavaScript kan inte läsa den.
- Ett skyddat namn kan inte tas av någon annan. Försöker någon spara under det utan att vara inloggad avvisas resultatet, och det ligger kvar i kön tills hen loggar in eller byter namn.
- POST-anrop från andra webbplatser avvisas (kontroll av `Origin`), så inloggningen kan inte missbrukas via någon annans sida.
- WebAuthn sköts av [SimpleWebAuthn](https://simplewebauthn.dev/) (`@simplewebauthn/server` i Workern, `@simplewebauthn/browser` i spelet). Relying Party är värdnamnet sidan körs på, så det fungerar både lokalt (`http://localhost:8787`) och i produktion.

## Kör lokalt

```sh
npm install
npm run dev          # Vite dev-server med hot reload
npm run build        # bygger till dist/
npm run preview:cf   # bygger, skapar lokal D1-databas och kör wrangler dev med API:t, som på Cloudflare
```

Topplistan behöver API:t, så den fungerar i `npm run preview:cf` men inte i `npm run dev`.

`npm run typecheck` kör `tsc` för både spelet och Worker-scriptet.

## Deploya

```sh
npx wrangler login           # en gång
npm run db:migrate:remote    # när det finns nya filer i migrations/
npm run deploy               # npm run build && wrangler deploy
```

Sajten deployas till Cloudflare Workers. `wrangler.jsonc` pekar ut `dist/` som static assets med `not_found_handling: "single-page-application"` (SPA-fallback till `index.html`). Bara `/api/*` går till Worker-scriptet i `worker/index.ts` (`run_worker_first`); allt annat serveras direkt som filer.

Topplistan och kontona ligger i D1-databasen `sverigespelet` (tabellerna `scores`, `players`, `passkeys`, `sessions` och `auth_challenges`, se `migrations/`). Antalet sparningar per IP-adress begränsas med Workers rate limiting (`SUBMIT_LIMITER`). Kör `npx wrangler types worker/worker-configuration.d.ts` efter ändringar i `wrangler.jsonc`.

API:

- `GET /api/scores?mode=lan&limit=10` – bästa resultat per spelare i ett läge (`lan`, `stad`, `sjo`, `blandat`), eller `mode=total` för summan av varje spelares bästa resultat i alla lägen.
- `POST /api/scores` med `{ "name": "...", "results": [{ "id", "mode", "score", "percent", "playedAt" }] }` – sparar upp till tio resultat och svarar med spelarens placering per läge och totalt. Inloggad spelare sparar alltid under kontots namn.
- `GET /api/me` – inloggad spelare (`{ "name": null }` om ingen).
- `POST /api/passkey/register/options` och `.../register/verify` – skydda ett namn med en ny passkey (eller lägg till en passkey till det egna kontot).
- `POST /api/passkey/login/options` och `.../login/verify` – logga in med en befintlig passkey.
- `POST /api/logout` – logga ut den här enheten.

## Kartdata

`public/data/lan.topo.json` (ca 65 kB TopoJSON, WGS84) innehåller Sveriges 21 län. Den är byggd från Natural Earth 1:10m *Admin 1 – States, Provinces* ([naturalearthdata.com](https://www.naturalearthdata.com/), [nvkelso/natural-earth-vector](https://github.com/nvkelso/natural-earth-vector)), filtrerad på Sverige, med länskod från ISO 3166-2 och namn satta till de officiella länsnamnen.

`public/data/sjoar.topo.json` (ca 19 kB) innehåller Sveriges tio största sjöar från Natural Earth 1:10m *Lakes + Reservoirs*. Vilka sjöar som är störst, och i vilken ordning, följer SMHI:s sjöregister ([lista på Wikipedia](https://sv.wikipedia.org/wiki/Lista_%C3%B6ver_Sveriges_st%C3%B6rsta_sj%C3%B6ar)), inte ytan i Natural Earths förenklade geometri. Listan finns i `src/data/lakes.ts`.

`public/data/grannar.topo.json` (ca 57 kB) innehåller grannländerna runt Östersjön som bakgrund, från Natural Earth 1:10m *Admin 0 – Countries*, klippta till området runt Sverige och förenklade.

Natural Earth är public domain – ingen attribution krävs, men spelet länkar till källan i sidfoten. *Made with Natural Earth.*

Bygg om kartdatan (laddar ner källfilerna, ca 60 MB, och kör mapshaper via `npx`):

```sh
./scripts/build-geodata.sh [ne_10m_admin_1_states_provinces.geojson] [ne_10m_lakes.geojson] [ne_10m_admin_0_countries.geojson]
```

Residensstädernas koordinater ligger i `src/data/counties.ts`.

De 75 andra städerna ligger i `src/data/cities.ts`. Urvalet är de största tätorterna enligt SCB 2023 (folkmängd per tätort, tabell MI0810), utom residensstäderna, förorter till Stockholm, Göteborg och Malmö samt bostadsorterna Märsta, Skoghall och Onsala; urvalsregeln står i filen. Koordinaterna kommer från Wikidata och är kontrollerade mot rätt län på kartan.

Ikonerna i `public/icons/` renderas från `icon.svg` med `node scripts/make-icons.mjs` (kräver [Playwright](https://playwright.dev/) med Chromium; sätt `PLAYWRIGHT_PKG` om paketet inte finns lokalt).

## Kodstruktur

Vite + TypeScript utan ramverk (vanilla DOM). Kartan ritas som SVG med [d3-geo](https://github.com/d3/d3-geo) (transversal Mercator), [d3-zoom](https://github.com/d3/d3-zoom) för pinch-zoom/panorering och [topojson-client](https://github.com/topojson/topojson-client).

- `src/main.ts` – startar appen och kopplar ihop spel, karta och UI.
- `src/data/` – länen med koder, namn, residensstäder och koordinater, samt de största sjöarna.
- `src/game/` – spellogik: frågor, försök, poäng (`config.ts`), avståndsberäkning och lagring av rekord, namn och osända resultat.
- `src/shared/` – topplistans regler och typer, delade av spelet och Worker-scriptet.
- `src/api/` – klienten för topplistans API, med kö för osända resultat, och för kontona (passkeys).
- `src/map/` – SVG-kartan: projektion, zoom, klick, markeringar, sjöar, grannländer och minikartor.
- `src/ui/` – start- och resultatskärm, topplista, DOM-hjälpare, toast.
- `src/pwa.ts` – registrerar service workern i produktion.
- `src/style.css` – stilar, mobile first, dark mode via `prefers-color-scheme`.
- `public/` – kartdata, ikoner och `manifest.webmanifest`.
- `scripts/` – bygger kartdata och ikoner.
- `vite.config.ts` – Vite-konfig med ett litet plugin som genererar `sw.js` (precachar appen och kartdatan; API:t går alltid till nätet).
- `worker/` – Worker-scriptet för `/api/*`: topplistan (`index.ts`), konton med passkeys (`auth.ts`), hjälpare och genererade typer.
- `migrations/` – databasschemat för D1.
- `wrangler.jsonc` – Cloudflare Workers-konfig: static assets, D1 och rate limiting.

## Licens

MIT, se [LICENSE](LICENSE). © John Mårtensson.

Kartdata från [Natural Earth](https://www.naturalearthdata.com/), public domain.
