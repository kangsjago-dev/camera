/**
 * ================================================================================
 * SNAPEVENT BACKEND: CONFIG.GS
 * Index-Based Column Definitions, Sheet Names & Sanitization Helpers
 * ================================================================================
 */

const SHEET_NAMES = {
  EVENT: "DataEvent",
  FOTO: "DataFoto",
  KATEGORI: "DataKategori",
  VOTING: "DataVoting",
  PENGATURAN: "Pengaturan"
};

// Peta Indeks Kolom Resmi (Index-Based Mapping)
const COL_EVENT = {
  ID: 0,
  NAMA: 1,
  SLUG: 2,
  TANGGAL: 3,
  HASHTAG: 4,
  MAX_FOTO: 5,
  MAX_VOTE: 6,
  REVEAL_MODE: 7,
  IS_REVEALED: 8,
  LIKE_ENABLED: 9,
  PUBLIC_VISIBLE: 10,
  CAMERA_STYLES: 11,
  FRAMES: 12,
  GDRIVE_FOLDER_ID: 13,
  STATUS: 14,
  CREATED_AT: 15,
  CUSTOM_FRAME_URL: 16
};

const COL_FOTO = {
  ID: 0,
  ID_EVENT: 1,
  GUEST_ID: 2,
  GUEST_NAMA: 3,
  CAPTION: 4,
  CAMERA_STYLE: 5,
  FRAME_STYLE: 6,
  GDRIVE_FILE_ID: 7,
  GDRIVE_VIEW_URL: 8,
  TOTAL_LIKES: 9,
  IS_FEATURED: 10,
  CREATED_AT: 11
};

const COL_KAT = {
  ID: 0,
  ID_EVENT: 1,
  NAMA: 2,
  DESKRIPSI: 3,
  URUTAN: 4
};

const COL_VOTE = {
  ID: 0,
  ID_EVENT: 1,
  ID_FOTO: 2,
  ID_KAT: 3,
  GUEST_ID: 4,
  GUEST_NAMA: 5,
  VOTED_AT: 6
};

const COL_CONFIG = {
  KEY: 0,
  VAL: 1,
  DESC: 2
};

/**
 * Sanitasi Nilai Sel Google Sheets: Batasi Panjang Maksimal 45.000 Karakter
 * Mencegah Error: 'Your input contains more than the maximum of 50000 characters in a single cell'
 * Dan memblokir mutlak penulisan string Data URL Base64 ke dalam sel Sheets.
 */
function sanitizeCellValue(val, maxLen) {
  if (val === null || val === undefined) return "";
  maxLen = maxLen || 45000;
  var str = String(val);
  // Proteksi Mutlak: Jangan pernah izinkan data URL base64 masuk ke sel Sheets
  if (str.indexOf("data:") === 0) {
    return "";
  }
  if (str.length > maxLen) {
    Logger.log("WARNING: Nilai sel dipangkas dari " + str.length + " ke " + maxLen + " karakter untuk proteksi sel Sheets");
    return str.substring(0, maxLen);
  }
  return str;
}

/**
 * Ekstraksi ID Folder Google Drive dari URL Lengkap atau ID Mentah
 */
function extractDriveFolderId(input) {
  if (!input) return "";
  const str = String(input).trim();
  const match = str.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];
  const matchId = str.match(/id=([a-zA-Z0-9_-]+)/);
  if (matchId && matchId[1]) return matchId[1];
  return str.replace(/[^a-zA-Z0-9_-]/g, "");
}

/**
 * Generator ID Sekuensial Unik Terkunci (Anti-Tabrakan)
 */
function generateIncrementalId(sheet, prefix, colIndex) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return prefix + "001";

  const values = sheet.getRange(2, colIndex + 1, lastRow - 1, 1).getDisplayValues();
  let maxNum = 0;

  for (let i = 0; i < values.length; i++) {
    const val = values[i][0];
    if (val && val.indexOf(prefix) === 0) {
      const numPart = val.substring(prefix.length);
      const parsed = parseInt(numPart, 10);
      if (!isNaN(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    }
  }

  const nextNum = maxNum + 1;
  const padLen = 3;
  let nextStr = String(nextNum);
  while (nextStr.length < padLen) {
    nextStr = "0" + nextStr;
  }
  return prefix + nextStr;
}

/**
 * Pembuat slug URL ramah karakter
 */
function createSlug(text) {
  if (!text) return "event";
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
