/**
 * Sveriges 75 största städer som inte är residensstäder, för läget "Fler städer".
 *
 * Urval: tätorterna med flest invånare enligt SCB 2023 (tabell MI0810, "Folkmängd och landareal
 * i tätorter"), utom
 *   - de 21 residensstäderna,
 *   - förorter: tätorter inom 35 km från Stockholms centrum eller 25 km från Göteborgs och
 *     Malmös (t.ex. Upplands Väsby och Sollentuna, Tumba, Lidingö, Kungälv, Lerum, Staffanstorp),
 *     men Södertälje och Lund är med eftersom de är egna städer,
 *   - bostadsorterna Märsta, Skoghall och Onsala.
 * SCB:s tätort "Sundsvall och Timrå" heter här Sundsvall.
 *
 * Koordinaterna (WGS84) är tätortens läge enligt Wikidata, matchat på namn och kommunkod.
 * Varje stad ligger i rätt län på spelets karta (kontrollerat när listan togs fram).
 */
export interface City {
  name: string;
  /** Länsbokstav för länet staden ligger i, t.ex. "M" */
  county: string;
  /** Folkmängd i tätorten 2023 enligt SCB */
  population: number;
  lat: number;
  lon: number;
}

export const OTHER_CITIES: readonly City[] = [
  { name: 'Helsingborg', county: 'M', population: 116029, lat: 56.0424, lon: 12.7210 },
  { name: 'Lund', county: 'M', population: 98308, lat: 55.7083, lon: 13.1992 },
  { name: 'Norrköping', county: 'E', population: 98229, lat: 58.5793, lon: 16.1493 },
  { name: 'Södertälje', county: 'AB', population: 78377, lat: 59.1944, lon: 17.5990 },
  { name: 'Borås', county: 'O', population: 75565, lat: 57.7171, lon: 12.9457 },
  { name: 'Sundsvall', county: 'Y', population: 70918, lat: 62.3955, lon: 17.2860 },
  { name: 'Eskilstuna', county: 'D', population: 70646, lat: 59.3773, lon: 16.5127 },
  { name: 'Trollhättan', county: 'O', population: 50069, lat: 58.2828, lon: 12.2892 },
  { name: 'Borlänge', county: 'W', population: 44299, lat: 60.4883, lon: 15.4273 },
  { name: 'Kristianstad', county: 'M', population: 41198, lat: 56.0206, lon: 14.1257 },
  { name: 'Skövde', county: 'O', population: 40422, lat: 58.3995, lon: 13.8538 },
  { name: 'Skellefteå', county: 'AC', population: 39146, lat: 64.7507, lon: 20.9528 },
  { name: 'Varberg', county: 'N', population: 38575, lat: 57.0973, lon: 12.2733 },
  { name: 'Uddevalla', county: 'O', population: 35639, lat: 58.3492, lon: 11.9381 },
  { name: 'Landskrona', county: 'M', population: 33859, lat: 55.8794, lon: 12.8370 },
  { name: 'Örnsköldsvik', county: 'Y', population: 33399, lat: 63.2655, lon: 18.6762 },
  { name: 'Motala', county: 'E', population: 31367, lat: 58.5442, lon: 15.0369 },
  { name: 'Trelleborg', county: 'M', population: 31366, lat: 55.3723, lon: 13.1812 },
  { name: 'Ängelholm', county: 'M', population: 31089, lat: 56.2400, lon: 12.8600 },
  { name: 'Falkenberg', county: 'N', population: 29671, lat: 56.9014, lon: 12.4971 },
  { name: 'Alingsås', county: 'O', population: 27895, lat: 57.9301, lon: 12.5308 },
  { name: 'Karlskoga', county: 'T', population: 27261, lat: 59.3151, lon: 14.4917 },
  { name: 'Enköping', county: 'C', population: 26353, lat: 59.6403, lon: 17.0725 },
  { name: 'Sandviken', county: 'X', population: 24827, lat: 60.6125, lon: 16.7681 },
  { name: 'Vänersborg', county: 'O', population: 24731, lat: 58.3654, lon: 12.3245 },
  { name: 'Katrineholm', county: 'D', population: 23953, lat: 58.9919, lon: 16.2014 },
  { name: 'Piteå', county: 'BD', population: 23824, lat: 65.3197, lon: 21.4511 },
  { name: 'Norrtälje', county: 'AB', population: 23606, lat: 59.7580, lon: 18.7050 },
  { name: 'Lidköping', county: 'O', population: 23585, lat: 58.4980, lon: 13.1499 },
  { name: 'Västervik', county: 'H', population: 21615, lat: 57.7563, lon: 16.6317 },
  { name: 'Ystad', county: 'M', population: 21259, lat: 55.4346, lon: 13.8254 },
  { name: 'Eslöv', county: 'M', population: 20422, lat: 55.8386, lon: 13.2999 },
  { name: 'Värnamo', county: 'F', population: 20273, lat: 57.1818, lon: 14.0585 },
  { name: 'Karlshamn', county: 'K', population: 19966, lat: 56.1748, lon: 14.8582 },
  { name: 'Hässleholm', county: 'M', population: 19760, lat: 56.1594, lon: 13.7784 },
  { name: 'Oskarshamn', county: 'H', population: 18817, lat: 57.2617, lon: 16.4470 },
  { name: 'Nässjö', county: 'F', population: 18639, lat: 57.6529, lon: 14.7048 },
  { name: 'Köping', county: 'U', population: 18605, lat: 59.5141, lon: 15.9915 },
  { name: 'Kristinehamn', county: 'S', population: 18358, lat: 59.3063, lon: 14.0773 },
  { name: 'Falköping', county: 'O', population: 17924, lat: 58.1700, lon: 13.5551 },
  { name: 'Kumla', county: 'T', population: 17889, lat: 59.1243, lon: 15.1457 },
  { name: 'Kiruna', county: 'BD', population: 17284, lat: 67.8489, lon: 20.3028 },
  { name: 'Hudiksvall', county: 'X', population: 16792, lat: 61.7290, lon: 17.1121 },
  { name: 'Mariestad', county: 'O', population: 16750, lat: 58.7018, lon: 13.8254 },
  { name: 'Boden', county: 'BD', population: 16644, lat: 65.8182, lon: 21.7046 },
  { name: 'Nynäshamn', county: 'AB', population: 16447, lat: 58.9076, lon: 17.9446 },
  { name: 'Höganäs', county: 'M', population: 16274, lat: 56.1960, lon: 12.5769 },
  { name: 'Bålsta', county: 'C', population: 16205, lat: 59.5512, lon: 17.5041 },
  { name: 'Ljungby', county: 'G', population: 16076, lat: 56.8354, lon: 13.9410 },
  { name: 'Avesta', county: 'W', population: 16055, lat: 60.1390, lon: 16.1837 },
  { name: 'Ludvika', county: 'W', population: 15675, lat: 60.1202, lon: 15.1706 },
  { name: 'Kinna', county: 'O', population: 15507, lat: 57.4954, lon: 12.6805 },
  { name: 'Strängnäs', county: 'D', population: 15369, lat: 59.3646, lon: 17.0225 },
  { name: 'Tranås', county: 'F', population: 14611, lat: 58.0322, lon: 14.9750 },
  { name: 'Stenungsund', county: 'O', population: 14381, lat: 58.0637, lon: 11.8360 },
  { name: 'Mjölby', county: 'E', population: 14282, lat: 58.3321, lon: 15.1312 },
  { name: 'Arvika', county: 'S', population: 14186, lat: 59.6580, lon: 12.5929 },
  { name: 'Höör', county: 'M', population: 14004, lat: 55.9097, lon: 13.5473 },
  { name: 'Bollnäs', county: 'X', population: 13918, lat: 61.3484, lon: 16.3883 },
  { name: 'Vetlanda', county: 'F', population: 13895, lat: 57.4219, lon: 15.0779 },
  { name: 'Sala', county: 'U', population: 13702, lat: 59.9220, lon: 16.5923 },
  { name: 'Nybro', county: 'H', population: 13584, lat: 56.7429, lon: 15.9108 },
  { name: 'Finspång', county: 'E', population: 13186, lat: 58.7049, lon: 15.8094 },
  { name: 'Mora', county: 'W', population: 12830, lat: 61.0096, lon: 14.5635 },
  { name: 'Ronneby', county: 'K', population: 12636, lat: 56.2069, lon: 15.2791 },
  { name: 'Gällivare', county: 'BD', population: 12385, lat: 67.1333, lon: 20.6500 },
  { name: 'Söderhamn', county: 'X', population: 12038, lat: 61.3084, lon: 17.0526 },
  { name: 'Ulricehamn', county: 'O', population: 11794, lat: 57.7917, lon: 13.4186 },
  { name: 'Fagersta', county: 'U', population: 11771, lat: 59.9925, lon: 15.8229 },
  { name: 'Oxelösund', county: 'D', population: 11485, lat: 58.6702, lon: 17.1145 },
  { name: 'Skara', county: 'O', population: 11475, lat: 58.3842, lon: 13.4349 },
  { name: 'Bjuv', county: 'M', population: 11209, lat: 56.0733, lon: 12.9417 },
  { name: 'Eksjö', county: 'F', population: 11077, lat: 57.6647, lon: 14.9749 },
  { name: 'Älmhult', county: 'G', population: 11053, lat: 56.5515, lon: 14.1351 },
  { name: 'Arboga', county: 'U', population: 10906, lat: 59.3994, lon: 15.8269 },
];
