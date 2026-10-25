/**
 * Vilken miljö spelet är byggt för. `npm run deploy:staging` bygger med VITE_ENVIRONMENT=staging;
 * då visar spelet en banderoll och "[Staging]" i titeln, så att ingen tar staging för det riktiga
 * spelet med den riktiga topplistan.
 */
export const IS_STAGING = import.meta.env.VITE_ENVIRONMENT === 'staging';
