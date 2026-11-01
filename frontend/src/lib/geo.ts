/** ISO alpha-2 country code -> display name, with a safe fallback. */
export const countryName = (code: string): string => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
};
