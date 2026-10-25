# Idéer för Sverigespelet

Saker vi har pratat om men inte byggt än, ungefär i den ordning vi tänkt ta dem.
Klart: Landskap (oktober 2026).

## På gång

- **Live-läge** – tävla mot varandra i realtid:
  - Någon skapar ett rum och får en kod (t.ex. `KXR4`) och en länk att dela; de andra går med.
  - Alla får samma fråga samtidigt med nedräkning (cirka 10 s) och ett klick var.
  - Rätt svar ger poäng, snabbare svar ger fler. Servern avgör vad som är rätt och mäter tiden.
  - Efter varje fråga visas rätt svar, allas klick och ställningen; efter 10–15 frågor en pallplats
    och "Spela igen".
  - Bara rum med kod (ingen matchning med främlingar), egen vinnare per match (räknas inte på
    topplistan). Börjar med Län.
  - Tekniskt: Cloudflare Durable Objects med WebSockets (finns i gratisplanen), ett objekt per rum.

## Fler kategorier

- **Berg och fjäll** – Kebnekaise, Sarektjåkkå, Åreskutan …, som prickar på kartan.
- **Öar** – Gotland, Öland, Orust, Tjörn, Värmdö.
- **Älvar** – Torneälven, Luleälven, Klarälven, Dalälven. Kräver ny kartdata.
- **Nationalparker** eller **sevärdheter** – t.ex. Ales stenar, Göta kanal, Icehotel.

## Nya sätt att spela

- **Dagens utmaning** – samma frågor för alla under dagen, egen topplista och streak.
- **Tidspoäng** – snabbare svar ger mer poäng (poängsystemet i `src/game/config.ts` är förberett).
- **Svårighetsnivå** – t.ex. "Expert" utan länsgränser på kartan.
- **Omvänt läge** – kartan markerar en plats och man väljer rätt namn bland fyra.

## Socialt

- **Utmana en kompis** – en länk med samma 20 frågor, så att resultaten kan jämföras direkt.
- **Statistik** – vilka städer och län man oftast missar, och ett läge för att öva på sina missar.
