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
| Pågår (utvecklaren) | PO-01, PO-06 |
| Nästa | PO-14, PO-15, PO-16 |
| Väntar på UX-verifiering | – |
| Väntar på svar från John | – |
| Klart | – |

## Backlog i prioritetsordning

### PO-01 Live: se allas klick och vem som var snabbast när svaret visas
- **Prioritet:** P1, pågår
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

### PO-06 Startskärmen: hitta Spela live direkt
- **Prioritet:** P1, pågår (liten och oberoende av PO-01, så den går parallellt)
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
- **Prioritet:** P1
- **Insats:** M
- **Koppling:** UX-07
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
  6. Svenska och engelska.

### PO-16 Kommuner: kartan zoomar in på länet
- **Prioritet:** P1
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
- **Koppling:** UX-05
- **Värde:** "En gång till" ska vara ett tryck. I dag ligger knappen under vecket, på Android 360 px två skärmhöjder ner.
- **Acceptanskriterier:**
  1. På iPhone 13 och Android 360 px syns "Spela igen" och "Byt läge" utan att man scrollar, också med namnformulär och topplista.
  2. Poängen och minikartan syns fortfarande först.
  3. Knapparna täcker inget innehåll som inte går att scrolla fram.

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
- **Koppling:** IDEER.md "Göra live mer levande" 1
- **Värde:** Alla hinner läsa frågan och lägga fingret redo, så det blir rättvist och spännande. Det gör också att
  den som läser långsamt eller har en dålig uppkoppling inte förlorar poäng i onödan.
- **Motivering:** Gör poängen efter snabbhet rättvisare och ger rytm i matchen. Kräver ändring i servern, därför efter PO-02.
- **Acceptanskriterier:**
  1. Före varje fråga visas frågan stort i mitten, med en nedräkning 3–2–1 (ungefär tre sekunder).
  2. Det går inte att klicka på kartan under nedräkningen, och de 12 sekunderna och poängen räknas först när den är slut.
  3. Nedräkningen styrs av servern, så att den slutar samtidigt för alla oavsett klockan i telefonen.
  4. En spelare som ansluter igen under nedräkningen hamnar rätt i den.
  5. Svenska och engelska.

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

## Parkerat

| Idé | Varför inte nu |
|---|---|
| Dagens utmaning | Bygger en daglig vana för en bred publik, och spelet är för familj och kompisar som spelar när de ses. Kräver dessutom en egen topplista (L). |
| Nya kategorier: berg, öar, nationalparker, sevärdheter | Spelet har redan sju lägen. Vi gör live roligare innan vi gör det bredare. |
| Älvar | Kräver ny kartdata (L). |
| Tidspoäng i solospelet | Ändrar poängen på den befintliga topplistan, så gamla och nya resultat går inte att jämföra. **Fråga till John** om det blir aktuellt. |
| Finare poäng i live (500–1000 per fråga) | Ger lite utöver PO-07 och gör inte matchen roligare i sig. |
| Svårighetsnivå "Expert" och omvänt läge | Nya spelsätt; väntar tills live-paketet är klart. |

## UX-fynd

Fynd från UX-specialisten (UX-01, UX-02 …) läggs in här med prioritet och koppling till en PO-punkt.

| UX-id | Fynd | Prioritet | PO-punkt |
|---|---|---|---|
| UX-01 | Kommuner: målen för små, zoomen nollställs | P1 | PO-16 |
| UX-02 | Rätt/fel-rutan har för låg kontrast | P1 | PO-14 |
| UX-03 | Rött mot grönt är enda skillnaden | P1 | PO-14 |
| UX-04 | Spela live under vecket | P1 | PO-06 |
| UX-05 | Spela igen under vecket | P2 | PO-17 |
| UX-06 | Skyddat namn avvisas först efter en omgång | P2 | PO-18 |
| UX-07 | Avslöjandet lär ut för lite | P1 | PO-15 |
| UX-08 | Inbjudningssidan förklarar inget | P2 | PO-19 |
| UX-09 | ✕ avslutar utan bekräftelse | P3 | PO-20 |
| UX-10 | Namnbyte lämnar gamla resultat | P3 | PO-21 |
| UX-11–30 | Kommer | – | – |

## Klart

Inget än.
