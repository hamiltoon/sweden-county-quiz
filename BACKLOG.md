# Backlog för Sverigespelet

Prioriterad lista som produktägaren (PO) äger. Utvecklaren tar en punkt i taget, högst två samtidigt.
En punkt är **klar** när den är driftsatt på produktion, UX har verifierat acceptanskriterierna och PO har bockat av den.

Senast uppdaterad: 2026-10-25.

## Så prioriterar vi

- **Vilka som spelar:** främst John och de närmaste, t.ex. Erika, som tävlar mot varandra, oftast i live på mobilen.
  Det som gör live roligare att spela *tillsammans* går därför först.
- **Vad vi går efter:** värde per insats, ungefär som RICE men utan siffror vi inte har.
  Ett fel som stoppar eller förstör en match går alltid före nya funktioner.
- **Fokus:** hellre en sak klar och bra än tre halvfärdiga. Nya kategorier och nya spelsätt väntar
  tills live är riktigt bra, eftersom bredden redan är stor (sju lägen).
- **Insats:** S = högst en halv dag, M = en till två dagar, L = mer än så eller ny kartdata.
- **Prioritet:** P0 = fel som stoppar spelet, åtgärdas direkt. P1 = nu. P2 = nästa. P3 = senare.
  Parkerad = inte nu, med motivering.
- **Produktbeslut tar John:** poängregler, nya kategorier, allt som påverkar topplistan och ändringar som
  syns stort. Sådana punkter är märkta **Beslut: John** och startar inte förrän han har svarat.

## Flöde

| Status | Punkter |
|---|---|
| Pågår (utvecklaren) | PO-01 |
| Väntar på UX-verifiering | – |
| Väntar på beslut av John | PO-06, PO-07, PO-08 |
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

### PO-05 Live: de sista sekunderna känns
- **Prioritet:** P3
- **Insats:** S
- **Koppling:** IDEER.md "Göra live mer levande" 3
- **Värde:** Stress på ett roligt sätt.
- **Acceptanskriterier:**
  1. De sista tre sekunderna pulserar tidsstapeln och byter färg.
  2. På telefoner som kan vibrera (Android) vibrerar den kort en gång per sekund under de tre sista, men bara om man inte har svarat än.
  3. Med "minska rörelse" pulserar inget.

### PO-06 Startskärmen: hitta Spela live direkt
- **Prioritet:** P2, **Beslut: John** (ändringen syns stort)
- **Insats:** S
- **Koppling:** Eget fynd vid genomspelning på mobil (2026-10-25)
- **Värde:** Live är det som spelas mest, men på en iPhone ligger knappen under sju lägeskort och syns först efter
  mycket scrollning.
- **Förslag:** Lägg "Spela live" överst, direkt under rubriken, som ett tydligt eget kort.
- **Acceptanskriterier:**
  1. På en mobil som iPhone 13 syns "Spela live" utan att man behöver scrolla.
  2. Lägeskorten och topplistan fungerar som förut.

### PO-07 Live: skiljetecken vid lika poäng
- **Prioritet:** P2, **Beslut: John** (poängregel)
- **Insats:** S (efter PO-01, som sparar svarstiderna)
- **Koppling:** IDEER.md, under live-listan
- **Värde:** I dag delar spelare med lika poäng platsen. En klar vinnare känns bättre i en match mellan två.
- **Förslag:** Vid lika poäng vinner den som har kortast sammanlagd svarstid på sina rätta svar.
- **Acceptanskriterier:** skrivs när John har bestämt regeln.

### PO-08 Live: svit 🔥 med bonus
- **Prioritet:** P3, **Beslut: John** (poängregel: storleken på bonusen, eller bara visning utan bonus)
- **Insats:** S–M
- **Koppling:** IDEER.md "Göra live mer levande" 7
- **Värde:** Belönar att hålla sig jämn, och ger något att jubla över mitt i matchen.
- **Acceptanskriterier:** skrivs när John har bestämt om sviten ska ge poäng.

### PO-09 Live: konfetti på pallen
- **Prioritet:** P3
- **Insats:** S
- **Koppling:** IDEER.md "Göra live mer levande" 10
- **Acceptanskriterier:**
  1. Vinnaren får konfetti när pallen visas; de andra ser den också.
  2. Ingen konfetti med "minska rörelse".
  3. Inget nytt externt bibliotek som gör spelet märkbart större (riktmärke: under 5 kB).

### PO-10 Utmana en kompis
- **Prioritet:** P3
- **Insats:** M
- **Koppling:** IDEER.md "Socialt"
- **Värde:** Tävla mot varandra även när man inte spelar samtidigt: "Slå mina 52 poäng på län!". Det är den sociala
  loopen som saknas mellan live-kvällarna.
- **Motivering:** Bättre retention per insats än Dagens utmaning för en liten krets spelare: det kräver ingen ny
  topplista och använder befintliga lägen.
- **Acceptanskriterier:** skrivs när vi närmar oss den. Öppen fråga till John: ska utmaningar räknas på topplistan?

### PO-11 Live: ljud som går att stänga av
- **Prioritet:** P3
- **Insats:** M
- **Koppling:** IDEER.md "Göra live mer levande" 8

### PO-12 Live: emoji-reaktioner
- **Prioritet:** P3
- **Insats:** M
- **Koppling:** IDEER.md "Göra live mer levande" 9

### PO-13 Statistik och öva på sina missar
- **Prioritet:** P3
- **Insats:** M
- **Koppling:** IDEER.md "Socialt"

## Parkerat

| Idé | Varför inte nu |
|---|---|
| Dagens utmaning | Kräver en egen topplista och streak-logik (L). Ger mest värde med många spelare; för en liten krets ger Utmana en kompis (PO-10) mer. **Beslut: John** om topplistan. |
| Nya kategorier: berg, öar, nationalparker, sevärdheter | Spelet har redan sju lägen. Vi gör live roligare innan vi gör det bredare. **Beslut: John** vilken kategori som kommer först. |
| Älvar | Kräver ny kartdata (L). |
| Tidspoäng i solospelet | Ändrar poängen och därmed topplistan. **Beslut: John.** |
| Finare poäng i live (500–1000 per fråga) | Poängregel, och ger lite utöver PO-07. **Beslut: John.** |
| Svårighetsnivå "Expert" och omvänt läge | Nya spelsätt; väntar tills live-paketet är klart. |

## UX-fynd

Fynd från UX-specialisten (UX-01, UX-02 …) läggs in här med prioritet och koppling till en PO-punkt.

| UX-id | Fynd | Prioritet | PO-punkt |
|---|---|---|---|
| – | Inga fynd inkomna än | – | – |

## Klart

Inget än.
