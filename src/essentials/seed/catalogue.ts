/**
 * Starting catalogue for Cameroon: written once when missing (by key), never overwritten,
 * so admin edits stay. Admins add or change item types and kits from the app.
 */
import type { EssCategory, KitLine, KitOption, Lang2 } from '../schemas/essentials.schema';

export const CM_MARKET = {
  country: 'CM',
  name: 'Cameroon',
  currency: 'XAF',
  commissionPct: 12,
  serviceFee: 500,
  acceptHours: 2,
  holdHours: 48,
  cities: ['Yaoundé', 'Douala', 'Buea', 'Dschang', 'Bamenda', 'Ngaoundéré', 'Bafoussam', 'Maroua', 'Bertoua', 'Ebolowa', 'Kribi', 'Limbe'],
};

type T = { key: string; en: string; fr: string; category: EssCategory; icon: string; size?: 'small' | 'medium' | 'large'; electrical?: boolean; kw?: [string[], string[]] };

const ITEMS: T[] = [
  // Bedroom
  { key: 'mattress', en: 'Mattress', fr: 'Matelas', category: 'bedroom', icon: '🛏️', size: 'large', kw: [['foam', 'bed'], ['mousse', 'lit']] },
  { key: 'mattress_cover', en: 'Mattress cover', fr: 'Protège-matelas', category: 'bedroom', icon: '🛏️' },
  { key: 'sheets', en: 'Bed sheet', fr: 'Drap', category: 'bedroom', icon: '🧺', kw: [['sheet', 'linen'], ['draps', 'linge']] },
  { key: 'pillow', en: 'Pillow', fr: 'Oreiller', category: 'bedroom', icon: '💤', kw: [['cushion'], ['coussin']] },
  { key: 'pillowcase', en: 'Pillowcase', fr: 'Taie d’oreiller', category: 'bedroom', icon: '💤' },
  { key: 'blanket', en: 'Blanket', fr: 'Couverture', category: 'bedroom', icon: '🧣', kw: [['duvet', 'cover'], ['couette', 'pagne']] },
  { key: 'mosquito_net', en: 'Mosquito net', fr: 'Moustiquaire', category: 'bedroom', icon: '🦟', kw: [['net'], ['filet']] },
  { key: 'hangers', en: 'Hangers (10)', fr: 'Cintres (10)', category: 'bedroom', icon: '🪝' },
  { key: 'curtain', en: 'Curtain', fr: 'Rideau', category: 'bedroom', icon: '🪟' },
  // Kitchen
  { key: 'pot', en: 'Pot', fr: 'Marmite', category: 'kitchen', icon: '🍲', kw: [['saucepan', 'casserole'], ['casserole']] },
  { key: 'frying_pan', en: 'Frying pan', fr: 'Poêle', category: 'kitchen', icon: '🍳' },
  { key: 'plate', en: 'Plate', fr: 'Assiette', category: 'kitchen', icon: '🍽️' },
  { key: 'bowl', en: 'Bowl', fr: 'Bol', category: 'kitchen', icon: '🥣' },
  { key: 'cutlery', en: 'Cutlery set', fr: 'Set de couverts', category: 'kitchen', icon: '🍴', kw: [['fork', 'spoon', 'knife'], ['fourchette', 'cuillère', 'couteau']] },
  { key: 'cup', en: 'Cup', fr: 'Tasse', category: 'kitchen', icon: '☕', kw: [['mug', 'glass'], ['verre', 'gobelet']] },
  { key: 'cooking_spoon', en: 'Cooking spoon', fr: 'Louche', category: 'kitchen', icon: '🥄', kw: [['ladle'], ['spatule']] },
  { key: 'jerrycan', en: 'Water jerrycan', fr: 'Bidon d’eau', category: 'kitchen', icon: '💧', kw: [['bidon', 'water'], ['jerrican', 'eau']] },
  { key: 'gas_cooker', en: 'Gas cooker', fr: 'Réchaud à gaz', category: 'kitchen', icon: '🔥', size: 'medium', kw: [['stove', 'burner'], ['cuisinière', 'gaz']] },
  { key: 'blender', en: 'Blender', fr: 'Mixeur', category: 'kitchen', icon: '🥤', electrical: true, kw: [['mixer'], ['blender']] },
  { key: 'kettle', en: 'Electric kettle', fr: 'Bouilloire électrique', category: 'kitchen', icon: '🫖', electrical: true },
  { key: 'rice_cooker', en: 'Rice cooker', fr: 'Cuiseur à riz', category: 'kitchen', icon: '🍚', electrical: true },
  // Cleaning
  { key: 'bucket', en: 'Bucket', fr: 'Seau', category: 'cleaning', icon: '🪣' },
  { key: 'basin', en: 'Basin', fr: 'Bassine', category: 'cleaning', icon: '🫧', kw: [['bowl', 'tub'], ['cuvette']] },
  { key: 'broom', en: 'Broom', fr: 'Balai', category: 'cleaning', icon: '🧹' },
  { key: 'mop', en: 'Mop', fr: 'Serpillière', category: 'cleaning', icon: '🧽', kw: [['floor cloth'], ['raclette', 'balai serpillière']] },
  { key: 'bin', en: 'Bin', fr: 'Poubelle', category: 'cleaning', icon: '🗑️', kw: [['trash', 'dustbin'], ['corbeille']] },
  { key: 'laundry_soap', en: 'Laundry soap', fr: 'Savon de lessive', category: 'cleaning', icon: '🧼', kw: [['detergent', 'washing powder'], ['lessive', 'détergent']] },
  // Furniture
  { key: 'table', en: 'Table', fr: 'Table', category: 'furniture', icon: '🪑', size: 'large', kw: [['desk'], ['bureau']] },
  { key: 'chair', en: 'Chair', fr: 'Chaise', category: 'furniture', icon: '🪑', size: 'medium', kw: [['seat', 'stool'], ['siège', 'tabouret']] },
  { key: 'shelf', en: 'Shelf', fr: 'Étagère', category: 'furniture', icon: '📚', size: 'large' },
  { key: 'wardrobe', en: 'Small wardrobe', fr: 'Petite armoire', category: 'furniture', icon: '🚪', size: 'large', kw: [['closet', 'cupboard'], ['placard', 'penderie']] },
  // Study and power
  { key: 'desk_lamp', en: 'Desk lamp', fr: 'Lampe de bureau', category: 'study', icon: '💡', electrical: true },
  { key: 'extension_lead', en: 'Extension lead (4 sockets)', fr: 'Multiprise (4 prises)', category: 'study', icon: '🔌', electrical: true, kw: [['power strip', 'socket'], ['rallonge', 'prise']] },
  { key: 'rechargeable_lamp', en: 'Rechargeable lamp', fr: 'Lampe rechargeable', category: 'study', icon: '🔦', electrical: true, kw: [['torch', 'light'], ['torche', 'lampe torche']] },
  { key: 'padlock', en: 'Padlock', fr: 'Cadenas', category: 'study', icon: '🔒', kw: [['lock'], ['serrure']] },
  { key: 'fan', en: 'Fan', fr: 'Ventilateur', category: 'study', icon: '🌀', size: 'medium', electrical: true },
  // Bathroom
  { key: 'towel', en: 'Towel', fr: 'Serviette', category: 'bathroom', icon: '🧻' },
  { key: 'shower_bucket', en: 'Shower cup', fr: 'Gobelet de douche', category: 'bathroom', icon: '🚿' },
  { key: 'mirror', en: 'Mirror', fr: 'Miroir', category: 'bathroom', icon: '🪞' },
];

export const CM_ITEM_TYPES = ITEMS.map((x, i) => ({
  key: x.key,
  name: { en: x.en, fr: x.fr } as Lang2,
  category: x.category,
  icon: x.icon,
  size: x.size ?? 'small',
  electrical: !!x.electrical,
  keywords: { en: x.kw?.[0] ?? [], fr: x.kw?.[1] ?? [] },
  order: i,
}));

const l = (itemTypeKey: string, qty = 1, removable = true): KitLine => ({ itemTypeKey, qty, removable });
const BED: KitOption = {
  key: 'bed',
  label: { en: 'Bed size', fr: 'Taille du lit' },
  values: [
    { key: 'single', label: { en: 'Single (90 cm)', fr: 'Une place (90 cm)' } },
    { key: 'double', label: { en: 'Double (140 cm)', fr: 'Deux places (140 cm)' } },
  ],
};

const SLEEP = [l('mattress_cover', 1, false), l('sheets', 2, false), l('pillow'), l('pillowcase'), l('blanket'), l('mosquito_net'), l('hangers')];
const KITCHEN = [l('pot', 1, false), l('frying_pan'), l('plate', 2, false), l('bowl', 2), l('cutlery', 1, false), l('cup', 2), l('cooking_spoon'), l('jerrycan')];
const CLEANING = [l('bucket', 1, false), l('basin'), l('broom', 1, false), l('mop'), l('bin'), l('laundry_soap')];

export const CM_KITS: { key: string; name: Lang2; description: Lang2; icon: string; lines: KitLine[]; options: KitOption[]; order: number }[] = [
  {
    key: 'sleep', icon: '🛏️', order: 0, options: [BED], lines: SLEEP,
    name: { en: 'Sleep kit', fr: 'Kit sommeil' },
    description: { en: 'Everything for your bed on the first night.', fr: 'Tout pour votre lit dès la première nuit.' },
  },
  {
    key: 'kitchen', icon: '🍳', order: 1, options: [], lines: KITCHEN,
    name: { en: 'Kitchen kit', fr: 'Kit cuisine' },
    description: { en: 'Cook and eat in your room from day one.', fr: 'Cuisinez et mangez chez vous dès le premier jour.' },
  },
  {
    key: 'study', icon: '📚', order: 2, options: [],
    lines: [l('desk_lamp', 1, false), l('extension_lead', 1, false), l('rechargeable_lamp'), l('padlock')],
    name: { en: 'Study kit', fr: 'Kit études' },
    description: { en: 'Light and power for long study nights, even during power cuts.', fr: 'Lumière et prises pour réviser, même pendant les coupures.' },
  },
  {
    key: 'cleaning', icon: '🧹', order: 3, options: [], lines: CLEANING,
    name: { en: 'Cleaning and bath kit', fr: 'Kit ménage et bain' },
    description: { en: 'Keep your room and clothes clean.', fr: 'Gardez votre chambre et vos vêtements propres.' },
  },
  {
    key: 'arrival', icon: '🎒', order: 4, options: [BED], lines: [...SLEEP, ...KITCHEN, ...CLEANING],
    name: { en: 'Arrival kit', fr: 'Kit arrivée' },
    description: { en: 'Sleep, kitchen and cleaning kits together, for less than the three apart.', fr: 'Les kits sommeil, cuisine et ménage ensemble, moins cher que séparément.' },
  },
];
