/**
 * Minnesregler (PO-33): knep för att komma ihåg var saker ligger. Första versionen kommer från
 * docs/minnesregler-forslag.json (faktagranskad av PO och granskad av UX). Nya regler och ändringar
 * kommer via PR som PO godkänner.
 *
 * `targets` säger vilka frågor regeln hör till: länskoder för län (`lan`) och residensstäder
 * (`stad`), landskapens och sjöarnas id och kommunkoder. `short` (högst 110 tecken) visas i
 * avslöjandet efter en miss; `text` och `why` på slutskärmen och /minnesregler. Regler utan text i
 * `en` visas inte på engelska (de flesta är ordlekar på svenska).
 */
export type MnemonicCategory = 'princip' | 'lan' | 'landskap' | 'sjo' | 'kommun';
export type MnemonicTarget = 'lan' | 'stad' | 'landskap' | 'sjo' | 'kommun';

export interface MnemonicText {
  text: string;
  why?: string;
  short?: string;
}

export interface Mnemonic extends MnemonicText {
  id: string;
  category: MnemonicCategory;
  /** Vad regeln handlar om, t.ex. "Västernorrland → Härnösand". */
  entity: string;
  /** Ramsa, ordlek, historia, bild, konstig eller paradox. */
  kind: string;
  targets: Partial<Record<MnemonicTarget, string[]>>;
  /** Engelsk text; utan den visas regeln bara på svenska. */
  en?: MnemonicText;
}

export const MNEMONICS: readonly Mnemonic[] = [
  {
    id: 'p-vaster',
    category: 'princip',
    entity: 'Väster-paradoxen',
    kind: 'Paradox',
    targets: { lan: ['AC', 'Y', 'U', 'O'] },
    short: '”Väster”-länen ligger inte i väst, utom Västra Götaland.',
    text: 'Västerbotten och Västernorrland heter väster om Bottenviken och Bottenhavet, Västmanland väster om Uppland. Inget av dem ligger i västra Sverige; bara Västra Götaland gör det.',
    why: 'Namnen säger väster om något annat.',
  },
  {
    id: 'p-ostkust',
    category: 'princip',
    entity: 'Ostkusten, norra delen',
    kind: 'Ramsa',
    targets: { lan: ['BD', 'AC', 'Y', 'X', 'C'] },
    short: 'Norra ostkusten: Nya Vänner Vill Gärna Umgås (N, V, V, G, U).',
    text: '”Nya Vänner Vill Gärna Umgås.” Norrbotten, Västerbotten, Västernorrland, Gävleborg, Uppsala – i ordning söderut längs kusten.',
    why: 'Kortare ramsa; södra delen har en egen.',
  },
  {
    id: 'p-ostkust-syd',
    category: 'princip',
    entity: 'Ostkusten, södra delen',
    kind: 'Ramsa',
    targets: { lan: ['AB', 'D', 'E', 'H', 'K', 'M'] },
    short: 'Södra ostkusten: Stora Skepp Över Kalmarsund Bär Silver.',
    text: '”Stora Skepp Över Kalmarsund Bär Silver.” Stockholm, Södermanland, Östergötland, Kalmar, Blekinge, Skåne – i ordning söderut.',
    why: 'Ö står för Östergötland; Kalmarsund ger en bild av kusten.',
  },
  {
    id: 'p-vhs',
    category: 'princip',
    entity: 'Västkusten, norr till söder',
    kind: 'Ordlek',
    targets: { lan: ['O', 'N', 'M'] },
    short: 'Västkusten är ett VHS-band: Västra Götaland, Halland, Skåne.',
    text: 'Västkusten är ett VHS-band: Västra Götaland, Halland, Skåne.',
    why: 'Tre bokstäver, en gammal videokassett och hela västkusten i rätt ordning.',
  },
  {
    id: 'p-bytt-land',
    category: 'princip',
    entity: 'Landskap som bytt land',
    kind: 'Historia',
    targets: {
      landskap: ['skane', 'blekinge', 'halland', 'bohuslan', 'jamtland', 'harjedalen', 'gotland'],
    },
    short: 'Före detta danska och norska landskap ligger vid Danmark och Norge (utom Gotland).',
    text: 'Landskap som en gång var danska eller norska ligger vid det landets gräns: Skåne, Blekinge och Halland mot Danmark, Bohuslän, Jämtland och Härjedalen mot Norge. Undantaget är Gotland, danskt till 1645 men ute i Östersjön.',
    why: 'Historien förklarar kartan: man förlorar och vinner det som ligger närmast grannen.',
  },
  {
    id: 'p-gota-vattern',
    category: 'princip',
    entity: 'Väster- och Östergötland',
    kind: 'Bild',
    targets: { landskap: ['vastergotland', 'ostergotland'] },
    text: 'Vättern är skiljeväggen: Västergötland på vänster sida, Östergötland på höger.',
    why: 'Här betyder väster faktiskt väster, till skillnad från Väster-paradoxen.',
  },
  {
    id: 'p-jaure',
    category: 'princip',
    entity: 'Sjöar som slutar på -jaure och -träsk',
    kind: 'Ordlek',
    targets: { sjo: ['tornetrask', 'akkajaure', 'uddjaure', 'hornavan'] },
    text: 'Låter sjön samisk eller norrländsk (-jaure, -träsk) ligger den långt upp i Lappland. Torneträsk, Akkajaure och Uddjaure, plus grannen Hornavan.',
    why: 'Fyra av Sveriges tio största sjöar avgörs av namnets slut.',
  },
  {
    id: 'l-harnosand',
    category: 'lan',
    entity: 'Västernorrland → Härnösand',
    kind: 'Ordlek',
    targets: { stad: ['Y'] },
    text: 'Härnösand Håller Hovet, Sundsvall Säljer.',
    why: 'Den mindre staden är residensstad; den större är handelsstaden. Två H mot två S.',
  },
  {
    id: 'l-nykoping',
    category: 'lan',
    entity: 'Södermanland → Nyköping',
    kind: 'Historia',
    targets: { stad: ['D'] },
    short: 'Nyköping, gästabudets stad vid kusten söder om Stockholm, är Sörmlands residensstad.',
    text: 'Nyköpings gästabud 1317: kungen låste in sina bröder i slottets fängelsehåla. Nyköping ligger vid kusten söder om Stockholm, och det är där Sörmland har sin residensstad, inte i Eskilstuna.',
    why: 'En makaber berättelse fäster bättre än ett namn.',
  },
  {
    id: 'l-vaxjo',
    category: 'lan',
    entity: 'Kronoberg → Växjö',
    kind: 'Bild',
    targets: { stad: ['G'] },
    text: 'Det finns ingen stad som heter Kronoberg, men Kronobergs slottsruin står i en sjö strax utanför Växjö.',
    why: 'Länet har fått sitt namn från ruinen, och ruinen ligger vid residensstaden.',
  },
  {
    id: 'l-karlskrona',
    category: 'lan',
    entity: 'Blekinge → Karlskrona',
    kind: 'Historia',
    targets: { stad: ['K'] },
    text: 'Karlskrona betyder Karl XI:s krona: kungen byggde flottans stad 1680 längst ut i Blekinges skärgård.',
    why: 'Örlogsflottan ska ligga vid havet, och Blekinge är Sveriges sydöstra hörn.',
  },
  {
    id: 'l-lulea-umea',
    category: 'lan',
    entity: 'Norrbotten → Luleå, Västerbotten → Umeå',
    kind: 'Ordlek',
    targets: { stad: ['BD', 'AC'] },
    short: 'Luleå Längst upp, Umeå Under.',
    text: 'Luleå ligger Längst upp, Umeå Under.',
    why: 'Två städer som ofta blandas ihop, sorterade med sin första bokstav.',
  },
  {
    id: 'l-ostersund',
    category: 'lan',
    entity: 'Jämtland → Östersund',
    kind: 'Konstig',
    targets: { stad: ['Z'], sjo: ['storsjon'] },
    short: 'Storsjöodjuret simmar utanför Östersund i Jämtland.',
    text: 'Storsjöodjuret simmar i Storsjön utanför Östersund, mitt i Jämtland.',
    why: 'Ett sjöodjur är svårt att glömma, och sjön ger både läge och stad.',
  },
  {
    id: 'l-falun',
    category: 'lan',
    entity: 'Dalarna → Falun',
    kind: 'Bild',
    targets: { stad: ['W'] },
    text: 'Alla röda stugor i Dalarna är målade med Falu rödfärg från gruvan i Falun.',
    why: 'Dalahästar och röda stugor leder till samma stad.',
  },
  {
    id: 'l-gavle',
    category: 'lan',
    entity: 'Gävleborg → Gävle',
    kind: 'Konstig',
    targets: { stad: ['X'] },
    text: 'Gävlebocken brinner nästan varje jul i Gävle, vid kusten där Norrland börjar.',
    why: 'Ett återkommande nyhetsinslag som också säger var gränsen till Norrland går.',
  },
  {
    id: 'l-halmstad',
    category: 'lan',
    entity: 'Halland → Halmstad',
    kind: 'Ordlek',
    targets: { stad: ['N'] },
    text: 'HALmstad i HALland, mitt på västkusten mellan Göteborg och Skåne.',
    why: 'Enkel, men namnet gör jobbet.',
  },
  {
    id: 'k-norrlandskust',
    category: 'landskap',
    entity: 'Norrlandskusten, söder till norr',
    kind: 'Ramsa',
    targets: {
      landskap: ['gastrikland', 'halsingland', 'medelpad', 'angermanland', 'vasterbotten', 'norrbotten'],
    },
    short: 'Norrlandskusten: Glada Hälsingar Med Ångbåt Vill Norrut.',
    text: '”Glada Hälsingar Med Ångbåt Vill Norrut.” Gästrikland, Hälsingland, Medelpad, Ångermanland, Västerbotten, Norrbotten.',
    why: 'Sex landskap längs kusten i rätt ordning.',
  },
  {
    id: 'k-dalsland',
    category: 'landskap',
    entity: 'Dalsland',
    kind: 'Bild',
    targets: { landskap: ['dalsland'] },
    text: 'Dalsland är en dal inklämd mellan Vänern och Norge.',
    why: 'Två grannar som alla känner till ringar in ett litet landskap.',
  },
  {
    id: 'k-narke',
    category: 'landskap',
    entity: 'Närke',
    kind: 'Ordlek',
    targets: { landskap: ['narke'] },
    text: 'NÄRke ligger NÄRa mitten: runt Örebro och Hjälmaren, mellan Vänern och Mälaren.',
    why: 'Namnet blir en ledtråd, fast det egentligen betyder något annat.',
  },
  {
    id: 'k-medelpad',
    category: 'landskap',
    entity: 'Medelpad',
    kind: 'Ordlek',
    targets: { landskap: ['medelpad'] },
    text: 'MEDELpad ligger i MEDEL-läget på Norrlandskusten, runt Sundsvall.',
    why: 'Litet landskap, stor stad, och mitt i kustordningen.',
  },
  {
    id: 'k-lappland',
    category: 'landskap',
    entity: 'Lappland',
    kind: 'Bild',
    targets: { landskap: ['lappland'] },
    text: 'Lappland är Sveriges största landskap och ligger som en filt över hela fjällvärlden i norr, från Jämtland till Finland.',
    why: 'Det stora fältet i norr som inte rör kusten.',
  },
  {
    id: 's-vanern',
    category: 'sjo',
    entity: 'Vänern och Vättern',
    kind: 'Ordlek',
    targets: { sjo: ['vanern', 'vattern'] },
    short: 'VÄNern ligger till VÄNster om Vättern.',
    text: 'VÄNern ligger till VÄNster, Vättern till höger.',
    why: 'Sveriges två största sjöar blandas ofta ihop; första stavelsen avgör.',
  },
  {
    id: 's-hjalmaren',
    category: 'sjo',
    entity: 'Mälaren och Hjälmaren',
    kind: 'Bild',
    targets: { sjo: ['hjalmaren', 'malaren'] },
    short: 'Hjälmaren: Mälarens lillebror, väster om Mälaren vid Örebro.',
    text: 'Hjälmaren är Mälarens lillebror med hjälm. Den ligger väster om Mälaren, vid Örebro.',
    why: 'Liknande namn, lillebror är mindre och står bakom storebror.',
  },
  {
    id: 's-siljan',
    category: 'sjo',
    entity: 'Siljan',
    kind: 'Konstig',
    targets: { sjo: ['siljan'] },
    short: 'Siljan är en meteoritkrater mitt i Dalarna.',
    text: 'Siljan är ett hål efter en meteorit: Siljansringen i Dalarna är Europas största kända nedslagskrater.',
    why: 'En rund sjö mitt i Dalarna som en himlakropp har gjort.',
  },
  {
    id: 's-hornavan',
    category: 'sjo',
    entity: 'Hornavan',
    kind: 'Konstig',
    targets: { sjo: ['hornavan'] },
    text: 'Hornavan vid Arjeplog är Sveriges djupaste sjö, över 200 meter. Ett horn som går rakt ner.',
    why: 'Ett rekord gör en av de anonyma fjällsjöarna lätt att peka ut.',
  },
  {
    id: 's-tornetrask',
    category: 'sjo',
    entity: 'Torneträsk',
    kind: 'Bild',
    targets: { sjo: ['tornetrask'] },
    text: 'Torneträsk är den nordligaste av de stora sjöarna: malmtåget till Narvik kör längs stranden förbi Abisko.',
    why: 'Längst upp på kartan, nära Norge.',
  },
  {
    id: 'm-sundbyberg',
    category: 'kommun',
    entity: 'Sundbyberg',
    kind: 'Konstig',
    targets: { kommun: ['0183'] },
    short: 'Sundbyberg: Sveriges minsta kommun, inklämd vid Stockholm.',
    text: 'Sundbyberg är Sveriges minsta kommun, under 9 km², inklämd mellan Stockholm och Solna. Den får plats i en fingertopp på kartan.',
    why: 'Om du letar efter något pyttelitet nordväst om Stockholm: det är Sundbyberg.',
  },
];

export const MNEMONIC_BY_ID = new Map(MNEMONICS.map((m) => [m.id, m]));
