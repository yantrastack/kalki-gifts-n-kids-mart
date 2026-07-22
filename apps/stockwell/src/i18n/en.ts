/**
 * English strings for the Stockwell admin app. Source-of-truth dictionary —
 * te.ts is typed against `Dict`, so every key here must exist there too.
 *
 * Coverage note: the app chrome (navigation, top bar, auth) is fully localized.
 * Individual admin pages can adopt `useI18n()` incrementally; add their strings
 * under a new namespace here and translate in te.ts. See AGENTS.md.
 */
export const en = {
  lang: { label: 'Language', english: 'English', telugu: 'తెలుగు' },

  nav: {
    sectionWorkspace: 'Workspace',
    sectionCatalog: 'Catalog',
    sectionSales: 'Sales',
    sectionOperations: 'Operations',
    sectionAdmin: 'Admin',

    dashboard: 'Dashboard',
    analytics: 'Analytics',
    engagement: 'Engagement',
    products: 'Products',
    inventory: 'Inventory',
    warehouses: 'Warehouses',
    pos: 'Register (POS)',
    invoices: 'Invoices',
    customers: 'Customers',
    returns: 'Returns',
    orders: 'Orders',
    suppliers: 'Suppliers',
    reports: 'Reports',
    barcode: 'Barcode',
    staff: 'Staff & roles',
    settings: 'Settings',

    seats: '{plan} · {seats} seats',
  },

  topbar: {
    searchPlaceholder: 'Search products, orders, suppliers…',
    scan: 'Scan barcode',
    notifications: 'Notifications',
    lightMode: 'Light mode',
    darkMode: 'Dark mode',
    menu: 'Menu',
    account: 'Account',
    workspaceSettings: 'Workspace settings',
    signOut: 'Sign out',
  },

  auth: {
    signInTitle: 'Sign in to your workspace',
    registerTitle: 'Create your account',
    signInSub: 'Welcome back. Enter your details to continue.',
    registerSub: 'Get started with a new staff account.',
    fullName: 'Full name',
    fullNamePlaceholder: 'Jane Doe',
    email: 'Email',
    password: 'Password',
    signIn: 'Sign in',
    createAccount: 'Create account',
    pleaseWait: 'Please wait…',
    demoLogin: 'Demo login —',
    newHere: 'New here?',
    createOne: 'Create an account',
    haveAccount: 'Already have an account?',
    loading: 'Loading…',
    genericError: 'Something went wrong',
  },
};

export type Dict = typeof en;
