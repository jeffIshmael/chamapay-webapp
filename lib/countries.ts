export interface CountryInfo {
  name: string;
  iso2: string;
  iso3: string;
  dialCode: string;
  flag: string;
  placeholder?: string;
}

export const COUNTRIES: CountryInfo[] = [
  { name: "Kenya", iso2: "KE", iso3: "KEN", dialCode: "254", flag: "🇰🇪", placeholder: "712 345 678" },
  { name: "Uganda", iso2: "UG", iso3: "UGA", dialCode: "256", flag: "🇺🇬", placeholder: "712 345 678" },
  { name: "Tanzania", iso2: "TZ", iso3: "TZA", dialCode: "255", flag: "🇹🇿", placeholder: "712 345 678" },
  { name: "Rwanda", iso2: "RW", iso3: "RWA", dialCode: "250", flag: "🇷🇼", placeholder: "788 123 456" },
  { name: "Nigeria", iso2: "NG", iso3: "NGA", dialCode: "234", flag: "🇳🇬", placeholder: "802 123 4567" },
  { name: "Ghana", iso2: "GH", iso3: "GHA", dialCode: "233", flag: "🇬🇭", placeholder: "24 123 4567" },
  { name: "South Africa", iso2: "ZA", iso3: "ZAF", dialCode: "27", flag: "🇿🇦", placeholder: "82 123 4567" },
  { name: "Ethiopia", iso2: "ET", iso3: "ETH", dialCode: "251", flag: "🇪🇹", placeholder: "91 123 4567" },
  { name: "South Sudan", iso2: "SS", iso3: "SSD", dialCode: "211", flag: "🇸🇸", placeholder: "912 345 678" },
  { name: "Somalia", iso2: "SO", iso3: "SOM", dialCode: "252", flag: "🇸🇴", placeholder: "61 123 4567" },
  { name: "Burundi", iso2: "BI", iso3: "BIF", dialCode: "257", flag: "🇧🇮", placeholder: "79 123 456" },
  { name: "DR Congo", iso2: "CD", iso3: "COD", dialCode: "243", flag: "🇨🇩", placeholder: "81 123 4567" },
  { name: "Zambia", iso2: "ZM", iso3: "ZMB", dialCode: "260", flag: "🇿🇲", placeholder: "97 123 4567" },
  { name: "Zimbabwe", iso2: "ZW", iso3: "ZWE", dialCode: "263", flag: "🇿🇼", placeholder: "77 123 4567" },
  { name: "United States", iso2: "US", iso3: "USA", dialCode: "1", flag: "🇺🇸", placeholder: "415 555 2671" },
  { name: "United Kingdom", iso2: "GB", iso3: "GBR", dialCode: "44", flag: "🇬🇧", placeholder: "7911 123456" },
  { name: "Canada", iso2: "CA", iso3: "CAN", dialCode: "1", flag: "🇨🇦", placeholder: "416 555 0199" },
  { name: "Germany", iso2: "DE", iso3: "DEU", dialCode: "49", flag: "🇩🇪", placeholder: "151 12345678" },
  { name: "France", iso2: "FR", iso3: "FRA", dialCode: "33", flag: "🇫🇷", placeholder: "6 12 34 56 78" },
  { name: "Netherlands", iso2: "NL", iso3: "NLD", dialCode: "31", flag: "🇳🇱", placeholder: "6 12345678" },
  { name: "United Arab Emirates", iso2: "AE", iso3: "ARE", dialCode: "971", flag: "🇦🇪", placeholder: "50 123 4567" },
  { name: "Saudi Arabia", iso2: "SA", iso3: "SAU", dialCode: "966", flag: "🇸🇦", placeholder: "50 123 4567" },
  { name: "India", iso2: "IN", iso3: "IND", dialCode: "91", flag: "🇮🇳", placeholder: "98765 43210" },
  { name: "Australia", iso2: "AU", iso3: "AUS", dialCode: "61", flag: "🇦🇺", placeholder: "412 345 678" },
];

export const DEFAULT_COUNTRY = COUNTRIES[0]; // Kenya

export function findCountryByIso2(iso2: string): CountryInfo {
  return COUNTRIES.find((c) => c.iso2.toUpperCase() === iso2.toUpperCase()) || DEFAULT_COUNTRY;
}

export function findCountryByIso3(iso3: string): CountryInfo {
  return COUNTRIES.find((c) => c.iso3.toUpperCase() === iso3.toUpperCase()) || DEFAULT_COUNTRY;
}

