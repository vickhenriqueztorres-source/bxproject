/**
 * Módulo de Instruções de Depósito por País/Moeda e Taxas de Câmbio LATAM (Subetapas 7.1, 7.2 e 7.5)
 */

export const LATAM_COUNTRIES = [
  'BR', 'MX', 'CO', 'AR', 'CL', 'PE',
  'VE', 'EC', 'GT', 'BO', 'DO', 'HN',
  'PY', 'NI', 'SV', 'CR', 'PA', 'UY',
];

export const CURRENCIES_TO_TRACK = [
  'BRL', 'MXN', 'COP', 'ARS', 'CLP', 'PEN',
  'VES', 'GTQ', 'BOB', 'DOP', 'HNL',
  'PYG', 'NIO', 'CRC', 'UYU',
];

export const FALLBACK_EXCHANGE_RATES = {
  USD: 1.00,
  BRL: 5.50,
  MXN: 19.50,
  COP: 4150.00,
  ARS: 1050.00,
  CLP: 940.00,
  PEN: 3.75,
  VES: 45.00,
  GTQ: 7.75,
  BOB: 6.91,
  DOP: 60.10,
  HNL: 25.10,
  PYG: 7800.00,
  NIO: 36.80,
  CRC: 512.00,
  UYU: 41.80,
};

export const COUNTRY_CURRENCY_MAP = {
  BR: { code: 'BRL', symbol: 'R$' },
  MX: { code: 'MXN', symbol: 'Mex$' },
  CO: { code: 'COP', symbol: 'Col$' },
  AR: { code: 'ARS', symbol: '$' },
  CL: { code: 'CLP', symbol: 'CLP$' },
  PE: { code: 'PEN', symbol: 'S/.' },
  VE: { code: 'VES', symbol: 'Bs.D' },
  EC: { code: 'USD', symbol: '$' },
  GT: { code: 'GTQ', symbol: 'Q' },
  BO: { code: 'BOB', symbol: 'Bs.' },
  DO: { code: 'DOP', symbol: 'RD$' },
  HN: { code: 'HNL', symbol: 'L' },
  PY: { code: 'PYG', symbol: '₲' },
  NI: { code: 'NIO', symbol: 'C$' },
  SV: { code: 'USD', symbol: '$' },
  CR: { code: 'CRC', symbol: '₡' },
  PA: { code: 'USD', symbol: '$' },
  UY: { code: 'UYU', symbol: '$U' },
};

export function getAvailableDepositMethods(country) {
  const norm = typeof country === 'string' ? country.trim().toUpperCase() : '';
  if (norm === 'BR') {
    return ['PIX', 'BANK', 'CARD', 'CRYPTO'];
  }
  return ['BANK', 'CARD', 'CRYPTO'];
}

export function calculateCRC16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function generatePixQrCode(amountInCents, depositId) {
  const safeCents = Number.isFinite(Number(amountInCents)) && Number(amountInCents) > 0 ? Number(amountInCents) : 1000;
  const amountStr = (safeCents / 100).toFixed(2);
  const pixKey = process.env.PIX_KEY || '33578457000164';
  const merchantName = 'BINMAX LTDA';
  const merchantCity = 'SAO PAULO';
  const txid = String(depositId || 'dep0001').replace(/[^a-zA-Z0-9]/g, '').substring(0, 25) || 'dep0001';

  const guiField = '0014BR.GOV.BCB.PIX';
  const keyField = `01${pixKey.length.toString().padStart(2, '0')}${pixKey}`;
  const merchantAccountInfo = `${guiField}${keyField}`;
  const txidField = `05${txid.length.toString().padStart(2, '0')}${txid}`;

  const payload = [
    '000201',
    `26${merchantAccountInfo.length.toString().padStart(2, '0')}${merchantAccountInfo}`,
    '52040000',
    '5303986',
    `54${amountStr.length.toString().padStart(2, '0')}${amountStr}`,
    '5802BR',
    `59${merchantName.length.toString().padStart(2, '0')}${merchantName}`,
    `60${merchantCity.length.toString().padStart(2, '0')}${merchantCity}`,
    `62${txidField.length.toString().padStart(2, '0')}${txidField}`,
    '6304',
  ].join('');

  return payload + calculateCRC16(payload);
}

const BANK_TEMPLATES = {
  BR: {
    title: 'Transferência Bancária (TED/DOC)',
    bank: 'Banco Binmax Brasil',
    account: '1234-5',
    agency: '0001',
    cnpj: '33.578.457/0001-64',
    holder: 'BINMAX LTDA',
  },
  MX: {
    title: 'Transferencia Bancaria (SPEI)',
    bank: 'Banco Binmax México (STP)',
    clabe: '012345678901234567',
    rfc: 'BMX010101ABC',
    holder: 'BINMAX MEXICO SA DE CV',
  },
  AR: {
    title: 'Transferencia Bancaria (CVU/CBU)',
    bank: 'Banco Binmax Argentina',
    cvu: '0000003100012345678901',
    cbu: '0170001640000012345678',
    cuit: '30-12345678-9',
    holder: 'BINMAX ARGENTINA SA',
  },
  CO: {
    title: 'Pago PSE o Transferencia Bancaria',
    bank: 'Banco Binmax Colombia',
    account: '123456789',
    accountType: 'Ahorros',
    nit: '901.234.567-8',
    holder: 'BINMAX COLOMBIA SAS',
  },
  CL: {
    title: 'Transferencia Bancaria (TEF)',
    bank: 'Banco Binmax Chile',
    account: '12345678',
    rut: '76.123.456-7',
    holder: 'BINMAX CHILE SpA',
  },
  PE: {
    title: 'Transferencia Bancaria (CCI)',
    bank: 'Banco Binmax Perú',
    account: '191-1234567-0-89',
    ruc: '20123456789',
    holder: 'BINMAX PERU SAC',
  },
  VE: {
    title: 'Transferencia Bancaria / Pago Móvil',
    bank: 'Banco Binmax Venezuela',
    account: '0102-0123-45-0000123456',
    rif: 'J-40123456-7',
    holder: 'BINMAX VENEZUELA CA',
  },
  EC: {
    title: 'Transferencia Bancaria Interbancaria',
    bank: 'Banco Binmax Ecuador',
    account: '2100123456',
    ruc: '1791234567001',
    holder: 'BINMAX ECUADOR SA',
  },
  UY: {
    title: 'Transferencia Bancaria Local',
    bank: 'Banco Binmax Uruguay',
    account: '001234567-00001',
    rut: '211234560018',
    holder: 'BINMAX URUGUAY SA',
  },
  DEFAULT: {
    title: 'Wire Transfer / Transferencia Bancaria',
    bank: 'Binmax International Bank',
    swift: 'BINMAXUS',
    iban: 'US12BINM0001234567890',
    holder: 'BINMAX GLOBAL INC',
  },
};

export function generateBankInstructions(country, amountInCents, depositId) {
  const normCountry = typeof country === 'string' ? country.trim().toUpperCase() : '';
  const safeCents = Number.isFinite(Number(amountInCents)) && Number(amountInCents) > 0 ? Number(amountInCents) : 1000;
  const amount = (safeCents / 100).toFixed(2);
  const currencyCode = COUNTRY_CURRENCY_MAP[normCountry]?.code || 'USD';
  const data = BANK_TEMPLATES[normCountry] || BANK_TEMPLATES.DEFAULT;

  const lines = [
    data.title,
    '━━━━━━━━━━━━━━━━━━━━━━',
    `Banco: ${data.bank}`,
  ];

  if (data.account) lines.push(`Cuenta: ${data.account}`);
  if (data.accountType) lines.push(`Tipo: ${data.accountType}`);
  if (data.agency) lines.push(`Agencia: ${data.agency}`);
  if (data.clabe) lines.push(`CLABE: ${data.clabe}`);
  if (data.cvu) lines.push(`CVU: ${data.cvu}`);
  if (data.cbu) lines.push(`CBU: ${data.cbu}`);
  if (data.swift) lines.push(`SWIFT: ${data.swift}`);
  if (data.iban) lines.push(`IBAN: ${data.iban}`);

  lines.push('');
  lines.push(`Titular: ${data.holder}`);
  if (data.cnpj) lines.push(`CNPJ: ${data.cnpj}`);
  if (data.rfc) lines.push(`RFC: ${data.rfc}`);
  if (data.cuit) lines.push(`CUIT: ${data.cuit}`);
  if (data.nit) lines.push(`NIT: ${data.nit}`);
  if (data.rut) lines.push(`RUT: ${data.rut}`);
  if (data.ruc) lines.push(`RUC: ${data.ruc}`);
  if (data.rif) lines.push(`RIF: ${data.rif}`);

  lines.push('');
  lines.push(`Monto: ${amount} ${currencyCode}`);
  lines.push(`Referencia: ${depositId}`);
  lines.push('');
  lines.push(
    normCountry === 'BR'
      ? '⚠️ Importante: Inclua a referência na descrição do pagamento'
      : '⚠️ Importante: Incluir la referencia en el concepto/descripción del pago'
  );

  return lines.join('\n');
}

export function generateCardInstructions(country, amountInCents, depositId) {
  const normCountry = typeof country === 'string' ? country.trim().toUpperCase() : '';
  const safeCents = Number.isFinite(Number(amountInCents)) && Number(amountInCents) > 0 ? Number(amountInCents) : 1000;
  const amount = (safeCents / 100).toFixed(2);
  const currencyCode = COUNTRY_CURRENCY_MAP[normCountry]?.code || 'USD';
  return `Checkout Tarjeta (Visa/Mastercard) — Monto: ${amount} ${currencyCode} — Referencia: ${depositId}`;
}

export function generateCryptoInstructions(amountInCents, depositId) {
  const safeCents = Number.isFinite(Number(amountInCents)) && Number(amountInCents) > 0 ? Number(amountInCents) : 1000;
  const amount = (safeCents / 100).toFixed(2);
  return `USDT (TRC-20) — Red: TRON — Monto: ${amount} USDT — Referencia: ${depositId}`;
}

export function generateDepositInstructions(country, method, amountInCents, depositId) {
  const normCountry = typeof country === 'string' ? country.trim().toUpperCase() : '';
  const normMethod = typeof method === 'string' ? method.trim().toUpperCase() : '';

  if (normMethod === 'PIX') {
    if (normCountry !== 'BR') {
      const err = new Error('PIX is only available in Brazil');
      err.statusCode = 400;
      err.availableMethods = ['BANK', 'CARD', 'CRYPTO'];
      throw err;
    }
    return generatePixQrCode(amountInCents, depositId);
  }

  if (normMethod === 'BANK') {
    return generateBankInstructions(normCountry, amountInCents, depositId);
  }

  if (normMethod === 'CARD') {
    return generateCardInstructions(normCountry, amountInCents, depositId);
  }

  if (normMethod === 'CRYPTO') {
    return generateCryptoInstructions(amountInCents, depositId);
  }

  throw new Error(`Unknown deposit method: ${method}`);
}
