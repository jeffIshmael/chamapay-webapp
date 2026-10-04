export const withCommas = (raw: string): string => {
  if (!raw) return "";
  const [int, dec] = raw.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec !== undefined ? `${grouped}.${dec}` : grouped;
};
export const stripCommas = (s: string): string => s.replace(/,/g, "");
