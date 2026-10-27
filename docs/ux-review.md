# UX-granskning av Sverigespelet

Oktober 2026 · granskad version: produktionen på https://sverigespelet.hamiltoon.workers.dev (commit `4098fd7`), plus en lokal `wrangler dev` för flöden som sparar data.

## Metod

- **Enheter:** iPhone 13 (390×844), liten Android (360×740), dator (1440×900) och liggande mobil (844×390), i Chromium via Playwright med touch.
- **Visningslägen:** ljust och mörkt läge (`prefers-color-scheme`), svenska och engelska.
- **Flöden på produktionen:**
  - alla sju lägen från start till slutskärm, med rätt svar, felklick och avslöjande
  - zoom och pan
  - live med två samtidiga spelare (iPhone + Android): skapa rum, gå med via länk, lobby, lägesval och Blandat, 10 frågor, ställning, pall, spela igen, gå med mitt i en match, felaktig rumskod och värden som lämnar
  - offline via service workern
- **Lokalt** (allt som skriver data):
  - spara på topplistan
  - byta namn
  - skydda namnet med passkey (virtuell WebAuthn-autentiserare), logga ut och in
  - en annan enhet som tar ett skyddat namn
- **Mätningar:**
  - axe-core 4.10 (WCAG 2.2 AA + best practice)
  - kontrastkvoter ur `src/style.css`
  - tryckytor
  - storlek på alla 290 kommuner på skärmen vid zoom 1 och vid max zoom
  - simulering av deuteranopi (Machado 2009)
- **Skyddsräcke:** på produktionen blockerades `POST /api/scores`, `/api/passkey/*` och `/api/me/language` i webbläsaren, så inget skrevs på den riktiga topplistan och inga passkeys skapades.

Skärmbilderna som belägg finns i den publicerade sidan (länk i PR:en). Varje fynd har också en exakt reproduktion.

## Helhetsbedömning

Sverigespelet håller hög hantverksnivå för ett litet projekt:

- Det visuella språket är rent och konsekvent i ljust och mörkt läge.
- Kartan känns snabb: kartdatan är klar på 0,2–0,5 s med varm cache.
- Feedbacktexterna är ovanligt bra: "Fel, det var Uppsala kommun – 11 kommuner bort", "250 km bort. Här ligger Jönköping".
- Minikartan på slutskärmen är en fin sammanfattning.
- Översättningen är komplett.
- Live-läget fungerade felfritt med två samtidiga spelare: QR, länk, Blandat, ställning, pall och spela igen.
- axe hittar bara ett allvarligt fel.

Svagheterna sitter på fyra ställen:

1. **Ergonomin i Kommuner.** Målen är för små och zoomen nollställs vid varje fråga.
2. **Färg och kontrast i själva feedbacken.** Toastkontrasten är för låg, och rätt mot fel skiljs bara med rött mot grönt.
3. **Hierarkin på start- och slutskärmen.** "Spela live" och "Spela igen" hamnar under vecket.
4. **Namn och identitet runt topplistan.** Ett skyddat namn upptäcks först efter omgången, och ett namnbyte skapar en ny identitet.

Alla fyra går att åtgärda utan att ändra spelets karaktär.

**Allvarlighet:** Blockerande (går inte att genomföra) · Stort (påverkar många spelare eller ett kärnflöde) · Litet (irriterar eller drabbar få) · Putsning.

| Id | Rubrik | Allvarlighet |
|---|---|---|
| UX-01 | Kommuner: små mål, zoomen nollställs varje fråga | Stort |
| UX-02 | Rätt/Fel-rutan har för låg kontrast | Stort |
| UX-03 | Rött mot grönt är enda skillnaden mellan rätt och missat | Stort |
| UX-04 | "Spela live" ligger under vecket | Stort |
| UX-05 | "Spela igen" ligger under vecket | Stort |
| UX-06 | Skyddat namn avvisas först efter omgången | Stort |
| UX-07 | Avslöjandet lär ut för lite | Stort |
| UX-08 | Inbjudningssidan förklarar inget | Litet |
| UX-09 | ✕ avslutar utan bekräftelse | Litet |
| UX-10 | "Byt namn" skapar en ny identitet | Litet |
| UX-11 | Kartan går inte att spela med tangentbord eller skärmläsare | Stort |
| UX-12 | Residensstad: hela länet färgas, svaren kan räknas ut | Litet |
| UX-13 | Live-lobbyn tappar tangentbordsfokus | Litet |
| UX-14 | Live-lobbyn: värden måste scrolla till "Starta matchen" | Litet |
| UX-15 | Live: timern saknar siffror, ingen nedräkning | Litet |
| UX-16 | Live: klick i havet ignoreras tyst | Putsning |
| UX-17 | Live: miss på land i sjöfråga ger bara "Fel." | Putsning |
| UX-18 | Autozoom ignorerar reducerad rörelse | Litet |
| UX-19 | "Klicka" på mobil, "Tap" på dator | Putsning |
| UX-20 | Första besöket: reglerna och zoomtipset hamnar sist | Litet |
| UX-21 | Dator: smal kolumn, utspridda kontroller | Putsning |
| UX-22 | Offline: Kommuner fungerar inte, inget "Försök igen" | Litet |
| UX-23 | Liggande mobil: HUD tar nästan halva höjden | Litet |
| UX-24 | Mörkt läge: sjöar och land nästan samma ljushet | Litet |
| UX-25 | Tryckytor under 44 px | Litet |
| UX-26 | Topplistans flikar: halv tab-semantik, tre rader | Litet |
| UX-27 | Passkey-knappen tar över startskärmen | Putsning |
| UX-28 | Rak klippkant i grannländernas karta | Putsning |
| UX-29 | "Nytt bästa resultat!" på första omgången | Putsning |
| UX-30 | Fokus flyttas inte vid skärmbyte; inget h1 | Litet |

---

## De tio viktigaste

### UX-01 Kommuner: nästan alla mål är för små och zoomen nollställs vid varje fråga
- **Var:** spelskärmen i Kommuner, alla enheter; värst på liten Android. Också i Live när Kommuner ingår.
- **Vad som händer:**
  - På iPhone har 274 av 290 kommuner en minsta sida under 44 px vid start, så nästan varje fråga kräver zoom.
  - Zoomen återställs vid varje ny fråga (`if (map.isTransformed) map.resetZoom()` i `src/main.ts` och `src/live/view.ts`). Den som spelar Stockholmskommuner nyper alltså in i samma område 20 gånger.
  - Även vid max zoom (`MAX_ZOOM = 10`) blir de minsta kommunerna under WCAG 2.5.8:s minimum på 24 px, eller strax över det:

    | Kommun | iPhone | Android 360 |
    |---|---|---|
    | Sundbyberg (0183) | 15 px | 13 px |
    | Öckerö (1407) | 17 px | 15 px |
    | Mölndal (0481) | 23 px | 20 px |
    | Solna (0184) | 26 px | 22 px |
    | Burlöv (1231) | 28 px | 24 px |
    | Vaxholm (0186) | 33 px | 28 px |

  - De osynliga träffytorna (`SMALL_COUNTIES`) finns bara för län och landskap.
  - I Live har man 12 sekunder och ett klick, och kommunkartan (90 kB komprimerad, 290 områden) laddas först när den första kommunfrågan kommer. Den laddningstiden äts av frågans tid.
- **Varför det är ett problem:** Kommuner är det svåraste och mest "nördiga" läget, och därmed det som spelas om och om igen. Friktionen gäller varje fråga, och de minsta kommunerna blir ett lotteri med fingret.
- **Påverkan:** alla som spelar Kommuner, särskilt på mobil. Stort.
- **Förslag:**
  1. Zooma automatiskt in mjukt på länet som frågan nämner, eftersom länet redan står i frågan. Länsgränsen kan gärna lysa svagt. Det löser både storleken och nollställningen, och gör att "i Västerbottens län" faktiskt hjälper.
  2. Nollställ inte zoomen mellan frågor om nästa fråga gäller samma län.
  3. Höj max zoom i kommunläget till cirka 25, och/eller ge kommuner under en viss yta en osynlig träffyta, som `SMALL_COUNTIES`.
  4. I Live: förladda `kommuner.topo.json` i lobbyn när läget innehåller kommuner.
- **Belägg:**
  - `kommun-q1.png`: hela landet vid start.
  - `kommun-maxzoom-stockholm.png`: max zoom över Mälaren.
  - Mätskript: storleken på alla `path.county` via `getBoundingClientRect()`, gånger 10.
  - Repro: starta Kommuner, svara rätt på en fråga i Stockholm efter att ha zoomat in; nästa fråga börjar utzoomad.

### UX-02 Rätt/Fel-rutan har för låg kontrast
- **Var:** toasten över kartan i alla lägen, ensamspel och live, ljust och mörkt läge.
- **Vad som händer:** vit text (15,2 px, fet) mot `--ok` och `--bad`. Kraven är 4,5:1 för normal text och 3:1 för stor; 15 px fet räknas inte som stor.

  | Bakgrund | Kontrast |
  |---|---|
  | Grönt, ljust läge | 3,45:1 |
  | Rött, ljust läge | 4,38:1 |
  | Grönt, mörkt läge (`#2fc271`) | 2,31:1 |
  | Rött, mörkt läge (`#ef5e5e`) | 3,26:1 |

  axe flaggar `color-contrast` (serious) på `.toast` i båda lägena.
- **Varför det är ett problem:** det är spelets viktigaste feedback, och den visas bara 1,2–2,4 sekunder. Läsbarheten i sol på mobilen faller först.
- **Påverkan:** alla spelare, mest de med nedsatt syn och de som spelar utomhus. Stort.
- **Förslag:**
  - Egna toastfärger, t.ex. `#13703f` för rätt och `#b42323` för fel; vitt ger då ≥ 6:1.
  - Det mörka lägets ljusa `--ok` och `--bad` kan bära mörk text (`#061020`) i stället.
  - Lägg till ✓/✗ först i texten, så att färgen inte bär budskapet ensam.
- **Belägg:** `game-lan-iphone-light-sv-wrong1.png`, `game-landskap-android-dark-en-right.png`, axe-utdrag.

### UX-03 Rött mot grönt är enda skillnaden mellan rätt och missat
- **Var:** under omgången (`data-result` på länen och prickarna), minikartan, förklaringen på slutskärmen och live-avslöjandet. Alla enheter.
- **Vad som händer:** `--ok` och `--bad` har nästan samma ljushet (kvot 1,27). Med simulerad deuteranopi går missade län (Halland och Jönköping) inte att skilja från de rätta på minikartan, och förklaringens rutor "Rätt direkt" och "Missade" ser likadana ut.
- **Varför det är ett problem:** färg är den enda signalen (WCAG 1.4.1). Rött/grönt-blindhet finns hos cirka 8 % av männen.
- **Påverkan:** en betydande minoritet tappar sammanfattningen helt. Stort.
- **Förslag:**
  - En färgblindsäker palett för resultat: rätt i blått, fler försök i gult och missat i orange eller magenta.
  - Alternativt ett mönster (snedstreck) eller en tjock kontur på missade.
  - Behåll siffrorna i förklaringen; de är bra.
- **Belägg:** `recap-normal.png` jämfört med `recap-deuteranopia.png`.

### UX-04 "Spela live" ligger efter sju lägen, under vecket
- **Var:** startskärmen, alla enheter.
- **Vad som händer:** "Spela live" börjar 1038 px ned på iPhone (skärmen är 844 px), 1079 px på Android och 944 px på datorn (900). Topplistan börjar 1226 px ned. Kortet ser dessutom ut som ett sekundärt kort (bara kontur). Vid första besöket ser man sju likadana kort, vart och ett med "Inget resultat ännu".
- **Varför det är ett problem:** live är den sociala funktionen och den naturliga tillväxtloopen (QR i soffan, i klassrummet). Den syns inte utan att man scrollar och letar.
- **Påverkan:** upptäckten av live och spridningen. Stort.
- **Förslag:**
  - Lägg en kompakt live-banderoll direkt under rubriken ("Spela mot kompisar – skapa ett rum").
  - Eller en växel överst: "Spela själv / Spela live".
  - Gör lägeskorten kompaktare: titel + en rad, och visa "Bästa" först när det finns ett.
  - På datorn kan korten ligga i två kolumner.
- **Belägg:** `startfull-iphone-light-sv.png`, `startfull-android-dark-en.png`.

### UX-05 "Spela igen" hamnar under vecket på slutskärmen
- **Var:** slutskärmen i ensamspel, alla lägen; värst på liten Android.
- **Vad som händer:** knapparna "Spela igen" och "Byt läge" ligger sist, efter poängkortet, topplistan (formulär plus upp till 10 rader) och listorna "Missade" och "Behövde fler försök". På iPhone börjar knappraden 977 px ned (skärmen är 844); på 360 × 740 krävs nästan två skärmhöjder.
- **Varför det är ett problem:** "en gång till" är den viktigaste handlingen i ett casual-spel. Varje extra scroll kostar omspel.
- **Påverkan:** alla spelare efter varje omgång. Stort.
- **Förslag:**
  - Ett klistrat knappfält nederst (`position: sticky; bottom: 0`) med "Spela igen" som primärknapp.
  - Alternativt knapparna direkt under poängkortet, med topplistan och listorna efter.
- **Belägg:** `endfull-lan-iphone-light-sv.png`, `endfull-landskap-android-dark-en.png`; lokalt: knappraden på 977 px före och 980 px efter att namnet sparats.

### UX-06 Ett skyddat namn godtas när man väljer det och avvisas först efter en hel omgång
- **Var:** topplistan på startskärmen och slutskärmen, alla enheter.
- **Reproduktion** (lokalt):
  1. Enhet A skyddar namnet "Testaren2" med passkey.
  2. Enhet B skriver "Testaren2" och trycker Spara. Den får "Du spelar som Testaren2", utan varning.
  3. Enhet B spelar en hel omgång. Först på slutskärmen står det: "Namnet Testaren2 är skyddat. Logga in med din passkey eller välj ett annat namn. Resultatet skickas nästa gång."
  4. Resultatet skickas aldrig om man inte loggar in eller byter namn, så "skickas nästa gång" stämmer inte.

  Dessutom: skriver man ett oskyddat namn som någon annan redan använder (t.ex. "Anna"), slås ens resultat tyst ihop med deras.
- **Varför det är ett problem:** felet visas när det är som dyrast, efter omgången. Texten lovar något som inte händer. Krockar mellan oskyddade namn ger fel person på topplistan.
- **Påverkan:** alla som väljer ett vanligt namn. Stort.
- **Förslag:**
  - Kolla namnet när det väljs (ett litet `GET` för namnet). Är det skyddat: "Namnet är skyddat. Logga in med passkey eller välj ett annat namn." Finns det redan: "Namnet finns redan på topplistan. Är det du?"
  - Ändra texten på slutskärmen till "Resultatet sparas när du loggar in eller byter namn."
- **Belägg:** `local-other-device-taken-name.png`, `local-other-device-end.png`.

### UX-07 Avslöjandet lär ut för lite
- **Var:** spelskärmen, alla lägen, vid miss efter tre försök; också i Live.
- **Vad som händer:**
  - Kartan zoomar in på rätt svar (`focusCounty` och `focusPoint`), men ens eget felklick hamnar ofta utanför bilden. Exempel: frågan gällde Halland och klicket var Jämtland; man ser bara Halland och toasten "Fel – det var Jämtlands län".
  - Rätt svar visas `revealMissMs` = 2,4 s, varav 0,5 s är zoom, och sedan går spelet vidare automatiskt. Man kan inte stanna och titta.
  - Namnet på det rätta svaret står bara i toasten, inte på kartan; i städerna står det på kartan.
- **Varför det är ett problem:** spelet lär ut geografi, och avslöjandet är just då man lär sig. Relationen "jag trodde här, det ligger där" är det man minns.
- **Påverkan:** alla spelare vid varje miss; särskilt barn och nybörjare. Stort.
- **Förslag:**
  - Passa in vyn så att både felklicket och rätt svar syns (union av boundingboxarna).
  - Skriv namnet direkt på rätt område.
  - Vid miss: vänta på "Tryck för att fortsätta" (eller cirka 4 s) och pausa så länge fingret ligger på kartan.
  - Rätt svar kan ha kvar dagens tempo.
- **Belägg:** `game-lan-iphone-light-sv-reveal.png` (Jämtland syns inte), `m-stad-iphone-light-sv-reveal.png`.

### UX-08 Inbjudningssidan (QR/länk) är nya spelares första intryck men förklarar inget
- **Var:** `/live/KOD` för den som inte varit i rummet, alla enheter.
- **Vad som händer:**
  - Sidan visar bara "Spela live – Du är inbjuden till rum U2NQ. Skriv ditt namn och gå med.", ett namnfält och "Tillbaka".
  - Ingen logga och ingen mening om vad spelet är.
  - Inget om vilket läge värden valt eller vem som redan är i rummet.
  - Ingen språkväxel; bara startskärmen har en.
  - Namnfältet är smalare än knappen, och knappen ligger kant i kant under fältet.
  - Etiketten "Namn" har `for="live-name"`, men fältet har inget `id`, så etiketten är inte kopplad.
- **Varför det är ett problem:** de flesta nya spelare som kommer via live landar här först. De vet inte vad de går med i.
- **Påverkan:** konverteringen från inbjudan. Litet.
- **Förslag:**
  - Logga + "Ett geografispel om Sverige – alla får samma fråga samtidigt."
  - "Rum U2NQ · Blandat · 2 spelare väntar".
  - Språkväxel.
  - Fältet i full bredd med 8–12 px mellanrum, och `id="live-name"`.
- **Belägg:** `live-guest-invite.png`.

### UX-09 ✕ avslutar utan bekräftelse
- **Var:** HUD:en i ensamspel och i live, alla enheter.
- **Vad som händer:** ett tryck på ✕ vid fråga 19/21 kastar hela omgången utan fråga. I live lämnar ett tryck matchen direkt; lämnar värden går värdskapet vidare.
- **Varför det är ett problem:** ett feltryck är dyrt, och det går inte att ångra.
- **Påverkan:** få men frustrerande fall. Litet.
- **Förslag:** bekräfta om mer än cirka tre frågor är besvarade ("Avsluta omgången? Resultatet sparas inte."), eller en ångra-toast i 4 s.
- **Belägg:** reproduktion med `misc.js`; startskärmen visas direkt efter tryck.

### UX-10 "Byt namn" skapar en ny identitet, och de gamla resultaten blir kvar under det gamla namnet
- **Var:** topplistan på startskärmen.
- **Reproduktion** (lokalt): spela som "Testaren" (Sjöar, 30 p), tryck "Byt namn", skriv "Testaren2" och spara. "Testaren · 1 av 7 lägen · 30 p" ligger kvar på topplistan, nu utan markering för den egna raden, och Testaren2 börjar om från noll.
- **Varför det är ett problem:** den som rättar ett stavfel förlorar sin totalsumma. Etiketten "Nytt namn för kommande omgångar" säger det indirekt, men inte vad som händer med det gamla.
- **Påverkan:** få men tydligt. Litet.
- **Förslag:** skriv konsekvensen i formuläret ("Dina tidigare resultat ligger kvar under Testaren"). Eller låt namnbytet flytta resultaten om namnet inte är skyddat av någon annan. Det andra är ett produktbeslut för John.
- **Belägg:** `local-start-named.png`, `local-renamed.png`.

---

## Övriga fynd

### UX-11 Kartan går inte att spela med tangentbord eller skärmläsare
- **Var:** spelskärmen, dator och skärmläsare.
- **Vad:** kartan är en `svg role="img"`. Tab går bara till ✕ och zoomknapparna; det finns inget sätt att välja ett område utan pekare (WCAG 2.1.1). Frågan och toasten läses upp (`aria-live`), men svaret går inte att ge.
- **Påverkan:** få spelare, men de är helt utestängda. Stort för dem.
- **Förslag:**
  - Ett tangentbordsläge: piltangenterna flyttar markeringen till grannområdet i den riktningen, och områdets namn läses upp.
  - Eller ett tillgängligt flervalsläge (motsvarande "Omvänt läge" i IDEER.md).
  - Skriv minst en kort tillgänglighetsredogörelse.
- **Belägg:** `kb.js`-utdrag; i spelet går Tab bara mellan ✕, +, − och ⟲.

### UX-12 Residensstad: hela länet färgas efter svaret, så de sista svaren kan räknas ut
- **Var:** Residensstad, och Blandat med städer.
- **Vad:** i Residensstad får hela länet färg (`setCountyResult(q.county.code)`), medan Fler städer får en prick. Med 21 städer i 21 län är den sista frågan alltid "det enda ofärgade länet", och de sista fem blir mycket lätta.
- **Påverkan:** topplistan i Residensstad blir lättare än den ser ut. Litet; produktbeslut (`fillMapDuringRound`).
- **Förslag:** markera städerna med prick även i Residensstad, så som Fler städer.
- **Belägg:** `m-stad-iphone-light-sv-reveal.png` (Jönköpings län fylls).

### UX-13 Live-lobbyn tappar tangentbordsfokus
- **Var:** lobbyn, värden, tangentbord eller skärmläsare.
- **Vad:** att välja läge eller bocka i Blandat ritar om hela lobbyn, och fokus hamnar på `body`.
- **Påverkan:** Litet.
- **Förslag:** uppdatera chippen på plats, eller återställ fokus till samma `data-mode`/`data-kind` efter omritningen.
- **Belägg:** `live.js`; `activeElement` efter Enter på "Blandat" är `BODY`.

### UX-14 Live-lobbyn: värden måste scrolla för att nå "Starta matchen"
- **Var:** lobbyn, mobil.
- **Vad:** rubrik, regler, kodkort, en QR-kod på cirka 180 px, lägesval, blandval och spelarlista kommer före startknappen, som hamnar under vecket på iPhone.
- **Påverkan:** Litet.
- **Förslag:** klistra fast "Starta matchen" nederst. Gör QR-koden fällbar eller mindre när minst en spelare anslutit.
- **Belägg:** `live-lobby-host-blandat-full.png`.

### UX-15 Live: timern saknar siffror, och det finns ingen nedräkning före frågan
- **Var:** live-frågan.
- **Vad:**
  - Tidsstapeln har ingen siffra.
  - Under avslöjandet fortsätter den som en grå stapel (5 s till nästa fråga) utan förklaring.
  - Frågan börjar direkt, så den som tittar bort förlorar sekunder.
- **Påverkan:** Litet.
- **Förslag:**
  - 3–2–1 med frågan stort (IDEER.md nr 1).
  - Sekundsiffror de sista 5 s.
  - Under avslöjandet: texten "Nästa fråga om 4 …".
- **Belägg:** `live-q1-host-answered.png`, `live-reveal5-host.png`.

### UX-16 Live: ett klick i havet på en länsfråga ignoreras tyst
- **Var:** live-frågor om län, landskap och kommuner.
- **Vad:** ensamspelet visar "Klicka på ett län"; live gör ingenting, så spelaren undrar om klicket gick fram.
- **Påverkan:** Putsning.
- **Förslag:** samma tips-toast som i ensamspelet.
- **Belägg:** `answer()` i `src/live/view.ts` returnerar utan feedback när `click.code` saknas.

### UX-17 Live: miss på land i en sjöfråga ger bara "Fel."
- **Var:** live-avslöjandet, sjöfrågor.
- **Vad:** "Fel. Här ligger Akkajaure." Ensamspelet säger hur många km bort klicket var.
- **Påverkan:** Putsning.
- **Förslag:** visa avståndet även i live.
- **Belägg:** `live-reveal1-guest.png`.

### UX-18 Autozoomen ignorerar reducerad rörelse
- **Var:** avslöjandet och nollställningen, alla lägen.
- **Vad:** `focusOn` (500 ms), `resetZoom` (350 ms) och `zoomBy` (200 ms) körs som d3-övergångar även med `prefers-reduced-motion: reduce`. Bara ringen och pulsen stängs av i CSS. Stora panoreringar kan ge yrsel.
- **Påverkan:** Litet.
- **Förslag:** duration 0 när `matchMedia('(prefers-reduced-motion: reduce)')` matchar.
- **Belägg:** kod i `src/map/map.ts`.

### UX-19 Svenska säger "Klicka" på mobil och engelska "Tap" på dator
- **Var:** lägesbeskrivningar, tips och live-regler.
- **Vad:** båda språken antar fel enhet hälften av tiden.
- **Påverkan:** Putsning.
- **Förslag:** neutralt ord: "Välj rätt län" eller "Peka ut" på svenska, "Pick" eller "Find" på engelska.

### UX-20 Första besöket: reglerna och zoomtipset hamnar sist
- **Var:** startskärmen och första omgången.
- **Vad:**
  - Poängregeln och "Nypa eller scrolla för att zooma" står efter alla lägen och live-kortet, där nästan ingen läser.
  - "Inget resultat ännu" upprepas sju gånger.
  - Inget tips om att zooma visas när man startar Kommuner, som är det enda läget där det är nödvändigt.
- **Påverkan:** Litet.
- **Förslag:**
  - Visa "Bästa" bara när det finns.
  - Visa en engångs-coachmark på kartan första gången i Kommuner ("Nyp för att zooma – eller vänta, vi zoomar till länet", jämför UX-01).
  - Flytta poängregeln in i spelet, t.ex. som "3 p" i toasten, vilket redan görs.
- **Belägg:** `startfull-iphone-light-sv.png`.

### UX-21 Dator: smal kolumn, och kontrollerna i spelet är utspridda
- **Var:** dator, 1440 px.
- **Vad:**
  - Startskärmen är en kolumn på 480 px med lång scroll.
  - I spelet sitter HUD:en i en kolumn på 900 px, medan zoomknapparna sitter längst ned i fönstrets högra hörn, långt från både kartan och HUD:en.
- **Påverkan:** Putsning.
- **Förslag:** lägeskorten i ett rutnät med två kolumner; zoomknapparna närmare kartan.
- **Belägg:** `start-desktop-dark-sv.png`, `m-sjo-desktop-light-sv-q1.png`.

### UX-22 Offline: Kommuner fungerar inte, och felet saknar "Försök igen"
- **Var:** offline, spelskärmen.
- **Vad:**
  - `kommuner.topo.json` ligger inte i service workerns förcache. Den som aldrig spelat Kommuner online får "Kartan kunde inte laddas. Kontrollera uppkopplingen och försök igen."
  - Det finns ingen knapp för att försöka igen, bara ✕.
  - README lovar att spelet går att spela offline.
- **Påverkan:** Litet.
- **Förslag:**
  - Förcacha kommunkartan i bakgrunden efter första besöket, eller skriv "kräver uppkoppling första gången" på kortet.
  - Lägg till en "Försök igen"-knapp i felet.
- **Belägg:** `offline-kommun.png`.

### UX-23 Liggande mobil: HUD:en tar nästan halva höjden
- **Var:** mobil i liggande läge (844×390).
- **Vad:** HUD:en tar cirka 170 av 390 px, så Sverige blir cirka 300 px högt, och kommunerna går i praktiken inte att träffa.
- **Påverkan:** Litet.
- **Förslag:** i liggande läge, frågan i en rad bredvid poängen, och mindre rubrik.
- **Belägg:** `misc-landscape-kommun.png`.

### UX-24 Mörkt läge: sjöar och land har nästan samma ljushet
- **Var:** mörkt läge, mest i Sjöar.
- **Vad:** `--lake` mot `--land` har kvoten 1,08:1 och land mot hav 1,39:1. Bara den blå konturen skiljer sjöarna åt; smala sjöar som Hornavan och Akkajaure blir svåra att se. Kravet för grafiska objekt (WCAG 1.4.11) är 3:1.
- **Påverkan:** Litet.
- **Förslag:** ljusare sjöfyllning i mörkt läge (t.ex. `#2f6db3`) och något ljusare land.
- **Belägg:** `m-sjo-iphone-dark-sv-q1.png`.

### UX-25 Tryckytor under 44 px
- **Var:** startskärmen och lobbyn, mobil.
- **Vad:**

  | Element | Höjd |
  |---|---|
  | Språkknapparna | 36 px |
  | Topplistans flikar och live-chippen | 40 px |
  | "Byt namn" | 28 px |
  | "Logga in" | 27 px |
  | Sidfotslänkarna | 15 px |

  Allt klarar AA-minimum på 24 px (2.5.8), men inte uppdragets krav på 44 px eller Apples riktlinjer.
- **Påverkan:** Litet.
- **Förslag:** `min-height: 44px` på knapparna; padding på länkknapparna.

### UX-26 Topplistans flikar har halv tab-semantik och bryts på tre rader
- **Var:** topplistan, mobil.
- **Vad:** knapparna har `role="tab"` men saknar `tabpanel` och `aria-controls`, och piltangenterna fungerar inte. Åtta flikar bryts på tre rader på 390 px.
- **Påverkan:** Litet.
- **Förslag:** antingen full tab-semantik eller vanliga knappar med `aria-pressed`. Visuellt: en rad som går att scrolla i sidled, eller en `select` på mobil.
- **Belägg:** `startfull-iphone-light-sv.png`.

### UX-27 Passkey-knappen tar över startskärmen
- **Var:** topplistan, för alla med namn.
- **Vad:**
  - "🔒 Skydda namnet med passkey" är en knapp i full bredd plus tre rader förklaring, och står före själva topplistan.
  - "Logga ut" tömmer också det lokala namnet, så man måste skriva det igen.
- **Påverkan:** Putsning.
- **Förslag:**
  - Kortare: "Skydda namnet" som länk, med förklaringen bakom ett "Vad är det?".
  - Visa det tydligare först efter att spelaren kommit in på topplistan.
  - Låt namnet ligga kvar efter utloggning.
- **Belägg:** `local-start-named.png`, `local-loggedout.png`.

### UX-28 Rak klippkant i grannländernas karta
- **Var:** dator och liggande mobil.
- **Vad:** en rak diagonal linje genom Ryssland och Finland, högst upp till höger, från klippningen i `grannar.topo.json`.
- **Påverkan:** Putsning.
- **Förslag:** klipp mot en rektangel utanför den största vyn, eller tona ut kanten.
- **Belägg:** `m-sjo-desktop-light-sv-q1.png`, `misc-landscape-kommun.png`.

### UX-29 "Nytt bästa resultat!" på första omgången
- **Var:** slutskärmen.
- **Vad:** första omgången i ett läge är alltid "nytt bästa", även med 3 poäng.
- **Påverkan:** Putsning.
- **Förslag:** visa det bara när ett tidigare rekord slås; första gången kan i stället stå "Ditt första resultat i Län".
- **Belägg:** `endfull-lan-iphone-light-sv.png`.

### UX-30 Fokus flyttas inte vid skärmbyte, och sidan saknar h1
- **Var:** alla skärmbyten (start → spel → slut, live).
- **Vad:** skärmen byts med `clear(screen)`, och fokus hamnar på `body`. En skärmläsare får ingen signal om att en ny skärm visas. Live- och spelskärmarna saknar `h1` (axe: `page-has-heading-one`).
- **Påverkan:** Litet.
- **Förslag:** flytta fokus till skärmens rubrik (`tabindex="-1"`) vid varje byte, och gör rubriken till `h1`.
- **Belägg:** axe-utdrag för `/live/ABCD`.

---

## Det som fungerar bra

Behåll detta:

- **Feedbacktexterna.** Avstånd i km, "N kommuner bort" och namnet på det man faktiskt klickade på är pedagogiskt starkt och tydligare än hos de flesta kartspel.
- **Toasten flyttar sig** nedåt när svaret ligger i Norrland eller är en sjö.
- **Dubbeltrycksskyddet** (300 ms) och de osynliga träffytorna för Stockholm, Uppsala, Blekinge och Öland.
- **Minikartan med antal** på slutskärmen.
- **Live:**
  - Servern är den som bestämmer.
  - Den som går med mitt i en match hamnar direkt i pågående fråga.
  - Lämnar värden går värdskapet vidare.
  - En felaktig kod ger "Rummet finns inte. Kontrollera koden."
  - "1 av 2 har svarat" ger socialt tryck på rätt sätt.
- **Passkey-flödet är friktionsfritt:** skydda, logga ut och logga in fungerade på ett tryck vardera.
- **Översättningen** är komplett, och `lang` på `html` följer med.
- **axe** hittade inga fel på startskärmen, i något av lägena.
