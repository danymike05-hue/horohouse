/**
 * HoroHouse — Database Seed Script
 * ─────────────────────────────────
 * Generates realistic test data for Cameroon / Côte d'Ivoire / Senegal market.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register seed.ts
 *
 * Options (env vars):
 *   MONGO_URI        — defaults to mongodb://localhost:27017/horohouse
 *   SEED_USERS       — number of users to create  (default: 150)
 *   SEED_PROPERTIES  — number of properties       (default: 300)
 *   CLEAR_FIRST      — set to "true" to wipe collections before seeding
 *
 * Install deps if missing:
 *   npm install --save-dev @faker-js/faker bcryptjs mongoose ts-node
 */

import mongoose, { Types } from 'mongoose';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

// ─── Pull schemas directly from your source files ────────────────────────────
// Adjust these import paths to match your actual project layout.
import { UserSchema, UserRole, HostVerificationStatus, PayoutMethod, StudentVerificationStatus } from './src/users/schemas/user.schema';
import { PropertySchema, PropertyType, PropertyStatus, ApprovalStatus, ListingType, PricingUnit, CancellationPolicy, WaterSource, ElectricityBackup, FurnishingStatus, GenderRestriction } from './src/properties/schemas/property.schema';

// ─── Config ───────────────────────────────────────────────────────────────────

const MONGO_URI     = process.env.MONGO_URI     ?? 'mongodb://localhost:27017/horohouse';
const SEED_USERS    = parseInt(process.env.SEED_USERS    ?? '150', 10);
const SEED_PROPS    = parseInt(process.env.SEED_PROPERTIES ?? '300', 10);
const CLEAR_FIRST   = process.env.CLEAR_FIRST === 'true';
const SEED_PASSWORD = 'HoroHouse2026!'; // all seeded users share this password

// ─── Market data — realistic for your three target countries ─────────────────

const CITIES: Record<string, { lat: number; lng: number; country: string; neighborhoods: string[] }> = {
  Douala:    { lat: 4.0511,  lng: 9.7679,  country: 'Cameroon',      neighborhoods: ['Akwa', 'Bonanjo', 'Bonapriso', 'Bali', 'Makepe', 'Logpom', 'Kotto', 'Deido'] },
  Yaoundé:   { lat: 3.8480,  lng: 11.5021, country: 'Cameroon',      neighborhoods: ['Bastos', 'Mvan', 'Essos', 'Ngousso', 'Omnisport', 'Elig-Essono', 'Mimboman'] },
  Bafoussam: { lat: 5.4764,  lng: 10.4175, country: 'Cameroon',      neighborhoods: ['Banengo', 'Kamkop', 'Djeleng', 'Tamdja'] },
  Kribi:     { lat: 2.9392,  lng: 9.9073,  country: 'Cameroon',      neighborhoods: ['Centre-ville', 'Mpalla', 'Talla', 'Ngoye'] },
  Abidjan:   { lat: 5.3599,  lng: -4.0082, country: "Côte d'Ivoire", neighborhoods: ['Cocody', 'Plateau', 'Marcory', 'Yopougon', 'Treichville', 'Adjamé', 'Koumassi'] },
  Dakar:     { lat: 14.7167, lng: -17.4677,country: 'Senegal',       neighborhoods: ['Plateau', 'Mermoz', 'Almadies', 'Ouakam', 'Liberté', 'Parcelles Assainies'] },
  'Saint-Louis': { lat: 16.0326, lng: -16.4818, country: 'Senegal',  neighborhoods: ['Île Saint-Louis', 'Sor', 'Guet Ndar', 'Ndar Toute'] },
};

const UNIVERSITIES: Record<string, string[]> = {
  Douala:    ['Université de Douala', 'IUT de Douala', 'ESSEC Douala'],
  Yaoundé:   ["Université de Yaoundé I", "Université de Yaoundé II", 'IRIC', 'ENSP Yaoundé'],
  Bafoussam: ['Université de Dschang — campus Bafoussam'],
  Abidjan:   ["Université Félix Houphouët-Boigny", 'INPHB', 'Université Abobo-Adjamé'],
  Dakar:     ['Université Cheikh Anta Diop', 'ISM Dakar', 'UCAO Dakar'],
};

const FRANCOPHONE_NAMES = {
  first: ['Jean-Baptiste', 'Marie-Claire', 'Aminata', 'Fatoumata', 'Rodrigue', 'Cédric', 'Nadège', 'Blaise', 'Épiphanie', 'Ornella', 'Alioune', 'Mamadou', 'Isabelle', 'Patrick', 'Gisèle', 'Ernest', 'Sandrine', 'Hervé', 'Christiane', 'Étienne', 'Astride', 'Narcisse', 'Laure', 'Olivier', 'Véronique'],
  last:  ['Mbeki', 'Diallo', 'Nkomo', 'Kouassi', 'Njoya', 'Traore', 'Ondoa', 'Sow', 'Biyong', 'Coulibaly', 'Atangana', 'Bah', 'Fouda', 'Keita', 'Mvondo', 'Camara', 'Eto\'o', 'Ndiaye', 'Bello', 'Diouf', 'Essomba', 'Sy', 'Manga', 'Barry', 'Owona'],
};

const PROPERTY_TITLES: Record<PropertyType, string[]> = {
  [PropertyType.APARTMENT]:          ['Bel appartement moderne', 'Appartement lumineux avec vue', 'Grand appartement bien situé', 'Appartement standing au centre-ville'],
  [PropertyType.HOUSE]:              ['Belle villa familiale', 'Maison individuelle avec jardin', 'Grande maison en duplex', 'Maison spacieuse quartier calme'],
  [PropertyType.VILLA]:              ['Villa de standing avec piscine', 'Villa luxueuse résidence fermée', 'Splendide villa contemporaine'],
  [PropertyType.STUDIO]:             ['Studio meublé tout confort', 'Studio fonctionnel bien placé', 'Studio cosy idéal étudiant'],
  [PropertyType.DUPLEX]:             ['Duplex moderne avec terrasse', 'Grand duplex vue dégagée'],
  [PropertyType.BUNGALOW]:           ['Bungalow de charme', 'Bungalow vue mer'],
  [PropertyType.PENTHOUSE]:          ['Penthouse luxe dernier étage', 'Penthouse panoramique'],
  [PropertyType.LAND]:               ['Terrain titré constructible', 'Parcelle viabilisée'],
  [PropertyType.COMMERCIAL]:         ['Local commercial bien situé', 'Espace commercial en activité'],
  [PropertyType.OFFICE]:             ['Bureau moderne open space', 'Plateau de bureaux climatisé'],
  [PropertyType.SHOP]:               ['Boutique en rez-de-chaussée', 'Local à usage commercial'],
  [PropertyType.WAREHOUSE]:          ['Entrepôt sécurisé', 'Magasin de stockage'],
  [PropertyType.HOTEL]:              ['Hôtel boutique en centre-ville', 'Résidence hôtelière'],
  [PropertyType.MOTEL]:              ['Motel bien équipé'],
  [PropertyType.VACATION_RENTAL]:    ['Location vacances bord de mer', 'Villa vacances tout confort'],
  [PropertyType.GUESTHOUSE]:         ['Maison d\'hôtes chaleureuse', 'Guest house tranquille'],
  [PropertyType.HOSTEL]:             ['Auberge jeunesse moderne', 'Hostel climatisé centre-ville'],
  [PropertyType.RESORT]:             ['Resort balnéaire haut de gamme'],
  [PropertyType.SERVICED_APARTMENT]: ['Appartement hôtelier tout inclus', 'Suite résidentielle services inclus'],
};

const NEARBY: string[] = ['Marché', 'Pharmacie', 'École primaire', 'Lycée', 'Supermarché', 'Hôpital', 'Banque', 'Restaurant', 'Mosquée', 'Église', 'Station-service', 'Agence bancaire'];
const TRANSPORT: string[] = ['Taxi-moto', 'Bus', 'Taxi', 'Benskin', 'Clando', 'À pied du marché', 'Proche gare routière'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randName() {
  return `${faker.helpers.arrayElement(FRANCOPHONE_NAMES.first)} ${faker.helpers.arrayElement(FRANCOPHONE_NAMES.last)}`;
}

function randPhone(country: string): string {
  if (country === 'Cameroon')      return `+237 6${faker.string.numeric(2)} ${faker.string.numeric(3)} ${faker.string.numeric(3)}`;
  if (country === "Côte d'Ivoire") return `+225 07 ${faker.string.numeric(2)} ${faker.string.numeric(2)} ${faker.string.numeric(2)}`;
  return `+221 77 ${faker.string.numeric(3)} ${faker.string.numeric(2)} ${faker.string.numeric(2)}`;
}

function randCoords(base: { lat: number; lng: number }, radiusKm = 5): [number, number] {
  const r = radiusKm / 111; // degrees per km (approx)
  return [
    base.lng + (Math.random() - 0.5) * r * 2,
    base.lat + (Math.random() - 0.5) * r * 2,
  ];
}

function randPriceXAF(listingType: ListingType, type: PropertyType): number {
  if (listingType === ListingType.SALE) {
    if ([PropertyType.LAND].includes(type))        return faker.number.int({ min: 5_000_000,   max: 50_000_000 });
    if ([PropertyType.VILLA, PropertyType.PENTHOUSE].includes(type)) return faker.number.int({ min: 80_000_000, max: 500_000_000 });
    return faker.number.int({ min: 15_000_000, max: 150_000_000 });
  }
  if (listingType === ListingType.SHORT_TERM) {
    return faker.number.int({ min: 10_000, max: 150_000 }); // nightly
  }
  // long-term rent — monthly
  if (type === PropertyType.STUDIO)    return faker.number.int({ min: 30_000,  max: 80_000 });
  if (type === PropertyType.APARTMENT) return faker.number.int({ min: 60_000,  max: 250_000 });
  if (type === PropertyType.VILLA)     return faker.number.int({ min: 250_000, max: 800_000 });
  return faker.number.int({ min: 80_000, max: 350_000 });
}

function slugify(title: string, id: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + id.slice(-6);
}

// ─── Cloudinary manifest (written by seed-images.ts) ─────────────────────────

const MANIFEST_PATH = path.join(__dirname, 'seed-image-manifest.json');
type ImageRecord = { url: string; publicId: string };
type Manifest = Record<string, ImageRecord[]>;

let _manifest: Manifest | null = null;

function getManifest(): Manifest {
  if (_manifest) return _manifest;
  if (fs.existsSync(MANIFEST_PATH)) {
    _manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
    console.log(`📦 Loaded image manifest (${Object.values(_manifest!).flat().length} images)`);
  } else {
    console.warn(`⚠️  No manifest found at ${MANIFEST_PATH}. Run seed-images.ts first for real photos.`);
    _manifest = {};
  }
  return _manifest!;
}

/**
 * Pick N real Cloudinary images for a property.
 * Falls back to a placeholder URL if the manifest is empty or category is missing.
 */
function pickImages(
  category: string,
  count: number,
  fallbackCategory = 'exterior',
): ImageRecord[] {
  const manifest = getManifest();
  const pool = manifest[category]?.length
    ? manifest[category]
    : manifest[fallbackCategory] ?? [];

  if (pool.length === 0) {
    // Absolute fallback — Unsplash direct URL (still works, just not on Cloudinary)
    return Array.from({ length: count }, (_, i) => ({
      url: `https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200&q=80&auto=format&fit=crop`,
      publicId: `seed/fallback/prop_${Date.now()}_${i}`,
    }));
  }

  // Sample with replacement if pool is smaller than count
  return Array.from({ length: count }, () => faker.helpers.arrayElement(pool));
}

// ─── User factory ─────────────────────────────────────────────────────────────

async function makeUser(index: number, passwordHash: string, propertyIds: Types.ObjectId[]) {
  const cityKey  = faker.helpers.arrayElement(Object.keys(CITIES));
  const cityData = CITIES[cityKey];
  const coords   = randCoords(cityData);
  const role     = faker.helpers.weightedArrayElement([
    { weight: 55, value: UserRole.REGISTERED_USER },
    { weight: 15, value: UserRole.LANDLORD },
    { weight: 10, value: UserRole.HOST },
    { weight: 10, value: UserRole.AGENT },
    { weight: 8,  value: UserRole.STUDENT },
    { weight: 2,  value: UserRole.GUEST },
  ]);

  const name  = randName();
  const email = `${name.toLowerCase().replace(/[^a-z]/g, '.')}${index}@example.com`;
  const phone = randPhone(cityData.country);

  // Saved favorites — pick 0–5 random property IDs
  const favorites = faker.helpers.arrayElements(propertyIds, faker.number.int({ min: 0, max: 5 }));

  // Recently viewed — up to 10
  const recentlyViewed = faker.helpers.arrayElements(propertyIds, faker.number.int({ min: 0, max: 10 }))
    .map(pid => ({ propertyId: pid, viewedAt: faker.date.recent({ days: 30 }) }));

  // Search history — 2–6 realistic searches
  const searchHistory = Array.from({ length: faker.number.int({ min: 2, max: 6 }) }, () => ({
    query: faker.helpers.arrayElement([
      `appartement à louer ${cityKey}`,
      `maison ${cityKey}`,
      `studio étudiant ${cityKey}`,
      `villa ${faker.helpers.arrayElement(cityData.neighborhoods)}`,
      `terrain à vendre ${cityKey}`,
    ]),
    filters: {
      city: cityKey,
      listingType: faker.helpers.arrayElement(['rent', 'sale', 'short_term']),
      maxPrice: faker.number.int({ min: 100_000, max: 500_000 }),
      type: faker.helpers.arrayElement(['apartment', 'house', 'studio']),
    },
    location: { type: 'Point' as const, coordinates: coords },
    timestamp: faker.date.recent({ days: 60 }),
    resultsCount: faker.number.int({ min: 0, max: 45 }),
  }));

  // Preferences
  const preferences = {
    cities: [cityKey, faker.helpers.arrayElement(Object.keys(CITIES))],
    propertyTypes: faker.helpers.arrayElements(['apartment', 'house', 'villa', 'studio'], faker.number.int({ min: 1, max: 3 })),
    minPrice: faker.number.int({ min: 30_000, max: 100_000 }),
    maxPrice: faker.number.int({ min: 150_000, max: 600_000 }),
    currency: 'XAF',
    bedrooms: [faker.number.int({ min: 1, max: 4 })],
    preferredLocation: { type: 'Point' as const, coordinates: coords },
  };

  // Role-specific sub-profiles
  let hostProfile: any = null;
  let studentProfile: any = null;
  let agentFields: any = {};

  if (role === UserRole.HOST) {
    hostProfile = {
      verificationStatus: faker.helpers.arrayElement([
        HostVerificationStatus.VERIFIED,
        HostVerificationStatus.VERIFIED,
        HostVerificationStatus.PENDING,
        HostVerificationStatus.UNVERIFIED,
      ]),
      isSuperhost: faker.datatype.boolean({ probability: 0.2 }),
      instantBookEnabled: faker.datatype.boolean({ probability: 0.5 }),
      minNightsDefault: faker.helpers.arrayElement([1, 2, 3, 7]),
      maxNightsDefault: faker.helpers.arrayElement([0, 30, 90, 365]),
      advanceNoticeHours: faker.helpers.arrayElement([0, 12, 24, 48]),
      bookingWindowMonths: faker.helpers.arrayElement([3, 6, 12]),
      responseRate: faker.number.int({ min: 60, max: 100 }),
      responseTimeMinutes: faker.number.int({ min: 10, max: 360 }),
      totalEarnings: faker.number.int({ min: 0, max: 5_000_000 }),
      currentMonthEarnings: faker.number.int({ min: 0, max: 500_000 }),
      completedStays: faker.number.int({ min: 0, max: 80 }),
      commissionRate: 0.12,
      payoutAccounts: [{
        method: PayoutMethod.MOBILE_MONEY,
        accountIdentifier: phone,
        providerName: faker.helpers.arrayElement(['MTN Cameroon', 'Orange Money', 'MTN Côte d\'Ivoire', 'Wave Sénégal']),
        isDefault: true,
        currency: 'XAF',
      }],
      payoutHistory: [],
      petsAllowedDefault: faker.datatype.boolean({ probability: 0.3 }),
      smokingAllowedDefault: false,
      eventsAllowedDefault: faker.datatype.boolean({ probability: 0.2 }),
      checkInTimeDefault: faker.helpers.arrayElement(['14:00', '15:00', '16:00']),
      checkOutTimeDefault: faker.helpers.arrayElement(['10:00', '11:00', '12:00']),
      coHostIds: [],
      hostBio: `Hôte passionné basé à ${cityKey}. Je mets tout en œuvre pour que votre séjour soit inoubliable.`,
      hostLanguages: faker.helpers.arrayElements(['fr', 'en', 'wo', 'ew'], faker.number.int({ min: 1, max: 3 })),
      operatingCity: cityKey,
    };
  }

  if (role === UserRole.STUDENT) {
    const unis = UNIVERSITIES[cityKey] ?? UNIVERSITIES['Yaoundé'];
    studentProfile = {
      universityName: faker.helpers.arrayElement(unis),
      faculty: faker.helpers.arrayElement(['Sciences', 'Lettres', 'Droit', 'Médecine', 'Génie informatique', 'Économie', 'Agronomie']),
      studyLevel: faker.helpers.arrayElement(['L1', 'L2', 'L3', 'Master 1', 'Master 2']),
      enrollmentYear: faker.helpers.arrayElement([2022, 2023, 2024, 2025]),
      verificationStatus: faker.helpers.arrayElement([
        StudentVerificationStatus.UNVERIFIED,
        StudentVerificationStatus.VERIFIED,
        StudentVerificationStatus.PENDING,
      ]),
      campusCity: cityKey,
      campusLatitude: cityData.lat,
      campusLongitude: cityData.lng,
      isAmbassador: faker.datatype.boolean({ probability: 0.08 }),
      ambassadorEarnings: 0,
    };
  }

  if (role === UserRole.AGENT) {
    agentFields = {
      licenseNumber: `AGT-${faker.string.alphanumeric(8).toUpperCase()}`,
      agency: faker.helpers.arrayElement(['Cabinet Immobilier Afrique', 'Agence Habitat Plus', 'Prestige Immobilier', 'Africa Realty', 'ImmoServ']),
      bio: `Agent immobilier agréé avec ${faker.number.int({ min: 2, max: 15 })} ans d'expérience sur le marché ${cityData.country}.`,
      specialties: faker.helpers.arrayElements(['Résidentiel', 'Commercial', 'Location', 'Vente', 'Investissement'], 2),
      serviceAreas: [cityKey, ...faker.helpers.arrayElements(Object.keys(CITIES), 2)],
      propertiesListed: faker.number.int({ min: 5, max: 80 }),
      propertiesSold: faker.number.int({ min: 2, max: 40 }),
      averageRating: parseFloat(faker.number.float({ min: 3.5, max: 5.0, fractionDigits: 1 }).toFixed(1)),
      reviewCount: faker.number.int({ min: 3, max: 60 }),
    };
  }

  return {
    name,
    email,
    phoneNumber: phone,
    password: passwordHash,
    role,
    profilePicture: null,
    favorites,
    preferences,
    searchHistory,
    recentlyViewed,
    isActive: true,
    emailVerified: faker.datatype.boolean({ probability: 0.7 }),
    phoneVerified: faker.datatype.boolean({ probability: 0.6 }),
    emailNotifications: true,
    smsNotifications: faker.datatype.boolean({ probability: 0.8 }),
    pushNotifications: faker.datatype.boolean({ probability: 0.7 }),
    languages: faker.helpers.arrayElements(['Français', 'English', 'Wolof', 'Fulfuldé', 'Bamiléké'], faker.number.int({ min: 1, max: 3 })),
    city: cityKey,
    country: cityData.country,
    address: `${faker.number.int({ min: 1, max: 200 })} Rue ${faker.helpers.arrayElement(['de la Liberté', 'du Commerce', 'de l\'Indépendance', 'des Écoles', 'du Marché'])}`,
    location: { type: 'Point' as const, coordinates: coords },
    onboardingCompleted: faker.datatype.boolean({ probability: 0.65 }),
    hostProfile,
    studentProfile,
    tenants: [],
    sessions: [],
    averageRating: role === UserRole.AGENT ? undefined : 0,
    reviewCount: 0,
    ...agentFields,
  };
}

// ─── Property factory ─────────────────────────────────────────────────────────

function makeProperty(ownerIds: Types.ObjectId[], agentIds: Types.ObjectId[]) {
  const cityKey  = faker.helpers.arrayElement(Object.keys(CITIES));
  const cityData = CITIES[cityKey];
  const coords   = randCoords(cityData);

  const type        = faker.helpers.weightedArrayElement([
    { weight: 35, value: PropertyType.APARTMENT },
    { weight: 20, value: PropertyType.HOUSE },
    { weight: 10, value: PropertyType.STUDIO },
    { weight: 8,  value: PropertyType.VILLA },
    { weight: 5,  value: PropertyType.DUPLEX },
    { weight: 4,  value: PropertyType.BUNGALOW },
    { weight: 3,  value: PropertyType.COMMERCIAL },
    { weight: 3,  value: PropertyType.OFFICE },
    { weight: 3,  value: PropertyType.VACATION_RENTAL },
    { weight: 2,  value: PropertyType.GUESTHOUSE },
    { weight: 2,  value: PropertyType.HOTEL },
    { weight: 2,  value: PropertyType.LAND },
    { weight: 1,  value: PropertyType.PENTHOUSE },
    { weight: 1,  value: PropertyType.SERVICED_APARTMENT },
    { weight: 1,  value: PropertyType.HOSTEL },
  ]);

  const listingType = faker.helpers.weightedArrayElement([
    { weight: 55, value: ListingType.RENT },
    { weight: 30, value: ListingType.SALE },
    { weight: 15, value: ListingType.SHORT_TERM },
  ]);

  const price     = randPriceXAF(listingType, type);
  const ownerId   = faker.helpers.arrayElement(ownerIds);
  const hasAgent  = faker.datatype.boolean({ probability: 0.4 });
  const agentId   = hasAgent ? faker.helpers.arrayElement(agentIds) : undefined;
  const neighborhood = faker.helpers.arrayElement(cityData.neighborhoods);
  const isStudent = faker.datatype.boolean({ probability: 0.15 });

  const titleOptions = PROPERTY_TITLES[type] ?? PROPERTY_TITLES[PropertyType.APARTMENT];
  const title = `${faker.helpers.arrayElement(titleOptions)} — ${neighborhood}`;
  const pid   = new Types.ObjectId();

  const bedrooms  = [PropertyType.LAND, PropertyType.COMMERCIAL, PropertyType.OFFICE, PropertyType.SHOP, PropertyType.WAREHOUSE].includes(type) ? 0 : faker.number.int({ min: 1, max: 5 });
  const bathrooms = bedrooms > 0 ? faker.number.int({ min: 1, max: Math.min(bedrooms, 3) }) : 0;

  const approvalStatus = faker.helpers.weightedArrayElement([
    { weight: 75, value: ApprovalStatus.APPROVED },
    { weight: 15, value: ApprovalStatus.PENDING },
    { weight: 10, value: ApprovalStatus.REJECTED },
  ]);

  const isActive = approvalStatus === ApprovalStatus.APPROVED && faker.datatype.boolean({ probability: 0.9 });

  // Pick real Cloudinary images from manifest
  const imageCount = faker.number.int({ min: 3, max: 5 });
  const captions   = ['Vue principale', 'Salon', 'Chambre', 'Cuisine', 'Salle de bain', 'Terrasse', 'Extérieur', 'Vue de nuit'];

  // Map property type to manifest category
  const imgCategory: Record<string, string> = {
    [PropertyType.APARTMENT]:          'apartment',
    [PropertyType.STUDIO]:             'studio',
    [PropertyType.HOUSE]:              'house',
    [PropertyType.VILLA]:              'villa',
    [PropertyType.DUPLEX]:             'duplex',
    [PropertyType.BUNGALOW]:           'house',
    [PropertyType.PENTHOUSE]:          'villa',
    [PropertyType.LAND]:               'land',
    [PropertyType.COMMERCIAL]:         'commercial',
    [PropertyType.OFFICE]:             'commercial',
    [PropertyType.SHOP]:               'commercial',
    [PropertyType.WAREHOUSE]:          'commercial',
    [PropertyType.HOTEL]:              'shortterm',
    [PropertyType.MOTEL]:              'shortterm',
    [PropertyType.VACATION_RENTAL]:    'shortterm',
    [PropertyType.GUESTHOUSE]:         'shortterm',
    [PropertyType.HOSTEL]:             'shortterm',
    [PropertyType.RESORT]:             'shortterm',
    [PropertyType.SERVICED_APARTMENT]: 'apartment',
  };

  const category  = imgCategory[type] ?? 'exterior';
  const pickedImgs = pickImages(
    listingType === ListingType.SHORT_TERM ? 'shortterm' : category,
    imageCount,
  );

  const images = pickedImgs.map((img, i) => ({
    url:       img.url,
    publicId:  img.publicId,
    caption:   i === 0 ? 'Vue principale' : faker.helpers.arrayElement(captions.slice(1)),
    isMain:    i === 0,
  }));

  const amenities = {
    bedrooms,
    bathrooms,
    parkingSpaces: faker.number.int({ min: 0, max: 3 }),
    hasGarden: faker.datatype.boolean({ probability: 0.3 }),
    hasPool: type === PropertyType.VILLA && faker.datatype.boolean({ probability: 0.5 }),
    hasGym: faker.datatype.boolean({ probability: 0.1 }),
    hasSecurity: faker.datatype.boolean({ probability: 0.6 }),
    hasElevator: faker.datatype.boolean({ probability: 0.2 }),
    hasBalcony: faker.datatype.boolean({ probability: 0.4 }),
    hasAirConditioning: faker.datatype.boolean({ probability: 0.7 }),
    hasInternet: faker.datatype.boolean({ probability: 0.8 }),
    hasGenerator: faker.datatype.boolean({ probability: 0.65 }), // critical in Cameroon
    furnished: faker.datatype.boolean({ probability: 0.5 }),
  };

  const shortTermAmenities = listingType === ListingType.SHORT_TERM ? {
    hasWifi: faker.datatype.boolean({ probability: 0.9 }),
    hasBreakfast: faker.datatype.boolean({ probability: 0.3 }),
    hasParking: faker.datatype.boolean({ probability: 0.6 }),
    hasTv: faker.datatype.boolean({ probability: 0.8 }),
    hasKitchen: faker.datatype.boolean({ probability: 0.7 }),
    hasAirConditioning: faker.datatype.boolean({ probability: 0.8 }),
    petsAllowed: faker.datatype.boolean({ probability: 0.2 }),
    smokingAllowed: false,
    maxGuests: faker.number.int({ min: 1, max: 8 }),
    checkInTime: faker.helpers.arrayElement(['14:00', '15:00', '16:00']),
    checkOutTime: faker.helpers.arrayElement(['10:00', '11:00', '12:00']),
    selfCheckIn: faker.datatype.boolean({ probability: 0.4 }),
    wheelchairAccessible: faker.datatype.boolean({ probability: 0.1 }),
    airportTransfer: faker.datatype.boolean({ probability: 0.2 }),
  } : {};

  const studentDetails = isStudent ? {
    campusProximityMeters: faker.number.int({ min: 200, max: 5000 }),
    nearestCampus: faker.helpers.arrayElement(UNIVERSITIES[cityKey] ?? UNIVERSITIES['Yaoundé']),
    walkingMinutes: faker.number.int({ min: 3, max: 45 }),
    taxiMinutes: faker.number.int({ min: 2, max: 20 }),
    waterSource: faker.helpers.arrayElement(Object.values(WaterSource)),
    electricityBackup: faker.helpers.arrayElement(Object.values(ElectricityBackup)),
    furnishingStatus: faker.helpers.arrayElement(Object.values(FurnishingStatus)),
    genderRestriction: faker.helpers.arrayElement(Object.values(GenderRestriction)),
    curfewTime: faker.helpers.arrayElement(['21:00', '22:00', '23:00', null]),
    visitorsAllowed: faker.datatype.boolean({ probability: 0.5 }),
    cookingAllowed: faker.datatype.boolean({ probability: 0.6 }),
    hasGatedCompound: faker.datatype.boolean({ probability: 0.7 }),
    hasNightWatchman: faker.datatype.boolean({ probability: 0.5 }),
    hasFence: faker.datatype.boolean({ probability: 0.8 }),
    isStudentApproved: faker.datatype.boolean({ probability: 0.25 }),
    maxAdvanceMonths: faker.helpers.arrayElement([1, 2, 3, 6]),
    acceptsRentAdvanceScheme: faker.datatype.boolean({ probability: 0.3 }),
    availableBeds: bedrooms > 0 ? faker.number.int({ min: 1, max: bedrooms }) : 1,
    totalBeds: bedrooms > 0 ? bedrooms : 1,
    pricePerPersonMonthly: Math.round(price / Math.max(bedrooms, 1)),
  } : null;

  return {
    _id: pid,
    title,
    slug: slugify(title, pid.toString()),
    price,
    currency: 'XAF',
    type,
    listingType,
    description: `${title}. Situé dans le quartier ${neighborhood} à ${cityKey}, ce bien offre un cadre de vie agréable et bien desservi. ${faker.datatype.boolean() ? 'Proche de toutes commodités.' : 'Idéal pour famille ou professionnel.'} ${faker.datatype.boolean() ? 'Gardiennage 24h/24.' : 'Résidence sécurisée.'}`,
    city: cityKey,
    address: `${faker.number.int({ min: 1, max: 500 })} ${faker.helpers.arrayElement(['Rue', 'Avenue', 'Boulevard'])} ${faker.helpers.arrayElement(['de la Paix', 'du Peuple', 'de l\'Unité', 'des Écoles', 'Ahmadou Ahidjo', 'Léopold Sédar Senghor'])}, ${neighborhood}`,
    neighborhood,
    country: cityData.country,
    location: { type: 'Point', coordinates: coords },
    latitude: coords[1],
    longitude: coords[0],
    images,
    videos: [],
    amenities,
    shortTermAmenities,
    pricingUnit: listingType === ListingType.SHORT_TERM ? PricingUnit.NIGHTLY : PricingUnit.MONTHLY,
    minNights: listingType === ListingType.SHORT_TERM ? faker.number.int({ min: 1, max: 3 }) : 1,
    maxNights: listingType === ListingType.SHORT_TERM ? faker.number.int({ min: 30, max: 365 }) : 365,
    cleaningFee: listingType === ListingType.SHORT_TERM ? faker.number.int({ min: 2000, max: 15000 }) : 0,
    serviceFee: 0,
    weeklyDiscountPercent: faker.number.int({ min: 0, max: 15 }),
    monthlyDiscountPercent: faker.number.int({ min: 0, max: 20 }),
    unavailableDates: [],
    isInstantBookable: faker.datatype.boolean({ probability: 0.4 }),
    cancellationPolicy: faker.helpers.arrayElement(Object.values(CancellationPolicy)),
    advanceNoticeDays: faker.number.int({ min: 0, max: 7 }),
    bookingWindowDays: faker.helpers.arrayElement([90, 180, 365]),
    isStudentFriendly: isStudent,
    studentDetails,
    ownerId,
    agentId,
    area: [PropertyType.LAND, PropertyType.COMMERCIAL, PropertyType.WAREHOUSE].includes(type)
      ? faker.number.int({ min: 100, max: 5000 })
      : faker.number.int({ min: 25, max: 450 }),
    yearBuilt: faker.number.int({ min: 1990, max: 2024 }),
    pricePerSqm: Math.round(price / faker.number.int({ min: 30, max: 300 })),
    depositAmount: listingType === ListingType.RENT ? price * faker.helpers.arrayElement([1, 2, 3]) : undefined,
    contactPhone: faker.helpers.arrayElement(['+237 6', '+225 07', '+221 77']) + faker.string.numeric(8),
    contactEmail: `contact.${pid.toString().slice(-5)}@horohouse.com`,
    keywords: [cityKey, neighborhood, type, listingType, cityData.country.toLowerCase()],
    nearbyAmenities: faker.helpers.arrayElements(NEARBY, faker.number.int({ min: 2, max: 6 })),
    transportAccess: faker.helpers.arrayElements(TRANSPORT, faker.number.int({ min: 1, max: 4 })),
    viewsCount: faker.number.int({ min: 0, max: 1200 }),
    inquiriesCount: faker.number.int({ min: 0, max: 80 }),
    favoritesCount: faker.number.int({ min: 0, max: 120 }),
    sharesCount: faker.number.int({ min: 0, max: 40 }),
    availability: faker.helpers.weightedArrayElement([
      { weight: 70, value: PropertyStatus.ACTIVE },
      { weight: 15, value: PropertyStatus.RENTED },
      { weight: 10, value: PropertyStatus.PENDING },
      { weight: 5,  value: PropertyStatus.SOLD },
    ]),
    approvalStatus,
    isVerified: approvalStatus === ApprovalStatus.APPROVED && faker.datatype.boolean({ probability: 0.6 }),
    isFeatured: faker.datatype.boolean({ probability: 0.1 }),
    isActive,
    averageRating: parseFloat(faker.number.float({ min: 2.5, max: 5.0, fractionDigits: 1 }).toFixed(1)),
    reviewCount: faker.number.int({ min: 0, max: 45 }),
    virtualTourUrl: faker.datatype.boolean({ probability: 0.1 }) ? `https://kuula.co/share/horohouse/${pid.toString().slice(-8)}` : undefined,
    tourType: 'none',
    tourViews: 0,
    tourThumbnail: null,
    starRating: type === PropertyType.HOTEL ? faker.number.int({ min: 2, max: 5 }) : undefined,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌍 HoroHouse Seed Script');
  console.log(`   URI     : ${MONGO_URI}`);
  console.log(`   Users   : ${SEED_USERS}`);
  console.log(`   Props   : ${SEED_PROPS}`);
  console.log(`   Clear   : ${CLEAR_FIRST}`);
  console.log('');

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const UserModel     = mongoose.model('User',     UserSchema);
  const PropertyModel = mongoose.model('Property', PropertySchema);

  if (CLEAR_FIRST) {
    await UserModel.deleteMany({});
    await PropertyModel.deleteMany({});
    console.log('🗑️  Collections cleared');
  }

  // ── 1. Hash shared password once ─────────────────────────────────────────
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  console.log(`🔑 Password hash ready`);

  // ── 2. Seed properties first with placeholder ownerIds ───────────────────
  //    We'll generate real ownerIds after users are created.
  //    Strategy: create placeholder IDs first, insert properties, then users.

  const placeholderOwnerIds = Array.from({ length: 30 }, () => new Types.ObjectId());
  const placeholderAgentIds = Array.from({ length: 10 }, () => new Types.ObjectId());

  console.log(`\n🏠 Generating ${SEED_PROPS} properties...`);
  const propertyDocs = Array.from({ length: SEED_PROPS }, () =>
    makeProperty(placeholderOwnerIds, placeholderAgentIds)
  );
  const insertedProps = await PropertyModel.insertMany(propertyDocs, { ordered: false });
  const propertyIds   = insertedProps.map(p => p._id as Types.ObjectId);
  console.log(`   ✅ ${insertedProps.length} properties inserted`);

  // ── 3. Seed admin user (fixed credentials) ───────────────────────────────
  const adminDoc = {
    name: 'Admin HoroHouse',
    email: 'admin@horohouse.com',
    phoneNumber: '+237 600 000 000',
    password: passwordHash,
    role: UserRole.ADMIN,
    profilePicture: null,
    favorites: [],
    preferences: {},
    searchHistory: [],
    recentlyViewed: [],
    isActive: true,
    emailVerified: true,
    phoneVerified: true,
    emailNotifications: true,
    smsNotifications: true,
    pushNotifications: true,
    languages: ['Français', 'English'],
    city: 'Yaoundé',
    country: 'Cameroon',
    onboardingCompleted: true,
    hostProfile: null,
    studentProfile: null,
    tenants: [],
    sessions: [],
  };
  await UserModel.findOneAndUpdate(
    { email: 'admin@horohouse.com' },
    { $setOnInsert: adminDoc },
    { upsert: true, new: true }
  );
  console.log(`\n🔐 Admin user ready — admin@horohouse.com / ${SEED_PASSWORD}`);

  // ── 4. Seed regular users ─────────────────────────────────────────────────
  console.log(`\n👤 Generating ${SEED_USERS} users...`);
  const userDocs = await Promise.all(
    Array.from({ length: SEED_USERS }, (_, i) => makeUser(i, passwordHash, propertyIds))
  );
  const insertedUsers = await UserModel.insertMany(userDocs, { ordered: false });
  console.log(`   ✅ ${insertedUsers.length} regular users inserted`);

  // ── 4. Print role breakdown ───────────────────────────────────────────────
  const roleCounts = insertedUsers.reduce((acc, u: any) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\n📊 Role breakdown:');
  Object.entries(roleCounts).forEach(([role, count]) => {
    console.log(`   ${role.padEnd(20)} ${count}`);
  });

  // ── 5. Print city breakdown for properties ────────────────────────────────
  const cityCounts = propertyDocs.reduce((acc, p: any) => {
    acc[p.city] = (acc[p.city] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\n🗺️  Property city breakdown:');
  Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).forEach(([city, count]) => {
    console.log(`   ${city.padEnd(20)} ${count}`);
  });

  console.log(`\n🎉 Seed complete!`);
  console.log(`   Login with any seeded email + password: ${SEED_PASSWORD}`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});