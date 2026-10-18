// Offline city list for the prayer location picker: [name, country, lat, lng].
// GPS ("Use my location") and manual coordinates cover anywhere not listed.
export const CITIES: [string, string, number, number][] = [
  // Germany
  ['Berlin', 'Germany', 52.52, 13.405], ['Hamburg', 'Germany', 53.551, 9.994], ['Munich', 'Germany', 48.137, 11.575],
  ['Cologne', 'Germany', 50.938, 6.96], ['Frankfurt am Main', 'Germany', 50.11, 8.682], ['Stuttgart', 'Germany', 48.776, 9.183],
  ['Düsseldorf', 'Germany', 51.227, 6.773], ['Leipzig', 'Germany', 51.34, 12.375], ['Dortmund', 'Germany', 51.514, 7.468],
  ['Essen', 'Germany', 51.456, 7.012], ['Bremen', 'Germany', 53.079, 8.802], ['Dresden', 'Germany', 51.05, 13.738],
  ['Hanover', 'Germany', 52.375, 9.732], ['Nuremberg', 'Germany', 49.452, 11.077], ['Duisburg', 'Germany', 51.434, 6.762],
  ['Bochum', 'Germany', 51.482, 7.216], ['Wuppertal', 'Germany', 51.256, 7.151], ['Bielefeld', 'Germany', 52.03, 8.532],
  ['Bonn', 'Germany', 50.737, 7.098], ['Münster', 'Germany', 51.961, 7.626], ['Mannheim', 'Germany', 49.487, 8.466],
  ['Karlsruhe', 'Germany', 49.007, 8.404], ['Augsburg', 'Germany', 48.371, 10.898], ['Wiesbaden', 'Germany', 50.078, 8.24],
  ['Mönchengladbach', 'Germany', 51.18, 6.442], ['Gelsenkirchen', 'Germany', 51.518, 7.086], ['Aachen', 'Germany', 50.776, 6.084],
  ['Braunschweig', 'Germany', 52.269, 10.521], ['Kiel', 'Germany', 54.323, 10.123], ['Chemnitz', 'Germany', 50.833, 12.925],
  ['Halle (Saale)', 'Germany', 51.483, 11.97], ['Magdeburg', 'Germany', 52.12, 11.628], ['Freiburg im Breisgau', 'Germany', 47.999, 7.842],
  ['Krefeld', 'Germany', 51.339, 6.586], ['Mainz', 'Germany', 49.993, 8.247], ['Lübeck', 'Germany', 53.866, 10.686],
  ['Erfurt', 'Germany', 50.978, 11.029], ['Oberhausen', 'Germany', 51.496, 6.864], ['Rostock', 'Germany', 54.092, 12.099],
  ['Kassel', 'Germany', 51.312, 9.48], ['Hagen', 'Germany', 51.367, 7.463], ['Saarbrücken', 'Germany', 49.24, 6.997],
  ['Potsdam', 'Germany', 52.391, 13.064], ['Hamm', 'Germany', 51.68, 7.82], ['Ludwigshafen', 'Germany', 49.477, 8.445],
  ['Oldenburg', 'Germany', 53.143, 8.214], ['Osnabrück', 'Germany', 52.279, 8.047], ['Leverkusen', 'Germany', 51.046, 6.984],
  ['Heidelberg', 'Germany', 49.398, 8.672], ['Darmstadt', 'Germany', 49.873, 8.651], ['Solingen', 'Germany', 51.171, 7.083],
  ['Regensburg', 'Germany', 49.013, 12.101], ['Paderborn', 'Germany', 51.719, 8.754], ['Ingolstadt', 'Germany', 48.766, 11.426],
  ['Würzburg', 'Germany', 49.791, 9.953], ['Ulm', 'Germany', 48.401, 9.987], ['Wolfsburg', 'Germany', 52.423, 10.787],
  ['Göttingen', 'Germany', 51.541, 9.916], ['Offenbach am Main', 'Germany', 50.1, 8.766], ['Pforzheim', 'Germany', 48.892, 8.695],
  ['Heilbronn', 'Germany', 49.142, 9.219], ['Bottrop', 'Germany', 51.524, 6.929], ['Trier', 'Germany', 49.75, 6.637],
  ['Recklinghausen', 'Germany', 51.614, 7.198], ['Reutlingen', 'Germany', 48.492, 9.204], ['Bremerhaven', 'Germany', 53.54, 8.58],
  ['Koblenz', 'Germany', 50.356, 7.594], ['Jena', 'Germany', 50.927, 11.586], ['Siegen', 'Germany', 50.875, 8.024],
  ['Gießen', 'Germany', 50.584, 8.678], ['Marburg', 'Germany', 50.81, 8.771], ['Flensburg', 'Germany', 54.784, 9.437],
  ['Konstanz', 'Germany', 47.66, 9.175], ['Passau', 'Germany', 48.575, 13.461], ['Bamberg', 'Germany', 49.898, 10.902],
  // Europe
  ['Vienna', 'Austria', 48.208, 16.373], ['Zurich', 'Switzerland', 47.377, 8.541], ['Basel', 'Switzerland', 47.56, 7.588],
  ['Amsterdam', 'Netherlands', 52.368, 4.904], ['Rotterdam', 'Netherlands', 51.924, 4.478], ['Brussels', 'Belgium', 50.85, 4.352],
  ['Paris', 'France', 48.857, 2.352], ['Lyon', 'France', 45.764, 4.836], ['Marseille', 'France', 43.296, 5.37],
  ['London', 'United Kingdom', 51.507, -0.128], ['Birmingham', 'United Kingdom', 52.486, -1.89], ['Manchester', 'United Kingdom', 53.48, -2.242],
  ['Copenhagen', 'Denmark', 55.676, 12.568], ['Stockholm', 'Sweden', 59.329, 18.069], ['Oslo', 'Norway', 59.914, 10.752],
  ['Warsaw', 'Poland', 52.23, 21.012], ['Prague', 'Czechia', 50.075, 14.438], ['Madrid', 'Spain', 40.417, -3.704],
  ['Barcelona', 'Spain', 41.389, 2.159], ['Rome', 'Italy', 41.903, 12.496], ['Milan', 'Italy', 45.464, 9.19],
  ['Sarajevo', 'Bosnia and Herzegovina', 43.856, 18.413], ['Pristina', 'Kosovo', 42.663, 21.164], ['Tirana', 'Albania', 41.328, 19.819],
  ['Athens', 'Greece', 37.984, 23.728], ['Istanbul', 'Türkiye', 41.008, 28.978], ['Ankara', 'Türkiye', 39.933, 32.86],
  ['Izmir', 'Türkiye', 38.424, 27.143],
  // Middle East & North Africa
  ['Mecca', 'Saudi Arabia', 21.389, 39.858], ['Medina', 'Saudi Arabia', 24.467, 39.611], ['Riyadh', 'Saudi Arabia', 24.713, 46.675],
  ['Jeddah', 'Saudi Arabia', 21.485, 39.193], ['Dubai', 'UAE', 25.205, 55.271], ['Abu Dhabi', 'UAE', 24.454, 54.377],
  ['Doha', 'Qatar', 25.285, 51.531], ['Kuwait City', 'Kuwait', 29.376, 47.977], ['Manama', 'Bahrain', 26.229, 50.586],
  ['Muscat', 'Oman', 23.588, 58.383], ['Amman', 'Jordan', 31.954, 35.911], ['Jerusalem', 'Palestine', 31.778, 35.235],
  ['Beirut', 'Lebanon', 33.894, 35.502], ['Damascus', 'Syria', 33.514, 36.277], ['Baghdad', 'Iraq', 33.315, 44.366],
  ['Erbil', 'Iraq', 36.191, 44.009], ['Tehran', 'Iran', 35.689, 51.389], ['Cairo', 'Egypt', 30.044, 31.236],
  ['Alexandria', 'Egypt', 31.2, 29.918], ['Casablanca', 'Morocco', 33.573, -7.59], ['Rabat', 'Morocco', 34.02, -6.842],
  ['Algiers', 'Algeria', 36.754, 3.059], ['Tunis', 'Tunisia', 36.806, 10.181], ['Tripoli', 'Libya', 32.887, 13.191],
  ['Khartoum', 'Sudan', 15.501, 32.56], ['Sana’a', 'Yemen', 15.369, 44.191],
  // Asia
  ['Karachi', 'Pakistan', 24.861, 67.01], ['Lahore', 'Pakistan', 31.52, 74.359], ['Islamabad', 'Pakistan', 33.684, 73.048],
  ['Rawalpindi', 'Pakistan', 33.565, 73.017], ['Faisalabad', 'Pakistan', 31.418, 73.079], ['Peshawar', 'Pakistan', 34.015, 71.525],
  ['Multan', 'Pakistan', 30.158, 71.525], ['Kabul', 'Afghanistan', 34.555, 69.207], ['Delhi', 'India', 28.614, 77.209],
  ['Mumbai', 'India', 19.076, 72.878], ['Hyderabad', 'India', 17.385, 78.487], ['Bangalore', 'India', 12.972, 77.595],
  ['Dhaka', 'Bangladesh', 23.81, 90.413], ['Chittagong', 'Bangladesh', 22.357, 91.783], ['Colombo', 'Sri Lanka', 6.927, 79.861],
  ['Kuala Lumpur', 'Malaysia', 3.139, 101.687], ['Singapore', 'Singapore', 1.352, 103.82], ['Jakarta', 'Indonesia', -6.209, 106.846],
  ['Tashkent', 'Uzbekistan', 41.299, 69.24], ['Baku', 'Azerbaijan', 40.409, 49.867], ['Almaty', 'Kazakhstan', 43.222, 76.851],
  // Africa
  ['Lagos', 'Nigeria', 6.524, 3.379], ['Kano', 'Nigeria', 12.002, 8.592], ['Dakar', 'Senegal', 14.716, -17.467],
  ['Mogadishu', 'Somalia', 2.047, 45.318], ['Nairobi', 'Kenya', -1.292, 36.822], ['Addis Ababa', 'Ethiopia', 9.03, 38.74],
  ['Johannesburg', 'South Africa', -26.204, 28.047], ['Cape Town', 'South Africa', -33.925, 18.424],
  // Americas & Oceania
  ['New York', 'USA', 40.713, -74.006], ['Chicago', 'USA', 41.878, -87.63], ['Los Angeles', 'USA', 34.052, -118.244],
  ['Houston', 'USA', 29.76, -95.37], ['Dearborn', 'USA', 42.322, -83.176], ['Toronto', 'Canada', 43.653, -79.383],
  ['Montreal', 'Canada', 45.502, -73.567], ['Sydney', 'Australia', -33.869, 151.209], ['Melbourne', 'Australia', -37.814, 144.963],
]

function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss')
}

export function searchCities(query: string, limit = 30): [string, string, number, number][] {
  const q = fold(query.trim())
  if (!q) return CITIES.slice(0, limit)
  const starts = CITIES.filter(([n]) => fold(n).startsWith(q))
  const contains = CITIES.filter(([n, c]) => !fold(n).startsWith(q) && (fold(n).includes(q) || fold(c).includes(q)))
  return [...starts, ...contains].slice(0, limit)
}
