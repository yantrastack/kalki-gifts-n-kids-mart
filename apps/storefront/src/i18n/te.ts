import type { Dict } from './en';

/** Telugu (తెలుగు) strings. Typed against Dict — every key in en.ts must exist here. */
export const te: Dict = {
  lang: { label: 'భాష', english: 'English', telugu: 'తెలుగు' },

  common: {
    retry: 'మళ్లీ ప్రయత్నించండి',
    search: 'ఉత్పత్తులను వెతకండి',
    all: 'అన్నీ',
    viewCart: 'కార్ట్ చూడండి',
  },

  header: {
    cart: 'మీ కార్ట్',
    findGift: 'బహుమతిని కనుగొనండి',
  },

  error: {
    unreachable: 'దుకాణాన్ని చేరుకోలేకపోయాం. దయచేసి మళ్లీ ప్రయత్నించండి.',
  },

  home: {
    giftBannerTitle: 'సరైన బహుమతిని కనుగొనండి',
    giftBannerSub: 'పుట్టినరోజు, వివాహం, వాలెంటైన్స్ & మరిన్ని',
    noResults: 'ఉత్పత్తులు కనబడలేదు',
    noResultsSub: 'వేరే శోధన లేదా వర్గాన్ని ప్రయత్నించండి.',
  },

  card: {
    onlyLeft: 'కేవలం {count} మిగిలి ఉన్నాయి',
  },

  product: {
    inStock: 'అందుబాటులో ఉంది',
    onlyLeft: 'కేవలం {count} మిగిలి ఉన్నాయి',
    sku: 'SKU',
    pickup: 'పికప్',
    atShop: 'దుకాణంలో',
    payment: 'చెల్లింపు',
    payAtShop: 'దుకాణంలో చెల్లించండి — ఆన్‌లైన్ చెల్లింపు లేదు',
    callShop: 'దుకాణానికి కాల్ చేయండి',
    whatsapp: 'వాట్సాప్',
    addToCart: 'కార్ట్‌కు జోడించండి',
  },

  cart: {
    empty: 'మీ కార్ట్ ఖాళీగా ఉంది',
    emptySub: 'దుకాణాన్ని చూసి మీకు నచ్చినది జోడించండి.',
    browse: 'ఉత్పత్తులను చూడండి',
    items_one: '{count} వస్తువు',
    items_other: '{count} వస్తువులు',
    orderWhatsapp: 'వాట్సాప్‌లో ఆర్డర్ చేయండి',
    callToOrder: 'ఆర్డర్ కోసం కాల్ చేయండి',
    payNote: 'ఆన్‌లైన్ చెల్లింపు లేదు — దుకాణంలో తీసుకునేటప్పుడు చెల్లించండి.',
  },

  reels: {
    title: 'డిస్కవర్',
    buy: 'కొనండి',
    details: 'వివరాలు',
    addToCart: 'కార్ట్‌కు జోడించండి',
    related: 'ఇలాంటివి మరిన్ని',
  },

  gift: {
    title: 'బహుమతిని కనుగొనండి',
    intro: 'ఏమి బహుమతి ఇవ్వాలో తెలియడం లేదా? వారి గురించి కొంచెం చెప్పండి, మేము సూచిస్తాము.',
    occasionQ: 'ఏ సందర్భం?',
    recipientQ: 'ఎవరి కోసం?',
    ageQ: 'వారి వయస్సు (ఐచ్ఛికం)',
    agePlaceholder: 'ఉదా. 8',
    likesQ: 'వారికి ఏమి ఇష్టం? (ఐచ్ఛికం)',
    likesPlaceholder: 'సంగీతం, క్రీడలు, వంట…',
    typeQ: 'బహుమతి రకం (ఏదైనా ఎంచుకోండి)',
    budgetQ: 'బడ్జెట్ (ఐచ్ఛికం)',
    min: 'కనిష్ఠం',
    max: 'గరిష్ఠం',
    find: 'బహుమతులను కనుగొనండి',
    refine: 'ఫిల్టర్‌లను మార్చండి',
    resultsCount_one: 'మీ కోసం {count} బహుమతి ఆలోచన',
    resultsCount_other: 'మీ కోసం {count} బహుమతి ఆలోచనలు',
    noMatches: 'ఇంకా సరిపోలికలు లేవు',
    noMatchesSub: 'తక్కువ ఫిల్టర్‌లు లేదా విస్తృత బడ్జెట్ ప్రయత్నించండి.',
    searchError: 'ఇప్పుడు వెతకలేకపోయాం — మళ్లీ ప్రయత్నించండి.',

    occasion: {
      birthday: 'పుట్టినరోజు',
      wedding: 'వివాహం',
      anniversary: 'వార్షికోత్సవం',
      valentines: 'వాలెంటైన్స్',
      'baby-shower': 'బేబీ షవర్',
      housewarming: 'గృహప్రవేశం',
      graduation: 'గ్రాడ్యుయేషన్',
      festival: 'పండుగ',
      farewell: 'వీడ్కోలు',
      'thank-you': 'ధన్యవాదాలు',
    },
    recipient: { men: 'పురుషులు', women: 'స్త్రీలు', kids: 'పిల్లలు', anyone: 'ఎవరైనా' },
    type: {
      watch: 'వాచ్',
      perfume: 'పరిమళం',
      'photo-frame': 'ఫోటో ఫ్రేమ్',
      wallet: 'వాలెట్',
      jewelry: 'నగలు',
      toys: 'బొమ్మలు',
      'home-decor': 'గృహ అలంకరణ',
      electronics: 'ఎలక్ట్రానిక్స్',
      apparel: 'దుస్తులు',
      stationery: 'స్టేషనరీ',
      mug: 'మగ్',
      chocolates: 'చాక్లెట్లు',
    },
    reason: {
      occasion: '{occasion} కోసం అద్భుతం',
      'recipient-kids': 'పిల్లల కోసం తయారు చేయబడింది',
      recipient: '{recipient}లో ప్రసిద్ధం',
      anyone: 'ఎవరికైనా సరిపోతుంది',
      age: 'సరైన వయస్సు వర్గం',
      type: 'ఇది {types}',
      interests: '"{interests}"కు సరిపోతుంది',
      idea: 'బహుమతి ఆలోచన',
    },
  },
};
