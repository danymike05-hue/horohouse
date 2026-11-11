"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const faker_1 = require("@faker-js/faker");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const user_schema_1 = require("./src/users/schemas/user.schema");
const property_schema_1 = require("./src/properties/schemas/property.schema");
const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/horohouse';
const SEED_USERS = parseInt(process.env.SEED_USERS ?? '150', 10);
const SEED_PROPS = parseInt(process.env.SEED_PROPERTIES ?? '300', 10);
const CLEAR_FIRST = process.env.CLEAR_FIRST === 'true';
const SEED_PASSWORD = 'HoroHouse2026!';
const CITIES = {
    Douala: { lat: 4.0511, lng: 9.7679, country: 'Cameroon', neighborhoods: ['Akwa', 'Bonanjo', 'Bonapriso', 'Bali', 'Makepe', 'Logpom', 'Kotto', 'Deido'] },
    Yaoundé: { lat: 3.8480, lng: 11.5021, country: 'Cameroon', neighborhoods: ['Bastos', 'Mvan', 'Essos', 'Ngousso', 'Omnisport', 'Elig-Essono', 'Mimboman'] },
    Bafoussam: { lat: 5.4764, lng: 10.4175, country: 'Cameroon', neighborhoods: ['Banengo', 'Kamkop', 'Djeleng', 'Tamdja'] },
    Kribi: { lat: 2.9392, lng: 9.9073, country: 'Cameroon', neighborhoods: ['Centre-ville', 'Mpalla', 'Talla', 'Ngoye'] },
    Abidjan: { lat: 5.3599, lng: -4.0082, country: "Côte d'Ivoire", neighborhoods: ['Cocody', 'Plateau', 'Marcory', 'Yopougon', 'Treichville', 'Adjamé', 'Koumassi'] },
    Dakar: { lat: 14.7167, lng: -17.4677, country: 'Senegal', neighborhoods: ['Plateau', 'Mermoz', 'Almadies', 'Ouakam', 'Liberté', 'Parcelles Assainies'] },
    'Saint-Louis': { lat: 16.0326, lng: -16.4818, country: 'Senegal', neighborhoods: ['Île Saint-Louis', 'Sor', 'Guet Ndar', 'Ndar Toute'] },
};
const UNIVERSITIES = {
    Douala: ['Université de Douala', 'IUT de Douala', 'ESSEC Douala'],
    Yaoundé: ["Université de Yaoundé I", "Université de Yaoundé II", 'IRIC', 'ENSP Yaoundé'],
    Bafoussam: ['Université de Dschang — campus Bafoussam'],
    Abidjan: ["Université Félix Houphouët-Boigny", 'INPHB', 'Université Abobo-Adjamé'],
    Dakar: ['Université Cheikh Anta Diop', 'ISM Dakar', 'UCAO Dakar'],
};
const FRANCOPHONE_NAMES = {
    first: ['Jean-Baptiste', 'Marie-Claire', 'Aminata', 'Fatoumata', 'Rodrigue', 'Cédric', 'Nadège', 'Blaise', 'Épiphanie', 'Ornella', 'Alioune', 'Mamadou', 'Isabelle', 'Patrick', 'Gisèle', 'Ernest', 'Sandrine', 'Hervé', 'Christiane', 'Étienne', 'Astride', 'Narcisse', 'Laure', 'Olivier', 'Véronique'],
    last: ['Mbeki', 'Diallo', 'Nkomo', 'Kouassi', 'Njoya', 'Traore', 'Ondoa', 'Sow', 'Biyong', 'Coulibaly', 'Atangana', 'Bah', 'Fouda', 'Keita', 'Mvondo', 'Camara', 'Eto\'o', 'Ndiaye', 'Bello', 'Diouf', 'Essomba', 'Sy', 'Manga', 'Barry', 'Owona'],
};
const PROPERTY_TITLES = {
    [property_schema_1.PropertyType.APARTMENT]: ['Bel appartement moderne', 'Appartement lumineux avec vue', 'Grand appartement bien situé', 'Appartement standing au centre-ville'],
    [property_schema_1.PropertyType.HOUSE]: ['Belle villa familiale', 'Maison individuelle avec jardin', 'Grande maison en duplex', 'Maison spacieuse quartier calme'],
    [property_schema_1.PropertyType.VILLA]: ['Villa de standing avec piscine', 'Villa luxueuse résidence fermée', 'Splendide villa contemporaine'],
    [property_schema_1.PropertyType.STUDIO]: ['Studio meublé tout confort', 'Studio fonctionnel bien placé', 'Studio cosy idéal étudiant'],
    [property_schema_1.PropertyType.DUPLEX]: ['Duplex moderne avec terrasse', 'Grand duplex vue dégagée'],
    [property_schema_1.PropertyType.BUNGALOW]: ['Bungalow de charme', 'Bungalow vue mer'],
    [property_schema_1.PropertyType.PENTHOUSE]: ['Penthouse luxe dernier étage', 'Penthouse panoramique'],
    [property_schema_1.PropertyType.LAND]: ['Terrain titré constructible', 'Parcelle viabilisée'],
    [property_schema_1.PropertyType.COMMERCIAL]: ['Local commercial bien situé', 'Espace commercial en activité'],
    [property_schema_1.PropertyType.OFFICE]: ['Bureau moderne open space', 'Plateau de bureaux climatisé'],
    [property_schema_1.PropertyType.SHOP]: ['Boutique en rez-de-chaussée', 'Local à usage commercial'],
    [property_schema_1.PropertyType.WAREHOUSE]: ['Entrepôt sécurisé', 'Magasin de stockage'],
    [property_schema_1.PropertyType.HOTEL]: ['Hôtel boutique en centre-ville', 'Résidence hôtelière'],
    [property_schema_1.PropertyType.MOTEL]: ['Motel bien équipé'],
    [property_schema_1.PropertyType.VACATION_RENTAL]: ['Location vacances bord de mer', 'Villa vacances tout confort'],
    [property_schema_1.PropertyType.GUESTHOUSE]: ['Maison d\'hôtes chaleureuse', 'Guest house tranquille'],
    [property_schema_1.PropertyType.HOSTEL]: ['Auberge jeunesse moderne', 'Hostel climatisé centre-ville'],
    [property_schema_1.PropertyType.RESORT]: ['Resort balnéaire haut de gamme'],
    [property_schema_1.PropertyType.SERVICED_APARTMENT]: ['Appartement hôtelier tout inclus', 'Suite résidentielle services inclus'],
};
const NEARBY = ['Marché', 'Pharmacie', 'École primaire', 'Lycée', 'Supermarché', 'Hôpital', 'Banque', 'Restaurant', 'Mosquée', 'Église', 'Station-service', 'Agence bancaire'];
const TRANSPORT = ['Taxi-moto', 'Bus', 'Taxi', 'Benskin', 'Clando', 'À pied du marché', 'Proche gare routière'];
function randName() {
    return `${faker_1.faker.helpers.arrayElement(FRANCOPHONE_NAMES.first)} ${faker_1.faker.helpers.arrayElement(FRANCOPHONE_NAMES.last)}`;
}
function randPhone(country) {
    if (country === 'Cameroon')
        return `+237 6${faker_1.faker.string.numeric(2)} ${faker_1.faker.string.numeric(3)} ${faker_1.faker.string.numeric(3)}`;
    if (country === "Côte d'Ivoire")
        return `+225 07 ${faker_1.faker.string.numeric(2)} ${faker_1.faker.string.numeric(2)} ${faker_1.faker.string.numeric(2)}`;
    return `+221 77 ${faker_1.faker.string.numeric(3)} ${faker_1.faker.string.numeric(2)} ${faker_1.faker.string.numeric(2)}`;
}
function randCoords(base, radiusKm = 5) {
    const r = radiusKm / 111;
    return [
        base.lng + (Math.random() - 0.5) * r * 2,
        base.lat + (Math.random() - 0.5) * r * 2,
    ];
}
function randPriceXAF(listingType, type) {
    if (listingType === property_schema_1.ListingType.SALE) {
        if ([property_schema_1.PropertyType.LAND].includes(type))
            return faker_1.faker.number.int({ min: 5_000_000, max: 50_000_000 });
        if ([property_schema_1.PropertyType.VILLA, property_schema_1.PropertyType.PENTHOUSE].includes(type))
            return faker_1.faker.number.int({ min: 80_000_000, max: 500_000_000 });
        return faker_1.faker.number.int({ min: 15_000_000, max: 150_000_000 });
    }
    if (listingType === property_schema_1.ListingType.SHORT_TERM) {
        return faker_1.faker.number.int({ min: 10_000, max: 150_000 });
    }
    if (type === property_schema_1.PropertyType.STUDIO)
        return faker_1.faker.number.int({ min: 30_000, max: 80_000 });
    if (type === property_schema_1.PropertyType.APARTMENT)
        return faker_1.faker.number.int({ min: 60_000, max: 250_000 });
    if (type === property_schema_1.PropertyType.VILLA)
        return faker_1.faker.number.int({ min: 250_000, max: 800_000 });
    return faker_1.faker.number.int({ min: 80_000, max: 350_000 });
}
function slugify(title, id) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + id.slice(-6);
}
const MANIFEST_PATH = path.join(__dirname, 'seed-image-manifest.json');
let _manifest = null;
function getManifest() {
    if (_manifest)
        return _manifest;
    if (fs.existsSync(MANIFEST_PATH)) {
        _manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
        console.log(`📦 Loaded image manifest (${Object.values(_manifest).flat().length} images)`);
    }
    else {
        console.warn(`⚠️  No manifest found at ${MANIFEST_PATH}. Run seed-images.ts first for real photos.`);
        _manifest = {};
    }
    return _manifest;
}
function pickImages(category, count, fallbackCategory = 'exterior') {
    const manifest = getManifest();
    const pool = manifest[category]?.length
        ? manifest[category]
        : manifest[fallbackCategory] ?? [];
    if (pool.length === 0) {
        return Array.from({ length: count }, (_, i) => ({
            url: `https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200&q=80&auto=format&fit=crop`,
            publicId: `seed/fallback/prop_${Date.now()}_${i}`,
        }));
    }
    return Array.from({ length: count }, () => faker_1.faker.helpers.arrayElement(pool));
}
async function makeUser(index, passwordHash, propertyIds) {
    const cityKey = faker_1.faker.helpers.arrayElement(Object.keys(CITIES));
    const cityData = CITIES[cityKey];
    const coords = randCoords(cityData);
    const role = faker_1.faker.helpers.weightedArrayElement([
        { weight: 55, value: user_schema_1.UserRole.REGISTERED_USER },
        { weight: 15, value: user_schema_1.UserRole.LANDLORD },
        { weight: 10, value: user_schema_1.UserRole.HOST },
        { weight: 10, value: user_schema_1.UserRole.AGENT },
        { weight: 8, value: user_schema_1.UserRole.STUDENT },
        { weight: 2, value: user_schema_1.UserRole.GUEST },
    ]);
    const name = randName();
    const email = `${name.toLowerCase().replace(/[^a-z]/g, '.')}${index}@example.com`;
    const phone = randPhone(cityData.country);
    const favorites = faker_1.faker.helpers.arrayElements(propertyIds, faker_1.faker.number.int({ min: 0, max: 5 }));
    const recentlyViewed = faker_1.faker.helpers.arrayElements(propertyIds, faker_1.faker.number.int({ min: 0, max: 10 }))
        .map(pid => ({ propertyId: pid, viewedAt: faker_1.faker.date.recent({ days: 30 }) }));
    const searchHistory = Array.from({ length: faker_1.faker.number.int({ min: 2, max: 6 }) }, () => ({
        query: faker_1.faker.helpers.arrayElement([
            `appartement à louer ${cityKey}`,
            `maison ${cityKey}`,
            `studio étudiant ${cityKey}`,
            `villa ${faker_1.faker.helpers.arrayElement(cityData.neighborhoods)}`,
            `terrain à vendre ${cityKey}`,
        ]),
        filters: {
            city: cityKey,
            listingType: faker_1.faker.helpers.arrayElement(['rent', 'sale', 'short_term']),
            maxPrice: faker_1.faker.number.int({ min: 100_000, max: 500_000 }),
            type: faker_1.faker.helpers.arrayElement(['apartment', 'house', 'studio']),
        },
        location: { type: 'Point', coordinates: coords },
        timestamp: faker_1.faker.date.recent({ days: 60 }),
        resultsCount: faker_1.faker.number.int({ min: 0, max: 45 }),
    }));
    const preferences = {
        cities: [cityKey, faker_1.faker.helpers.arrayElement(Object.keys(CITIES))],
        propertyTypes: faker_1.faker.helpers.arrayElements(['apartment', 'house', 'villa', 'studio'], faker_1.faker.number.int({ min: 1, max: 3 })),
        minPrice: faker_1.faker.number.int({ min: 30_000, max: 100_000 }),
        maxPrice: faker_1.faker.number.int({ min: 150_000, max: 600_000 }),
        currency: 'XAF',
        bedrooms: [faker_1.faker.number.int({ min: 1, max: 4 })],
        preferredLocation: { type: 'Point', coordinates: coords },
    };
    let hostProfile = null;
    let studentProfile = null;
    let agentFields = {};
    if (role === user_schema_1.UserRole.HOST) {
        hostProfile = {
            verificationStatus: faker_1.faker.helpers.arrayElement([
                user_schema_1.HostVerificationStatus.VERIFIED,
                user_schema_1.HostVerificationStatus.VERIFIED,
                user_schema_1.HostVerificationStatus.PENDING,
                user_schema_1.HostVerificationStatus.UNVERIFIED,
            ]),
            isSuperhost: faker_1.faker.datatype.boolean({ probability: 0.2 }),
            instantBookEnabled: faker_1.faker.datatype.boolean({ probability: 0.5 }),
            minNightsDefault: faker_1.faker.helpers.arrayElement([1, 2, 3, 7]),
            maxNightsDefault: faker_1.faker.helpers.arrayElement([0, 30, 90, 365]),
            advanceNoticeHours: faker_1.faker.helpers.arrayElement([0, 12, 24, 48]),
            bookingWindowMonths: faker_1.faker.helpers.arrayElement([3, 6, 12]),
            responseRate: faker_1.faker.number.int({ min: 60, max: 100 }),
            responseTimeMinutes: faker_1.faker.number.int({ min: 10, max: 360 }),
            totalEarnings: faker_1.faker.number.int({ min: 0, max: 5_000_000 }),
            currentMonthEarnings: faker_1.faker.number.int({ min: 0, max: 500_000 }),
            completedStays: faker_1.faker.number.int({ min: 0, max: 80 }),
            commissionRate: 0.12,
            payoutAccounts: [{
                    method: user_schema_1.PayoutMethod.MOBILE_MONEY,
                    accountIdentifier: phone,
                    providerName: faker_1.faker.helpers.arrayElement(['MTN Cameroon', 'Orange Money', 'MTN Côte d\'Ivoire', 'Wave Sénégal']),
                    isDefault: true,
                    currency: 'XAF',
                }],
            payoutHistory: [],
            petsAllowedDefault: faker_1.faker.datatype.boolean({ probability: 0.3 }),
            smokingAllowedDefault: false,
            eventsAllowedDefault: faker_1.faker.datatype.boolean({ probability: 0.2 }),
            checkInTimeDefault: faker_1.faker.helpers.arrayElement(['14:00', '15:00', '16:00']),
            checkOutTimeDefault: faker_1.faker.helpers.arrayElement(['10:00', '11:00', '12:00']),
            coHostIds: [],
            hostBio: `Hôte passionné basé à ${cityKey}. Je mets tout en œuvre pour que votre séjour soit inoubliable.`,
            hostLanguages: faker_1.faker.helpers.arrayElements(['fr', 'en', 'wo', 'ew'], faker_1.faker.number.int({ min: 1, max: 3 })),
            operatingCity: cityKey,
        };
    }
    if (role === user_schema_1.UserRole.STUDENT) {
        const unis = UNIVERSITIES[cityKey] ?? UNIVERSITIES['Yaoundé'];
        studentProfile = {
            universityName: faker_1.faker.helpers.arrayElement(unis),
            faculty: faker_1.faker.helpers.arrayElement(['Sciences', 'Lettres', 'Droit', 'Médecine', 'Génie informatique', 'Économie', 'Agronomie']),
            studyLevel: faker_1.faker.helpers.arrayElement(['L1', 'L2', 'L3', 'Master 1', 'Master 2']),
            enrollmentYear: faker_1.faker.helpers.arrayElement([2022, 2023, 2024, 2025]),
            verificationStatus: faker_1.faker.helpers.arrayElement([
                user_schema_1.StudentVerificationStatus.UNVERIFIED,
                user_schema_1.StudentVerificationStatus.VERIFIED,
                user_schema_1.StudentVerificationStatus.PENDING,
            ]),
            campusCity: cityKey,
            campusLatitude: cityData.lat,
            campusLongitude: cityData.lng,
            isAmbassador: faker_1.faker.datatype.boolean({ probability: 0.08 }),
            ambassadorEarnings: 0,
        };
    }
    if (role === user_schema_1.UserRole.AGENT) {
        agentFields = {
            licenseNumber: `AGT-${faker_1.faker.string.alphanumeric(8).toUpperCase()}`,
            agency: faker_1.faker.helpers.arrayElement(['Cabinet Immobilier Afrique', 'Agence Habitat Plus', 'Prestige Immobilier', 'Africa Realty', 'ImmoServ']),
            bio: `Agent immobilier agréé avec ${faker_1.faker.number.int({ min: 2, max: 15 })} ans d'expérience sur le marché ${cityData.country}.`,
            specialties: faker_1.faker.helpers.arrayElements(['Résidentiel', 'Commercial', 'Location', 'Vente', 'Investissement'], 2),
            serviceAreas: [cityKey, ...faker_1.faker.helpers.arrayElements(Object.keys(CITIES), 2)],
            propertiesListed: faker_1.faker.number.int({ min: 5, max: 80 }),
            propertiesSold: faker_1.faker.number.int({ min: 2, max: 40 }),
            averageRating: parseFloat(faker_1.faker.number.float({ min: 3.5, max: 5.0, fractionDigits: 1 }).toFixed(1)),
            reviewCount: faker_1.faker.number.int({ min: 3, max: 60 }),
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
        emailVerified: faker_1.faker.datatype.boolean({ probability: 0.7 }),
        phoneVerified: faker_1.faker.datatype.boolean({ probability: 0.6 }),
        emailNotifications: true,
        smsNotifications: faker_1.faker.datatype.boolean({ probability: 0.8 }),
        pushNotifications: faker_1.faker.datatype.boolean({ probability: 0.7 }),
        languages: faker_1.faker.helpers.arrayElements(['Français', 'English', 'Wolof', 'Fulfuldé', 'Bamiléké'], faker_1.faker.number.int({ min: 1, max: 3 })),
        city: cityKey,
        country: cityData.country,
        address: `${faker_1.faker.number.int({ min: 1, max: 200 })} Rue ${faker_1.faker.helpers.arrayElement(['de la Liberté', 'du Commerce', 'de l\'Indépendance', 'des Écoles', 'du Marché'])}`,
        location: { type: 'Point', coordinates: coords },
        onboardingCompleted: faker_1.faker.datatype.boolean({ probability: 0.65 }),
        hostProfile,
        studentProfile,
        tenants: [],
        sessions: [],
        averageRating: role === user_schema_1.UserRole.AGENT ? undefined : 0,
        reviewCount: 0,
        ...agentFields,
    };
}
function makeProperty(ownerIds, agentIds) {
    const cityKey = faker_1.faker.helpers.arrayElement(Object.keys(CITIES));
    const cityData = CITIES[cityKey];
    const coords = randCoords(cityData);
    const type = faker_1.faker.helpers.weightedArrayElement([
        { weight: 35, value: property_schema_1.PropertyType.APARTMENT },
        { weight: 20, value: property_schema_1.PropertyType.HOUSE },
        { weight: 10, value: property_schema_1.PropertyType.STUDIO },
        { weight: 8, value: property_schema_1.PropertyType.VILLA },
        { weight: 5, value: property_schema_1.PropertyType.DUPLEX },
        { weight: 4, value: property_schema_1.PropertyType.BUNGALOW },
        { weight: 3, value: property_schema_1.PropertyType.COMMERCIAL },
        { weight: 3, value: property_schema_1.PropertyType.OFFICE },
        { weight: 3, value: property_schema_1.PropertyType.VACATION_RENTAL },
        { weight: 2, value: property_schema_1.PropertyType.GUESTHOUSE },
        { weight: 2, value: property_schema_1.PropertyType.HOTEL },
        { weight: 2, value: property_schema_1.PropertyType.LAND },
        { weight: 1, value: property_schema_1.PropertyType.PENTHOUSE },
        { weight: 1, value: property_schema_1.PropertyType.SERVICED_APARTMENT },
        { weight: 1, value: property_schema_1.PropertyType.HOSTEL },
    ]);
    const listingType = faker_1.faker.helpers.weightedArrayElement([
        { weight: 55, value: property_schema_1.ListingType.RENT },
        { weight: 30, value: property_schema_1.ListingType.SALE },
        { weight: 15, value: property_schema_1.ListingType.SHORT_TERM },
    ]);
    const price = randPriceXAF(listingType, type);
    const ownerId = faker_1.faker.helpers.arrayElement(ownerIds);
    const hasAgent = faker_1.faker.datatype.boolean({ probability: 0.4 });
    const agentId = hasAgent ? faker_1.faker.helpers.arrayElement(agentIds) : undefined;
    const neighborhood = faker_1.faker.helpers.arrayElement(cityData.neighborhoods);
    const isStudent = faker_1.faker.datatype.boolean({ probability: 0.15 });
    const titleOptions = PROPERTY_TITLES[type] ?? PROPERTY_TITLES[property_schema_1.PropertyType.APARTMENT];
    const title = `${faker_1.faker.helpers.arrayElement(titleOptions)} — ${neighborhood}`;
    const pid = new mongoose_1.Types.ObjectId();
    const bedrooms = [property_schema_1.PropertyType.LAND, property_schema_1.PropertyType.COMMERCIAL, property_schema_1.PropertyType.OFFICE, property_schema_1.PropertyType.SHOP, property_schema_1.PropertyType.WAREHOUSE].includes(type) ? 0 : faker_1.faker.number.int({ min: 1, max: 5 });
    const bathrooms = bedrooms > 0 ? faker_1.faker.number.int({ min: 1, max: Math.min(bedrooms, 3) }) : 0;
    const approvalStatus = faker_1.faker.helpers.weightedArrayElement([
        { weight: 75, value: property_schema_1.ApprovalStatus.APPROVED },
        { weight: 15, value: property_schema_1.ApprovalStatus.PENDING },
        { weight: 10, value: property_schema_1.ApprovalStatus.REJECTED },
    ]);
    const isActive = approvalStatus === property_schema_1.ApprovalStatus.APPROVED && faker_1.faker.datatype.boolean({ probability: 0.9 });
    const imageCount = faker_1.faker.number.int({ min: 3, max: 5 });
    const captions = ['Vue principale', 'Salon', 'Chambre', 'Cuisine', 'Salle de bain', 'Terrasse', 'Extérieur', 'Vue de nuit'];
    const imgCategory = {
        [property_schema_1.PropertyType.APARTMENT]: 'apartment',
        [property_schema_1.PropertyType.STUDIO]: 'studio',
        [property_schema_1.PropertyType.HOUSE]: 'house',
        [property_schema_1.PropertyType.VILLA]: 'villa',
        [property_schema_1.PropertyType.DUPLEX]: 'duplex',
        [property_schema_1.PropertyType.BUNGALOW]: 'house',
        [property_schema_1.PropertyType.PENTHOUSE]: 'villa',
        [property_schema_1.PropertyType.LAND]: 'land',
        [property_schema_1.PropertyType.COMMERCIAL]: 'commercial',
        [property_schema_1.PropertyType.OFFICE]: 'commercial',
        [property_schema_1.PropertyType.SHOP]: 'commercial',
        [property_schema_1.PropertyType.WAREHOUSE]: 'commercial',
        [property_schema_1.PropertyType.HOTEL]: 'shortterm',
        [property_schema_1.PropertyType.MOTEL]: 'shortterm',
        [property_schema_1.PropertyType.VACATION_RENTAL]: 'shortterm',
        [property_schema_1.PropertyType.GUESTHOUSE]: 'shortterm',
        [property_schema_1.PropertyType.HOSTEL]: 'shortterm',
        [property_schema_1.PropertyType.RESORT]: 'shortterm',
        [property_schema_1.PropertyType.SERVICED_APARTMENT]: 'apartment',
    };
    const category = imgCategory[type] ?? 'exterior';
    const pickedImgs = pickImages(listingType === property_schema_1.ListingType.SHORT_TERM ? 'shortterm' : category, imageCount);
    const images = pickedImgs.map((img, i) => ({
        url: img.url,
        publicId: img.publicId,
        caption: i === 0 ? 'Vue principale' : faker_1.faker.helpers.arrayElement(captions.slice(1)),
        isMain: i === 0,
    }));
    const amenities = {
        bedrooms,
        bathrooms,
        parkingSpaces: faker_1.faker.number.int({ min: 0, max: 3 }),
        hasGarden: faker_1.faker.datatype.boolean({ probability: 0.3 }),
        hasPool: type === property_schema_1.PropertyType.VILLA && faker_1.faker.datatype.boolean({ probability: 0.5 }),
        hasGym: faker_1.faker.datatype.boolean({ probability: 0.1 }),
        hasSecurity: faker_1.faker.datatype.boolean({ probability: 0.6 }),
        hasElevator: faker_1.faker.datatype.boolean({ probability: 0.2 }),
        hasBalcony: faker_1.faker.datatype.boolean({ probability: 0.4 }),
        hasAirConditioning: faker_1.faker.datatype.boolean({ probability: 0.7 }),
        hasInternet: faker_1.faker.datatype.boolean({ probability: 0.8 }),
        hasGenerator: faker_1.faker.datatype.boolean({ probability: 0.65 }),
        furnished: faker_1.faker.datatype.boolean({ probability: 0.5 }),
    };
    const shortTermAmenities = listingType === property_schema_1.ListingType.SHORT_TERM ? {
        hasWifi: faker_1.faker.datatype.boolean({ probability: 0.9 }),
        hasBreakfast: faker_1.faker.datatype.boolean({ probability: 0.3 }),
        hasParking: faker_1.faker.datatype.boolean({ probability: 0.6 }),
        hasTv: faker_1.faker.datatype.boolean({ probability: 0.8 }),
        hasKitchen: faker_1.faker.datatype.boolean({ probability: 0.7 }),
        hasAirConditioning: faker_1.faker.datatype.boolean({ probability: 0.8 }),
        petsAllowed: faker_1.faker.datatype.boolean({ probability: 0.2 }),
        smokingAllowed: false,
        maxGuests: faker_1.faker.number.int({ min: 1, max: 8 }),
        checkInTime: faker_1.faker.helpers.arrayElement(['14:00', '15:00', '16:00']),
        checkOutTime: faker_1.faker.helpers.arrayElement(['10:00', '11:00', '12:00']),
        selfCheckIn: faker_1.faker.datatype.boolean({ probability: 0.4 }),
        wheelchairAccessible: faker_1.faker.datatype.boolean({ probability: 0.1 }),
        airportTransfer: faker_1.faker.datatype.boolean({ probability: 0.2 }),
    } : {};
    const studentDetails = isStudent ? {
        campusProximityMeters: faker_1.faker.number.int({ min: 200, max: 5000 }),
        nearestCampus: faker_1.faker.helpers.arrayElement(UNIVERSITIES[cityKey] ?? UNIVERSITIES['Yaoundé']),
        walkingMinutes: faker_1.faker.number.int({ min: 3, max: 45 }),
        taxiMinutes: faker_1.faker.number.int({ min: 2, max: 20 }),
        waterSource: faker_1.faker.helpers.arrayElement(Object.values(property_schema_1.WaterSource)),
        electricityBackup: faker_1.faker.helpers.arrayElement(Object.values(property_schema_1.ElectricityBackup)),
        furnishingStatus: faker_1.faker.helpers.arrayElement(Object.values(property_schema_1.FurnishingStatus)),
        genderRestriction: faker_1.faker.helpers.arrayElement(Object.values(property_schema_1.GenderRestriction)),
        curfewTime: faker_1.faker.helpers.arrayElement(['21:00', '22:00', '23:00', null]),
        visitorsAllowed: faker_1.faker.datatype.boolean({ probability: 0.5 }),
        cookingAllowed: faker_1.faker.datatype.boolean({ probability: 0.6 }),
        hasGatedCompound: faker_1.faker.datatype.boolean({ probability: 0.7 }),
        hasNightWatchman: faker_1.faker.datatype.boolean({ probability: 0.5 }),
        hasFence: faker_1.faker.datatype.boolean({ probability: 0.8 }),
        isStudentApproved: faker_1.faker.datatype.boolean({ probability: 0.25 }),
        maxAdvanceMonths: faker_1.faker.helpers.arrayElement([1, 2, 3, 6]),
        acceptsRentAdvanceScheme: faker_1.faker.datatype.boolean({ probability: 0.3 }),
        availableBeds: bedrooms > 0 ? faker_1.faker.number.int({ min: 1, max: bedrooms }) : 1,
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
        description: `${title}. Situé dans le quartier ${neighborhood} à ${cityKey}, ce bien offre un cadre de vie agréable et bien desservi. ${faker_1.faker.datatype.boolean() ? 'Proche de toutes commodités.' : 'Idéal pour famille ou professionnel.'} ${faker_1.faker.datatype.boolean() ? 'Gardiennage 24h/24.' : 'Résidence sécurisée.'}`,
        city: cityKey,
        address: `${faker_1.faker.number.int({ min: 1, max: 500 })} ${faker_1.faker.helpers.arrayElement(['Rue', 'Avenue', 'Boulevard'])} ${faker_1.faker.helpers.arrayElement(['de la Paix', 'du Peuple', 'de l\'Unité', 'des Écoles', 'Ahmadou Ahidjo', 'Léopold Sédar Senghor'])}, ${neighborhood}`,
        neighborhood,
        country: cityData.country,
        location: { type: 'Point', coordinates: coords },
        latitude: coords[1],
        longitude: coords[0],
        images,
        videos: [],
        amenities,
        shortTermAmenities,
        pricingUnit: listingType === property_schema_1.ListingType.SHORT_TERM ? property_schema_1.PricingUnit.NIGHTLY : property_schema_1.PricingUnit.MONTHLY,
        minNights: listingType === property_schema_1.ListingType.SHORT_TERM ? faker_1.faker.number.int({ min: 1, max: 3 }) : 1,
        maxNights: listingType === property_schema_1.ListingType.SHORT_TERM ? faker_1.faker.number.int({ min: 30, max: 365 }) : 365,
        cleaningFee: listingType === property_schema_1.ListingType.SHORT_TERM ? faker_1.faker.number.int({ min: 2000, max: 15000 }) : 0,
        serviceFee: 0,
        weeklyDiscountPercent: faker_1.faker.number.int({ min: 0, max: 15 }),
        monthlyDiscountPercent: faker_1.faker.number.int({ min: 0, max: 20 }),
        unavailableDates: [],
        isInstantBookable: faker_1.faker.datatype.boolean({ probability: 0.4 }),
        cancellationPolicy: faker_1.faker.helpers.arrayElement(Object.values(property_schema_1.CancellationPolicy)),
        advanceNoticeDays: faker_1.faker.number.int({ min: 0, max: 7 }),
        bookingWindowDays: faker_1.faker.helpers.arrayElement([90, 180, 365]),
        isStudentFriendly: isStudent,
        studentDetails,
        ownerId,
        agentId,
        area: [property_schema_1.PropertyType.LAND, property_schema_1.PropertyType.COMMERCIAL, property_schema_1.PropertyType.WAREHOUSE].includes(type)
            ? faker_1.faker.number.int({ min: 100, max: 5000 })
            : faker_1.faker.number.int({ min: 25, max: 450 }),
        yearBuilt: faker_1.faker.number.int({ min: 1990, max: 2024 }),
        pricePerSqm: Math.round(price / faker_1.faker.number.int({ min: 30, max: 300 })),
        depositAmount: listingType === property_schema_1.ListingType.RENT ? price * faker_1.faker.helpers.arrayElement([1, 2, 3]) : undefined,
        contactPhone: faker_1.faker.helpers.arrayElement(['+237 6', '+225 07', '+221 77']) + faker_1.faker.string.numeric(8),
        contactEmail: `contact.${pid.toString().slice(-5)}@horohouse.com`,
        keywords: [cityKey, neighborhood, type, listingType, cityData.country.toLowerCase()],
        nearbyAmenities: faker_1.faker.helpers.arrayElements(NEARBY, faker_1.faker.number.int({ min: 2, max: 6 })),
        transportAccess: faker_1.faker.helpers.arrayElements(TRANSPORT, faker_1.faker.number.int({ min: 1, max: 4 })),
        viewsCount: faker_1.faker.number.int({ min: 0, max: 1200 }),
        inquiriesCount: faker_1.faker.number.int({ min: 0, max: 80 }),
        favoritesCount: faker_1.faker.number.int({ min: 0, max: 120 }),
        sharesCount: faker_1.faker.number.int({ min: 0, max: 40 }),
        availability: faker_1.faker.helpers.weightedArrayElement([
            { weight: 70, value: property_schema_1.PropertyStatus.ACTIVE },
            { weight: 15, value: property_schema_1.PropertyStatus.RENTED },
            { weight: 10, value: property_schema_1.PropertyStatus.PENDING },
            { weight: 5, value: property_schema_1.PropertyStatus.SOLD },
        ]),
        approvalStatus,
        isVerified: approvalStatus === property_schema_1.ApprovalStatus.APPROVED && faker_1.faker.datatype.boolean({ probability: 0.6 }),
        isFeatured: faker_1.faker.datatype.boolean({ probability: 0.1 }),
        isActive,
        averageRating: parseFloat(faker_1.faker.number.float({ min: 2.5, max: 5.0, fractionDigits: 1 }).toFixed(1)),
        reviewCount: faker_1.faker.number.int({ min: 0, max: 45 }),
        virtualTourUrl: faker_1.faker.datatype.boolean({ probability: 0.1 }) ? `https://kuula.co/share/horohouse/${pid.toString().slice(-8)}` : undefined,
        tourType: 'none',
        tourViews: 0,
        tourThumbnail: null,
        starRating: type === property_schema_1.PropertyType.HOTEL ? faker_1.faker.number.int({ min: 2, max: 5 }) : undefined,
    };
}
async function main() {
    console.log('🌍 HoroHouse Seed Script');
    console.log(`   URI     : ${MONGO_URI}`);
    console.log(`   Users   : ${SEED_USERS}`);
    console.log(`   Props   : ${SEED_PROPS}`);
    console.log(`   Clear   : ${CLEAR_FIRST}`);
    console.log('');
    await mongoose_1.default.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');
    const UserModel = mongoose_1.default.model('User', user_schema_1.UserSchema);
    const PropertyModel = mongoose_1.default.model('Property', property_schema_1.PropertySchema);
    if (CLEAR_FIRST) {
        await UserModel.deleteMany({});
        await PropertyModel.deleteMany({});
        console.log('🗑️  Collections cleared');
    }
    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
    console.log(`🔑 Password hash ready`);
    const placeholderOwnerIds = Array.from({ length: 30 }, () => new mongoose_1.Types.ObjectId());
    const placeholderAgentIds = Array.from({ length: 10 }, () => new mongoose_1.Types.ObjectId());
    console.log(`\n🏠 Generating ${SEED_PROPS} properties...`);
    const propertyDocs = Array.from({ length: SEED_PROPS }, () => makeProperty(placeholderOwnerIds, placeholderAgentIds));
    const insertedProps = await PropertyModel.insertMany(propertyDocs, { ordered: false });
    const propertyIds = insertedProps.map(p => p._id);
    console.log(`   ✅ ${insertedProps.length} properties inserted`);
    const adminDoc = {
        name: 'Admin HoroHouse',
        email: 'admin@horohouse.com',
        phoneNumber: '+237 600 000 000',
        password: passwordHash,
        role: user_schema_1.UserRole.ADMIN,
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
    await UserModel.findOneAndUpdate({ email: 'admin@horohouse.com' }, { $setOnInsert: adminDoc }, { upsert: true, new: true });
    console.log(`\n🔐 Admin user ready — admin@horohouse.com / ${SEED_PASSWORD}`);
    console.log(`\n👤 Generating ${SEED_USERS} users...`);
    const userDocs = await Promise.all(Array.from({ length: SEED_USERS }, (_, i) => makeUser(i, passwordHash, propertyIds)));
    const insertedUsers = await UserModel.insertMany(userDocs, { ordered: false });
    console.log(`   ✅ ${insertedUsers.length} regular users inserted`);
    const roleCounts = insertedUsers.reduce((acc, u) => {
        acc[u.role] = (acc[u.role] ?? 0) + 1;
        return acc;
    }, {});
    console.log('\n📊 Role breakdown:');
    Object.entries(roleCounts).forEach(([role, count]) => {
        console.log(`   ${role.padEnd(20)} ${count}`);
    });
    const cityCounts = propertyDocs.reduce((acc, p) => {
        acc[p.city] = (acc[p.city] ?? 0) + 1;
        return acc;
    }, {});
    console.log('\n🗺️  Property city breakdown:');
    Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).forEach(([city, count]) => {
        console.log(`   ${city.padEnd(20)} ${count}`);
    });
    console.log(`\n🎉 Seed complete!`);
    console.log(`   Login with any seeded email + password: ${SEED_PASSWORD}`);
    await mongoose_1.default.disconnect();
}
main().catch(err => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
});
//# sourceMappingURL=seed.js.map