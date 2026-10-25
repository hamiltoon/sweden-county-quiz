/** Live-frågorna som spelets vanliga frågor, så att texter och namn blir desamma. */
import type { Question } from '../game/game';
import type { LiveQuestion } from '../shared/live';
import { COUNTY_BY_CODE } from '../data/counties';
import { PROVINCE_BY_CODE } from '../data/provinces';
import { MUNICIPALITY_BY_CODE } from '../data/municipalities';
import { OTHER_CITIES } from '../data/cities';
import { LAKE_BY_ID } from '../data/lakes';

const CITY_BY_NAME = new Map(OTHER_CITIES.map((c) => [c.name, c]));

export function toGameQuestion(q: LiveQuestion): Question | null {
  switch (q.kind) {
    case 'landskap': {
      const province = PROVINCE_BY_CODE.get(q.target);
      return province ? { kind: 'landskap', province } : null;
    }
    case 'kommun': {
      const municipality = MUNICIPALITY_BY_CODE.get(q.target);
      return municipality ? { kind: 'kommun', municipality } : null;
    }
    case 'ort': {
      const city = CITY_BY_NAME.get(q.target);
      return city ? { kind: 'ort', city } : null;
    }
    case 'sjo': {
      const lake = LAKE_BY_ID.get(q.target);
      return lake ? { kind: 'sjo', lake } : null;
    }
    default: {
      const county = COUNTY_BY_CODE.get(q.target);
      return county ? { kind: q.kind, county } : null;
    }
  }
}
