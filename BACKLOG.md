# Backlog för Sverigespelet

Prioriterad lista som produktägaren (PO) äger. Utvecklaren tar en punkt i taget, högst två samtidigt.
En punkt är **klar** när den är driftsatt på produktion, UX har verifierat acceptanskriterierna och PO har bockat av den.

Senast uppdaterad: 2026-10-25.

## Riktning

John, 2026-10-25:
- **Vilka:** familj och kompisar det närmaste året, ingen bredare publik.
- **Kärna:** att lära sig geografi. Tävlingen är det som gör att man spelar, lärandet är målet.
- **Rytm:** vid tillfällen, när man ses. Ingen daglig vana att bygga.
- **Efter live-paketet:** Utmana en kompis.

Det betyder att live-kvällarna går först, att varje avslöjande ska lära ut något (var låg det rätta svaret, var
klickade de andra) och att funktioner för daglig vana och bred publik väntar.

## Arbetssätt

Beslutat med John 2026-10-25. Det är kontrollen av resultatet som begränsar oss, inte hur fort koden skrivs. Därför:

1. **Körbara acceptanskriterier.** Där det går skrivs kriterierna så att de kan testas automatiskt, och testerna körs före varje driftsättning (PO-29).
2. **Staging före produktion.** Varje ändring går först till en staging-miljö där UX verifierar. Produktion, där familjen spelar, får bara godkända ändringar.
3. **Flera förslag när lösningen är osäker.** Två eller tre agenter bygger varsin variant på staging, och UX testar och rekommenderar; PO väljer. John testar inte. Först ut: PO-15 och PO-16.
4. **Agenter per uppgift, inte per område.** När 1 och 2 finns kan en kortlivad agent ta en uppgift i egen gren. Den nuvarande utvecklaren sätter ihop och driftsätter.

## Så prioriterar vi

- **Vilka som spelar:** främst John och de närmaste, t.ex. Erika, som tävlar mot varandra, oftast i live på mobilen.
  Det som gör live roligare att spela *tillsammans* går därför först.
- **Vad vi går efter:** värde per insats, ungefär som RICE men utan siffror vi inte har.
  Ett fel som stoppar eller förstör en match går alltid före nya funktioner.
- **Fokus:** hellre en sak klar och bra än tre halvfärdiga. Nya kategorier och nya spelsätt väntar
  tills live är riktigt bra, eftersom bredden redan är stor (sju lägen).
- **Lärande och tillgänglighet före glans:** det som gör att alla ser rätt och fel och lär sig av sina missar
  (PO-14–PO-16) går före live-paketets finlir (PO-02–PO-04), eftersom kärnan är att lära sig geografi.
- **Insats:** S = högst en halv dag, M = en till två dagar, L = mer än så eller ny kartdata.
- **Prioritet:** P0 = fel som stoppar spelet, åtgärdas direkt. P1 = nu. P2 = nästa. P3 = senare.
  Parkerad = inte nu, med motivering.
- **Beslut:** PO prioriterar och tar produktbesluten (John, 2026-10-25). Till John går frågor om vart produkten
  ska, och ändringar som påverkar den befintliga topplistan. Sådana punkter är märkta **Fråga till John**.

## Flöde

| Status | Punkter |
|---|---|
| Pågår (utvecklaren) | PO-29 |
| Nästa | PO-14 (byggd, väntar på staging), PO-30, och PO-15 och PO-16 med flera förslag parallellt |
| Väntar på UX-verifiering | – |
| Väntar på svar från John | – |
| Klart | PO-01, PO-01b, PO-06, PO-22 |

## Backlog i prioritetsordning

### PO-01 Live: se allas klick och vem som var snabbast när svaret visas
- **Status:** ✅ Klar 2026-10-25 ([#22](https://github.com/hamiltoon/sweden-county-quiz/pull/22), rättad i [#25](https://github.com/hamiltoon/sweden-county-quiz/pull/25) och [#27](https://github.com/hamiltoon/sweden-county-quiz/pull/27)). UX har godkänt alla kriterier, kriterium 8, 12 och 13 efter PO-01b.
- **Insats:** M (servern sparar klick och svarstid för alla svar; kartan ritar prickar med namn)
- **Koppling:** IDEER.md "Göra live mer levande" 4 och 5
- **Värde:** Det är i avslöjandet som snacket uppstår: "Du klickade ju i Norge!" I dag ser man bara sitt eget
  klick, så de andras miss och snabbhet syns inte. Det gör varje fråga till en liten händelse mellan spelarna.
- **Motivering:** Störst glädje per insats i live-paketet, och servern har redan nästan all data. Svarstiden
  behövs också för PO-04 och för skiljetecken (PO-07), så den här punkten lägger grunden för dem.
- **Acceptanskriterier:**
  1. När svaret visas står varje spelares klick som en prick på kartan, med spelarens namn intill. Det gäller i alla
     lägen: län, landskap, kommuner, residensstäder, fler städer, sjöar och blandat.
  2. Ens egen prick syns tydligt annorlunda än de andras, t.ex. med en kraftigare kant.
  3. Rätt klick och fel klick har olika färg, och det går att se utan att kunna skilja rött från grönt
     (t.ex. ✓ och ✗ eller olika form).
  4. Den som inte svarade får ingen prick, och inget går sönder om ingen svarade.
  5. Den snabbaste med rätt svar lyfts fram, t.ex. "⚡ Erika 1,4 s". Har ingen svarat rätt visas ingen snabbast.
  6. Den egna svarstiden står i den egna raden i ställningen, med en decimal (t.ex. "2,3 s").
  7. Svarstiden mäts på servern, från att frågan startade till att servern tog emot svaret.
  8. Med 12 spelare är namnen på kartan fortfarande läsbara på en mobil som iPhone 13: de får inte täcka
     rätt svar, och överlappande namn får kortas eller döljas så länge pricken syns.
  9. Allt finns på svenska och engelska.
  10. Det fungerar lika bra för en spelare som ansluter igen mitt i avslöjandet.
  11. `npm run typecheck` går igenom och en hel match med två spelare är spelad på produktion efter driftsättning.
  12. Kartan visar både rätt svar och allas prickar i samma vy. Om ett klick ligger mycket långt bort visas hellre
      hela Sverige än att pricken hamnar utanför bilden. (Tillagt 2026-10-25 efter UX-underlag.)
  13. Avslöjandet visas i 5 sekunder med upp till tre spelare och i 7 sekunder med fyra eller fler, så att man hinner
      läsa prickar och ställning. (Tillagt 2026-10-25.)

### PO-01b Live: avslöjandet håller med många spelare
- **Status:** ✅ Klar 2026-10-25 ([#25](https://github.com/hamiltoon/sweden-county-quiz/pull/25), [#27](https://github.com/hamiltoon/sweden-county-quiz/pull/27)). UX har godkänt alla fem kriterierna med 12 spelare på iPhone och Android 360.
- **Insats:** S–M
- **Koppling:** PO-01 kriterium 8, 12 och 13; UX-07
- **Beslut (PO):** med fler än 5 spelare visar ställningen under avslöjandet topp 3, den egna raden och "… och N till".
  Hela listan visas på pallen.
- **Acceptanskriterier:**
  1. Vyn räknas ut efter att ställningen och snabbast-raden har ritats, så att kartan inte flyttar sig efteråt. Från
     första bildrutan syns rätt svar och allas prickar; ligger ett klick mycket långt bort visas hela Sverige.
  2. Ställningen följer regeln ovan och tar högst ungefär en tredjedel av skärmhöjden på iPhone 13 och Android 360 med 12 spelare.
  3. Den egna raden syns alltid helt.
  4. Avslöjandet varar 5 s med upp till 3 spelare och 7 s med 4 eller fler.
  5. Testat med 12 spelare i län, residensstad, sjöar och kommuner, på båda skärmstorlekarna.

### PO-29 Staging och automatiska acceptanstester
- **Prioritet:** P1, direkt efter PO-01b
- **Insats:** M–L
- **Koppling:** Beslut om arbetssätt med John 2026-10-25; felet i PO-01 kriterium 8 nådde produktion
- **Värde för spelarna:** Det som når John och Erika är redan kontrollerat, så att en kväll i live inte förstörs av ett fel.
  Det gör det också säkert att arbeta parallellt, så att resten av backloggen kommer fortare.
- **Motivering:** En investering som gör varje följande leverans billigare och säkrare. UX har redan Playwright-skript
  från granskningen som kan vara grunden.
- **Acceptanskriterier:**
  1. Det finns en staging-miljö med egen adress, t.ex. `sverigespelet-staging.hamiltoon.workers.dev`, och egen D1-databas
     och egna live-rum. Ingenting delas med produktionens topplista eller konton.
     (Cloudflares förhandsadresser per version fungerar troligen inte för Workers med Durable Objects, därför en egen miljö.)
  2. Ett kommando, t.ex. `npm run deploy:staging`, driftsätter dit. README beskriver flödet: staging, UX-verifiering och sedan produktion.
  3. `npm run test:e2e` kör Playwright mot en valfri adress (standard: staging) och täcker minst:
     - startskärmen på 390×844 och 360×740: "Spela live" syns utan scroll;
     - en omgång i varje läge spelad till slutskärmen utan fel i konsolen;
     - en live-match med 2 och med 12 botspelare: varje avslöjande visar rätt svar och allas prickar inom kartans vy,
       och den egna raden i ställningen syns helt.
  4. Testerna sparar skärmbilder från varje steg, så att UX kan granska dem utan att köra själv.
  5. Testerna vägrar skriva till topplistan eller skapa passkeys mot produktionens adress. Det är kontrollerat med ett eget test.
  6. Hela sviten tar under 5 minuter och går igenom på main.
  7. Från och med nu driftsätter utvecklaren till staging först. Produktion kommer efter att testerna gått igenom och UX har godkänt.
  8. Staging visar alltid en tydlig banderoll överst, "STAGING – testmiljö, inte den riktiga topplistan" (sv/en), och sidans titel
     börjar med "[Staging]". Produktion visar ingen banderoll. (Tillagt 2026-10-25: John förväxlade staging med produktion.)

### PO-06 Startskärmen: hitta Spela live direkt
- **Status:** ✅ Klar 2026-10-25 ([#23](https://github.com/hamiltoon/sweden-county-quiz/pull/23)). UX har godkänt alla fem kriterierna på produktion.
- **Beslut (PO):** live-kortet flyttas upp direkt under rubriken.
- **Insats:** S
- **Koppling:** UX-04; eget fynd vid genomspelning på mobil (2026-10-25)
- **Värde:** Live är det som spelas mest, men på en iPhone ligger knappen under sju lägeskort och syns först efter
  mycket scrollning.
- **Acceptanskriterier:**
  1. På en mobil som iPhone 13 (390 × 844) och på en liten Android (360 × 740) syns hela "Spela live"-kortet utan att man scrollar.
  2. Kortet ser ut som en huvudhandling och skiljer sig från lägeskorten, men tar inte mer än ungefär en fjärdedel av skärmhöjden på mobil.
  3. På dator ligger det också före lägeskorten.
  4. Lägeskorten, deras bästa resultat och topplistan fungerar som förut.
  5. Svenska och engelska; tangentbordsordningen följer den nya ordningen.

### PO-14 Rätt och fel syns för alla
- **Prioritet:** P1, nästa när PO-06 är klar
- **Insats:** S–M
- **Koppling:** UX-02, UX-03
- **Värde:** Rätt/fel-rutan är spelets viktigaste återkoppling, men vit text på grönt har kontrasten 3,45:1 (2,31:1 i
  mörkt läge). Rätt och missat skiljer sig bara i kulör, så den som är rödgrön färgblind (ungefär var tolfte man)
  ser inte skillnad på kartan eller minikartan.
- **Motivering:** Rör allt spel, i alla lägen och i live. Lite arbete, mest färger och en ikon.
- **Acceptanskriterier:**
  1. All text i rätt/fel-rutan har kontrast minst 4,5:1 mot bakgrunden, i både ljust och mörkt läge.
  2. Rutan har en ikon (✓ eller ✗) så att den går att läsa utan färg.
  3. På kartan under omgången och på minikartan går rätt direkt, rätt efter flera försök och missat att skilja åt med
     simulerad deuteranopi och protanopi, t.ex. med en annan palett, ett mönster eller en kontur på missade.
  4. Förklaringen under minikartan stämmer med de nya färgerna.
  5. Live använder samma färger och ikoner.
  6. axe-core hittar inga kontrastfel på spelskärmen eller slutskärmen.

### PO-15 Avslöjandet lär ut var rätt svar ligger
- **Prioritet:** P1, efter PO-29. Byggs som två till tre varianter på staging som UX testar och PO väljer mellan.
- **Insats:** M
- **Koppling:** UX-07, UX-18
- **Värde:** Kärnan är att lära sig geografi. Efter en miss visas rätt svar i 2,4 sekunder, och det egna felklicket
  hamnar ofta utanför bilden. Man hinner inte se var man hade fel eller var det rätta låg.
- **Motivering:** Gör varje miss till något man lär sig av.
- **Acceptanskriterier:**
  1. Efter en miss i solospelet visar kartan både det egna (sista) felklicket och rätt svar i samma vy.
  2. Rätt svar har sitt namn utskrivet på kartan.
  3. Efter en miss går spelet vidare först när man trycker (t.ex. "Nästa" eller ett tryck på kartan), eller efter
     minst 4 sekunder om man inte rör något. Rätt svar på första försöket går vidare lika snabbt som i dag.
  4. Det fungerar i alla lägen, också städerna och sjöarna.
  5. Live påverkas inte (där styr servern tiden; PO-01 visar klicken).
  6. Med "minska rörelse" (`prefers-reduced-motion`) hoppar kartan direkt till vyn utan zoomanimation (UX-18).
  7. Svenska och engelska.

### PO-16 Kommuner: kartan zoomar in på länet
- **Prioritet:** P1, efter PO-29. Byggs som två till tre varianter på staging som UX testar och PO väljer mellan.
- **Insats:** M
- **Koppling:** UX-01
- **Värde:** 274 av 290 kommuner är mindre än ett finger på en iPhone, och zoomen nollställs vid varje fråga, så man
  nyper in i Stockholm 20 gånger. I live, med 12 sekunder och ett klick, blir det nästan omöjligt.
- **Motivering:** Frågan säger redan vilket län kommunen ligger i, så spelet kan zooma åt spelaren. Kommuner är det
  bästa läget för lärande, men just nu straffar det ovana fingrar mer än okunskap.
- **Acceptanskriterier:**
  1. När en kommunfråga visas zoomar kartan mjukt in så att hela länet som frågan nämner fyller kartan.
  2. Man kan fortfarande zooma ut och in själv.
  3. De minsta kommunerna (t.ex. Sundbyberg, Solna, Öckerö) går att träffa på en iPhone 13 och en Android 360 px,
     antingen genom högre maxzoom eller genom större osynliga träffytor.
  4. I live gäller samma inzoomning, och kommunkartan laddas redan i lobbyn när läget innehåller kommuner, så att
     ingen förlorar tid på laddning.
  5. Övriga lägen påverkas inte.

### PO-17 Slutskärmen: Spela igen utan att scrolla
- **Prioritet:** P2
- **Insats:** S
- **Koppling:** UX-05, UX-29
- **Värde:** "En gång till" ska vara ett tryck. I dag ligger knappen under vecket, på Android 360 px två skärmhöjder ner.
- **Acceptanskriterier:**
  1. På iPhone 13 och Android 360 px syns "Spela igen" och "Byt läge" utan att man scrollar, också med namnformulär och topplista.
  2. Poängen och minikartan syns fortfarande först.
  3. Knapparna täcker inget innehåll som inte går att scrolla fram.
  4. "Nytt bästa resultat!" visas inte på den allra första omgången i ett läge (UX-29).

### PO-18 Namn: säg direkt om namnet är skyddat
- **Prioritet:** P2
- **Insats:** S–M
- **Koppling:** UX-06
- **Värde:** I dag godtas ett skyddat namn när man skriver det, och först efter en hel omgång kommer beskedet att
  resultatet inte sparas, med en text som inte stämmer. Ett oskyddat namn som redan finns slås tyst ihop med någon annans resultat.
- **Motivering:** Ett fel som tar bort resultat utan att säga det, och som drabbar just familjen när någon prövar en annans namn.
- **Acceptanskriterier:**
  1. När man väljer ett namn som är skyddat av någon annan säger spelet det direkt: "Namnet är skyddat – logga in eller välj ett annat". Namnet sparas inte.
  2. När man väljer ett oskyddat namn som redan finns på topplistan får man en varning: "Det finns redan en spelare som heter X. Är det du?" och kan välja ett annat.
  3. Texten om resultat som inte kunde sparas stämmer med vad som faktiskt händer.
  4. Inga befintliga resultat eller namn på topplistan ändras.
  5. Svenska och engelska.

### PO-19 Live: inbjudningssidan förklarar vad man går med i
- **Prioritet:** P2
- **Insats:** S
- **Koppling:** UX-08
- **Värde:** För den i familjen som skannar QR-koden är det här första mötet med spelet, och sidan säger inte vad det är.
- **Acceptanskriterier:**
  1. Sidan visar spelets namn och logga, en mening om spelet, rummets läge och vilka som redan är i rummet.
  2. Det går att byta språk på sidan.
  3. Namnfältet är lika brett som knappen, och etiketten "Namn" hör ihop med fältet (skärmläsare och tryck på etiketten).

### PO-22 Live: värden når Starta matchen utan att scrolla
- **Status:** ✅ Klar 2026-10-25 ([#26](https://github.com/hamiltoon/sweden-county-quiz/pull/26)). UX har godkänt kriterierna på produktion.
- **Insats:** S
- **Koppling:** UX-13, UX-14
- **Värde:** Värden trycker på Starta före varje match, men knappen ligger under QR-koden. Lobbyn tappar dessutom
  fokus när värden byter läge.
- **Acceptanskriterier:**
  1. På iPhone 13 och Android 360 px når värden "Starta matchen" utan att scrolla, t.ex. med en knapp som ligger kvar nederst.
  2. QR-koden och koden syns fortfarande för den som ska gå med.
  3. Efter att värden valt läge eller blandning ligger fokus kvar på det valda chipet.

### PO-23 Live: samma hjälp vid miss som i solospelet
- **Prioritet:** P2
- **Insats:** S
- **Koppling:** UX-16, UX-17
- **Värde:** I solospelet lär man sig av "250 km bort" och av tipset när man klickar i havet. I live får man bara "Fel." eller ingenting.
- **Acceptanskriterier:**
  1. En miss på land i en sjöfråga i live visar hur långt bort klicket var, som i solospelet.
  2. Ett klick i havet på en område-fråga i live ger samma tips som i solospelet och räknas inte som svar.
  3. Svenska och engelska.

### PO-28 Residensstad: prick i stället för ifyllt län
- **Prioritet:** P2
- **Insats:** S
- **Koppling:** UX-12; **beslut av John 2026-10-25:** prick, utan att nollställa topplistan
- **Värde:** När hela länet färgas efter varje svar kan de sista städerna räknas ut genom uteslutning. Med en prick
  lär man sig var staden ligger, och topplistan blir rättvisare.
- **Acceptanskriterier:**
  1. I Residensstad markeras varje besvarad stad med en prick i resultatfärgen, som i Fler städer; länen fylls inte.
  2. Minikartan på slutskärmen visar också prickar.
  3. Blandat följer samma regel för residensstadsfrågor.
  4. Topplistan och tidigare resultat lämnas orörda.

### PO-30 Live: målets namn syns ovanpå prickarna
- **Prioritet:** P2
- **Insats:** S
- **Koppling:** UX-verifieringen av PO-01b (putsning)
- **Värde:** När alla klickat nära rätt svar täcker prickarna målets namn ("Umeå", "Uddjaure"). Namnet är det man ska lära sig.
- **Acceptanskriterier:**
  1. Målets namn ritas ovanpå prickarna och deras namn, eller på den sida av målet där det finns minst prickar.
  2. Med 12 prickar inom 30 km från målet går målets namn att läsa helt på iPhone 13 och Android 360.

### PO-02 Live: se vilka som har svarat medan frågan pågår
- **Prioritet:** P2
- **Insats:** S (servern skickar redan `answered` per spelare)
- **Koppling:** IDEER.md "Göra live mer levande" 2
- **Värde:** Pressen när man ser "Erika ✓" medan man själv letar på kartan. I dag står bara "1 av 2 har svarat".
- **Motivering:** Billigast i hela live-paketet och ger känslan av att spela samtidigt.
- **Acceptanskriterier:**
  1. Under frågan visas allas namn i en rad; ett namn får ✓ i samma stund som spelaren har svarat.
  2. Raden avslöjar inte om svaret var rätt.
  3. Med 12 spelare får raden plats på en mobil som iPhone 13 utan att täcka kartan mer än i dag (den får rulla i sidled eller korta namnen).
  4. En spelare som har tappat anslutningen syns som borta.
  5. Svenska och engelska.

### PO-03 Live: nedräkning 3–2–1 före varje fråga
- **Prioritet:** P2
- **Insats:** M (servern behöver en kort fas före frågan så att klockan startar lika för alla)
- **Koppling:** IDEER.md "Göra live mer levande" 1, UX-15
- **Värde:** Alla hinner läsa frågan och lägga fingret redo, så det blir rättvist och spännande. Det gör också att
  den som läser långsamt eller har en dålig uppkoppling inte förlorar poäng i onödan.
- **Motivering:** Gör poängen efter snabbhet rättvisare och ger rytm i matchen. Kräver ändring i servern, därför efter PO-02.
- **Acceptanskriterier:**
  1. Före varje fråga visas frågan stort i mitten, med en nedräkning 3–2–1 (ungefär tre sekunder).
  2. Det går inte att klicka på kartan under nedräkningen, och de 12 sekunderna och poängen räknas först när den är slut.
  3. Nedräkningen styrs av servern, så att den slutar samtidigt för alla oavsett klockan i telefonen.
  4. En spelare som ansluter igen under nedräkningen hamnar rätt i den.
  5. Under frågan visas sekunderna som är kvar som siffror bredvid stapeln (UX-15).
  6. Stapeln under avslöjandet förklarar sig, t.ex. "Nästa fråga om 4 s".
  7. Svenska och engelska.

### PO-04 Live: ställningen rör sig och berättar vem som gick om vem
- **Prioritet:** P2
- **Insats:** S–M (bara i spelet)
- **Koppling:** IDEER.md "Göra live mer levande" 6
- **Värde:** Det blir tydligt vad som hände i matchen: "Erika går om John!".
- **Motivering:** Ger dramatik utan att ändra några regler.
- **Acceptanskriterier:**
  1. När ställningen visas glider raderna från sina gamla platser till sina nya.
  2. När någon går upp på en högre placering visas en kort rad, t.ex. "Erika går om John!". Vid flera byten visas det viktigaste (om ledningen byttes).
  3. Med inställningen "minska rörelse" i telefonen (`prefers-reduced-motion`) hoppar raderna direkt till sina platser.
  4. Svenska och engelska.

### PO-10 Utmana en kompis
- **Prioritet:** P2, först efter live-paketet (PO-02–PO-04)
- **Insats:** M
- **Koppling:** IDEER.md "Socialt"; Johns riktning 2026-10-25
- **Värde:** Tävla och lära sig även när man inte ses: "Slå mina 52 poäng på län!". Efteråt ser båda var den andra
  hade fel, så man lär sig av varandras missar.
- **Motivering:** John valde den som nästa steg. Den kräver ingen ny topplista och använder befintliga lägen.
- **Acceptanskriterier (utkast, skärps innan start):**
  1. Efter en avslutad omgång i solospelet kan man dela en länk "Utmana en kompis" (dela-menyn på mobil, annars kopiera).
  2. Den som öppnar länken spelar samma läge med exakt samma frågor i samma ordning, och ser vem som utmanar och vilket resultat som gäller.
  3. Efter omgången visas båda resultaten sida vid sida, fråga för fråga, med var och en av dem hade fel.
  4. Utmanaren kan se mottagarens resultat via samma länk efteråt.
  5. Kräver inget konto. Utmaningar räknas inte på topplistan, så den påverkas inte.
  6. Svenska och engelska.

### PO-13 Öva på sina missar
- **Prioritet:** P2, efter PO-10
- **Insats:** M
- **Koppling:** IDEER.md "Socialt" (statistik); Johns riktning 2026-10-25
- **Värde:** Spelet ska framför allt lära ut geografi. Att få öva just på de län, städer och kommuner man missar
  är det som gör en bättre över tid.
- **Motivering:** Ligger närmast kärnan "lära sig", och kräver ingen server (resultaten kan sparas i telefonen).
- **Acceptanskriterier (utkast, skärps innan start):**
  1. Spelet minns per läge vilka frågor man har missat eller behövt flera försök på, på enheten.
  2. På startskärmen finns "Öva på dina missar" för de lägen där man har missar, med antalet.
  3. Övningsomgången ställer bara de frågorna, och en fråga som besvaras rätt direkt två gånger i rad försvinner ur listan.
  4. Övningsomgångar sparas inte på topplistan och ändrar inte bästa resultat.
  5. Svenska och engelska.

### PO-07 Live: skiljetecken vid lika poäng
- **Prioritet:** P2 (efter PO-13; billig när PO-01 sparar svarstiderna)
- **Insats:** S
- **Koppling:** IDEER.md, under live-listan
- **Värde:** I dag delar spelare med lika poäng platsen. En klar vinnare känns bättre i en match mellan två.
- **Beslut (PO):** vid lika poäng vinner den som har kortast sammanlagd svarstid på sina rätta svar.
- **Acceptanskriterier:**
  1. Ställningen efter varje fråga och pallen sorteras på poäng och sedan på sammanlagd svarstid för rätta svar.
  2. Den som vinner på tid visar det, t.ex. "Avgjort på tid: 14,2 s mot 17,9 s".
  3. Har båda exakt samma tid, eller inga rätta svar, delar de platsen som i dag.
  4. Sorteringen görs på servern.
  5. Svenska och engelska; regeln står kort i lobbyns regeltext.

### PO-05 Live: de sista sekunderna känns
- **Prioritet:** P3
- **Insats:** S
- **Koppling:** IDEER.md "Göra live mer levande" 3
- **Värde:** Stress på ett roligt sätt.
- **Acceptanskriterier:**
  1. De sista tre sekunderna pulserar tidsstapeln och byter färg.
  2. På telefoner som kan vibrera (Android) vibrerar den kort en gång per sekund under de tre sista, men bara om man inte har svarat än.
  3. Med "minska rörelse" pulserar inget.

### PO-08 Live: svit 🔥 (utan bonus)
- **Prioritet:** P3
- **Insats:** S
- **Beslut (PO):** sviten visas men ger ingen bonus. Poängen är redan efter snabbhet; en bonus gör att den som
  leder drar ifrån ännu mer, vilket gör matcher mellan två avgjorda för tidigt.
- **Koppling:** IDEER.md "Göra live mer levande" 7
- **Värde:** Belönar att hålla sig jämn, och ger något att jubla över mitt i matchen.
- **Acceptanskriterier:**
  1. Efter tre rätt i rad visas "🔥 3 i rad" vid spelarens namn i ställningen; siffran växer så länge sviten håller.
  2. Ett fel eller ett uteblivet svar bryter sviten.
  3. Poängen ändras inte.

### PO-09 Live: konfetti på pallen
- **Prioritet:** P3
- **Insats:** S
- **Koppling:** IDEER.md "Göra live mer levande" 10
- **Acceptanskriterier:**
  1. Vinnaren får konfetti när pallen visas; de andra ser den också.
  2. Ingen konfetti med "minska rörelse".
  3. Inget nytt externt bibliotek som gör spelet märkbart större (riktmärke: under 5 kB).

### PO-11 Live: ljud som går att stänga av
- **Prioritet:** P3
- **Insats:** M
- **Koppling:** IDEER.md "Göra live mer levande" 8

### PO-12 Live: emoji-reaktioner
- **Prioritet:** P3
- **Insats:** M
- **Koppling:** IDEER.md "Göra live mer levande" 9

### PO-20 Bekräfta innan man avslutar en omgång
- **Prioritet:** P3
- **Insats:** S
- **Koppling:** UX-09
- **Acceptanskriterier:**
  1. Ett tryck på ✕ efter minst tre besvarade frågor frågar först: "Avsluta? Resultatet sparas inte."
  2. I live: "Lämna matchen?".
  3. Före tre besvarade frågor avslutar ✕ direkt som i dag.

### PO-21 Byt namn: säg vad som händer med de gamla resultaten
- **Prioritet:** P3
- **Insats:** S
- **Koppling:** UX-10
- **Acceptanskriterier:**
  1. Formuläret för namnbyte säger att de gamla resultaten ligger kvar under det gamla namnet.
  2. Att flytta resultaten till det nya namnet ändrar topplistan och är en **fråga till John**; den byggs inte nu.

### PO-24 Första besöket: rätt texter på rätt plats
- **Prioritet:** P3
- **Insats:** S
- **Koppling:** UX-19, UX-20
- **Acceptanskriterier:**
  1. Poängregeln och zoomtipset står före lägeskorten, eller i lägets kort.
  2. "Inget resultat ännu" upprepas inte sju gånger; kort utan resultat visar inget eller något kortare.
  3. Kommuner har ett zoomtips.
  4. Uppmaningen är neutral, t.ex. "Välj"/"Pick" i stället för "Klicka" på mobil och "Tap" på dator.

### PO-25 Tillgänglighet: tryckytor, flikar, rubriker och mörkt läge
- **Prioritet:** P3
- **Insats:** M
- **Koppling:** UX-24, UX-25, UX-26, UX-30
- **Acceptanskriterier:**
  1. Språkknappar, flikar, chip, "Byt namn" och "Logga in" har tryckytor på minst 44 × 44 px.
  2. Topplistans flikar följer flik-mönstret (tabpanel, piltangenter) och ryms på högst två rader på mobil.
  3. Varje skärm har en h1 och fokus flyttas till skärmens rubrik vid skärmbyte.
  4. I mörkt läge skiljer sig sjöar från land och land från hav med kontrast minst 3:1.

### PO-26 Startskärmen: passkey tar mindre plats
- **Prioritet:** P3
- **Insats:** S
- **Koppling:** UX-27
- **Acceptanskriterier:**
  1. Passkey-knappen är en sekundär handling och tar inte över startskärmen.
  2. "Logga ut" tömmer inte det lokala namnet, eller säger tydligt att det gör det.

### PO-27 Offline: Kommuner fungerar utan nät
- **Prioritet:** P3
- **Insats:** S
- **Koppling:** UX-22
- **Acceptanskriterier:**
  1. Kommunkartan förcachas av service workern, så att Kommuner fungerar offline även om läget aldrig spelats online.
  2. Om kartan ändå inte går att ladda finns knappen "Försök igen".

## Parkerat

| Idé | Varför inte nu |
|---|---|
| Dagens utmaning | Bygger en daglig vana för en bred publik, och spelet är för familj och kompisar som spelar när de ses. Kräver dessutom en egen topplista (L). |
| Nya kategorier: berg, öar, nationalparker, sevärdheter | Spelet har redan sju lägen. Vi gör live roligare innan vi gör det bredare. |
| Älvar | Kräver ny kartdata (L). |
| Tidspoäng i solospelet | Ändrar poängen på den befintliga topplistan, så gamla och nya resultat går inte att jämföra. **Fråga till John** om det blir aktuellt. |
| Finare poäng i live (500–1000 per fråga) | Ger lite utöver PO-07 och gör inte matchen roligare i sig. |
| Svårighetsnivå "Expert" och omvänt läge | Nya spelsätt; väntar tills live-paketet är klart. Omvänt läge (flerval) skulle också ge ett sätt att spela utan att peka på kartan (UX-11). |
| Spela kartan med tangentbord och skärmläsare (UX-11) | Stort arbete (L) för ingen i dagens spelarkrets. Tas upp om spelet ska nå fler, troligast via omvänt läge. |
| Bredare layout på dator (UX-21), liggande mobil (UX-23), klippkant i grannkartan (UX-28) | Spelet spelas på mobil i stående läge; liten nytta för spelarna i dag. |

## UX-fynd

Fynd från UX-specialisten (UX-01, UX-02 …) läggs in här med prioritet och koppling till en PO-punkt.

| UX-id | Fynd | Prioritet | PO-punkt |
|---|---|---|---|
| UX-01 | Kommuner: målen för små, zoomen nollställs | P1 | PO-16 |
| UX-02 | Rätt/fel-rutan har för låg kontrast | P1 | PO-14 |
| UX-03 | Rött mot grönt är enda skillnaden | P1 | PO-14 |
| UX-04 | Spela live under vecket | ✅ Klar | PO-06 |
| UX-05 | Spela igen under vecket | P2 | PO-17 |
| UX-06 | Skyddat namn avvisas först efter en omgång | P2 | PO-18 |
| UX-07 | Avslöjandet lär ut för lite | P1 | PO-15 |
| UX-08 | Inbjudningssidan förklarar inget | P2 | PO-19 |
| UX-09 | ✕ avslutar utan bekräftelse | P3 | PO-20 |
| UX-10 | Namnbyte lämnar gamla resultat | P3 | PO-21 |
| UX-11 | Kartan går inte att spela med tangentbord/skärmläsare | Parkerad | – |
| UX-12 | Residensstad: ifyllt län avslöjar de sista svaren | P2 | PO-28 |
| UX-13 | Lobbyn tappar fokus | ✅ Klar | PO-22 |
| UX-14 | Starta matchen under vecket | ✅ Klar | PO-22 |
| UX-15 | Live-timern saknar siffror och 3–2–1 | P2 | PO-03 |
| UX-16 | Live: klick i havet ignoreras tyst | P2 | PO-23 |
| UX-17 | Live: sjömiss ger bara "Fel." | P2 | PO-23 |
| UX-18 | Avslöjandets zoom ignorerar minska rörelse | P1 | PO-15 |
| UX-19 | "Klicka"/"Tap" på fel enhet | P3 | PO-24 |
| UX-20 | Första besöket: texter i fel ordning | P3 | PO-24 |
| UX-21 | Smal kolumn på dator | Parkerad | – |
| UX-22 | Kommunkartan inte förcachad offline | P3 | PO-27 |
| UX-23 | Liggande mobil: HUD tar för mycket | Parkerad | – |
| UX-24 | Mörkt läge: sjöar och land för lika | P3 | PO-25 |
| UX-25 | Tryckytor under 44 px | P3 | PO-25 |
| UX-26 | Topplistans flikar | P3 | PO-25 |
| UX-27 | Passkey-knappen tar över startskärmen | P3 | PO-26 |
| UX-28 | Klippkant i grannkartan | Parkerad | – |
| UX-29 | "Nytt bästa resultat!" på första omgången | P2 | PO-17 |
| UX-30 | Fokus vid skärmbyte, h1 saknas | P3 | PO-25 |

## Klart

- **PO-01 och PO-01b** Live: allas klick, snabbast och ett avslöjande som håller med 12 spelare. Driftsatt i #22, #25 och #27, godkänd av UX 2026-10-25.
- **PO-22** Live: Starta matchen nåbar i lobbyn (UX-13, UX-14). Driftsatt i [#26](https://github.com/hamiltoon/sweden-county-quiz/pull/26), godkänd av UX 2026-10-25.
- **PO-06** Startskärmen: Spela live först (UX-04). Driftsatt i [#23](https://github.com/hamiltoon/sweden-county-quiz/pull/23), godkänd av UX 2026-10-25.
