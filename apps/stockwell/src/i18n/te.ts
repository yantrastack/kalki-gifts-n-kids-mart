import type { Dict } from './en';

/** Telugu (తెలుగు) strings for the admin app. Typed against Dict. */
export const te: Dict = {
  lang: { label: 'భాష', english: 'English', telugu: 'తెలుగు' },

  nav: {
    sectionWorkspace: 'వర్క్‌స్పేస్',
    sectionCatalog: 'కేటలాగ్',
    sectionSales: 'అమ్మకాలు',
    sectionOperations: 'కార్యకలాపాలు',
    sectionAdmin: 'అడ్మిన్',

    dashboard: 'డాష్‌బోర్డ్',
    analytics: 'విశ్లేషణలు',
    engagement: 'ఎంగేజ్‌మెంట్',
    products: 'ఉత్పత్తులు',
    inventory: 'ఇన్వెంటరీ',
    warehouses: 'గిడ్డంగులు',
    pos: 'రిజిస్టర్ (POS)',
    invoices: 'ఇన్‌వాయిస్‌లు',
    customers: 'వినియోగదారులు',
    returns: 'రిటర్న్‌లు',
    orders: 'ఆర్డర్‌లు',
    suppliers: 'సరఫరాదారులు',
    reports: 'నివేదికలు',
    barcode: 'బార్‌కోడ్',
    staff: 'సిబ్బంది & పాత్రలు',
    settings: 'సెట్టింగ్‌లు',

    seats: '{plan} · {seats} సీట్లు',
  },

  topbar: {
    searchPlaceholder: 'ఉత్పత్తులు, ఆర్డర్‌లు, సరఫరాదారులను వెతకండి…',
    scan: 'బార్‌కోడ్ స్కాన్ చేయండి',
    notifications: 'నోటిఫికేషన్‌లు',
    lightMode: 'లైట్ మోడ్',
    darkMode: 'డార్క్ మోడ్',
    menu: 'మెను',
    account: 'ఖాతా',
    workspaceSettings: 'వర్క్‌స్పేస్ సెట్టింగ్‌లు',
    signOut: 'సైన్ అవుట్',
  },

  auth: {
    signInTitle: 'మీ వర్క్‌స్పేస్‌కు సైన్ ఇన్ చేయండి',
    registerTitle: 'మీ ఖాతాను సృష్టించండి',
    signInSub: 'తిరిగి స్వాగతం. కొనసాగించడానికి మీ వివరాలను నమోదు చేయండి.',
    registerSub: 'కొత్త సిబ్బంది ఖాతాతో ప్రారంభించండి.',
    fullName: 'పూర్తి పేరు',
    fullNamePlaceholder: 'పేరు నమోదు చేయండి',
    email: 'ఇమెయిల్',
    password: 'పాస్‌వర్డ్',
    signIn: 'సైన్ ఇన్',
    createAccount: 'ఖాతా సృష్టించండి',
    pleaseWait: 'దయచేసి వేచి ఉండండి…',
    demoLogin: 'డెమో లాగిన్ —',
    newHere: 'ఇక్కడ కొత్తవారా?',
    createOne: 'ఖాతాను సృష్టించండి',
    haveAccount: 'ఇప్పటికే ఖాతా ఉందా?',
    loading: 'లోడ్ అవుతోంది…',
    genericError: 'ఏదో తప్పు జరిగింది',
  },
};
