/**
 * ================================================================================
 * SNAPEVENT: SETUP.GS - DATABASE INITIALIZATION, SAFE MIGRATION & ERP MODE
 * ================================================================================
 * Engine: ZettBOT Core v4.1 (Standard Google Apps Script Engineering)
 * Aturan Baku:
 * 1. DILARANG menggunakan karakter underscore (_) pada nama tab Google Sheets.
 * 2. Idempoten: Aman dijalankan berulang kali tanpa merusak data pengguna (Safe Migrate).
 * 3. Header baru otomatis disematkan di posisi paling kanan jika belum ada.
 * 4. Mode ERP: Menyediakan fungsi reset terstruktur & pengisian 5 data dummy lengkap.
 * ================================================================================
 */

// Konstanta Nama Sheet (Baku & Bersih tanpa underscore)
const SHEET_NAMES = {
  EVENT: "DataEvent",
  FOTO: "DataFoto",
  KATEGORI: "DataKategoriVoting",
  VOTING: "DataVoting",
  PENGATURAN: "DataPengaturanGlobal"
};

// Definisi Header Baku untuk masing-masing Sheet
const SCHEMA_HEADERS = {
  DataEvent: [
    "idEvent",             // COL[0]
    "namaEvent",           // COL[1]
    "slugEvent",           // COL[2]
    "tanggalEvent",        // COL[3]
    "hashtagEvent",        // COL[4]
    "maxFotoPerGuest",     // COL[5]
    "maxVotePerGuest",     // COL[6]
    "revealMode",          // COL[7]  (SEGERA / SETELAH)
    "isRevealed",          // COL[8]  (TRUE / FALSE)
    "likeEnabled",         // COL[9]  (TRUE / FALSE)
    "publicVisible",       // COL[10] (TRUE / FALSE)
    "activeCameraStyles",  // COL[11] JSON Array string
    "activeFrames",        // COL[12] JSON Array string
    "gdriveFolderId",      // COL[13] ID Folder Drive Event
    "statusEvent",         // COL[14] (AKTIF / INAKTIF / SELESAI)
    "createdAt",           // COL[15] Timestamp
    "customFrameUrl"       // COL[16] URL / Base64 File Frame PNG Upload Admin
  ],
  DataFoto: [
    "idFoto",              // COL[0]
    "idEvent",             // COL[1]
    "guestId",             // COL[2]
    "guestNama",           // COL[3]
    "captionFoto",         // COL[4]
    "cameraStyle",         // COL[5]
    "frameStyle",          // COL[6]
    "gdriveFileId",        // COL[7]
    "gdriveViewUrl",       // COL[8]
    "totalLikes",          // COL[9]
    "isFeatured",          // COL[10]
    "createdAt"            // COL[11]
  ],
  DataKategoriVoting: [
    "idKategori",          // COL[0]
    "idEvent",             // COL[1]
    "namaKategori",        // COL[2]
    "deskripsi",           // COL[3]
    "urutan"               // COL[4]
  ],
  DataVoting: [
    "idVote",              // COL[0]
    "idEvent",             // COL[1]
    "idFoto",              // COL[2]
    "idKategori",          // COL[3]
    "guestId",             // COL[4]
    "guestNama",           // COL[5]
    "votedAt"              // COL[6]
  ],
  DataPengaturanGlobal: [
    "kunciPengaturan",     // COL[0]
    "nilaiPengaturan",     // COL[1]
    "keterangan"           // COL[2]
  ]
};

// ================================================================================
// 5 DATA DUMMY EVENT LENGKAP & RELASI BISNIS (ENTERPRISE MASTER SEED)
// ================================================================================
const DUMMY_EVENTS_MASTER = [
  {
    event: [
      "EVT-202611-001",
      "The Wedding of Sarah & Kevin",
      "sarah-kevin",
      "2026-11-20",
      "#SarahKevinEverAfter",
      10,
      3,
      "SEGERA",
      true,
      true,
      true,
      JSON.stringify(["RAW", "800T", "WARM", "BW"]),
      JSON.stringify(["GOLD_DECO", "POLAROID", "MINIMAL"]),
      "",
      "AKTIF",
      "2026-11-08 18:00:00",
      ""
    ],
    categories: [
      ["KAT-001", "EVT-202611-001", "Best Outfit", "Tamu dengan busana paling menawan & memukau malam ini", 1],
      ["KAT-002", "EVT-202611-001", "Pose Terheboh", "Gaya jepretan paling kocak, seru, dan energik", 2],
      ["KAT-003", "EVT-202611-001", "Momen Terbaper", "Foto paling romantis, syahdu, atau menyentuh hati", 3]
    ],
    photos: [
      ["FTO-SK-001", "EVT-202611-001", "GUEST-001", "Sarah & Kevin", "Momen terbaik malam ini bersama sahabat tercinta!", "800T", "GOLD_DECO", "", "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80", 18, true, "2026-11-08 19:15:00"],
      ["FTO-SK-002", "EVT-202611-001", "GUEST-002", "David L.", "Keluarga besar groomsmen siap meriahkan pesta!", "WARM", "POLAROID", "", "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1200&q=80", 12, false, "2026-11-08 19:30:00"],
      ["FTO-SK-003", "EVT-202611-001", "GUEST-003", "Clara M.", "Cheers untuk cinta abadi pengantin berdua!", "BW", "MINIMAL", "", "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?auto=format&fit=crop&w=1200&q=80", 9, false, "2026-11-08 19:45:00"]
    ],
    votes: [
      ["VOT-SK-001", "EVT-202611-001", "FTO-SK-001", "KAT-001", "GUEST-101", "Rina", "2026-11-08 20:00:00"],
      ["VOT-SK-002", "EVT-202611-001", "FTO-SK-001", "KAT-003", "GUEST-102", "Bima", "2026-11-08 20:05:00"],
      ["VOT-SK-003", "EVT-202611-001", "FTO-SK-002", "KAT-002", "GUEST-103", "Andi", "2026-11-08 20:10:00"]
    ]
  },
  {
    event: [
      "EVT-202611-392",
      "The Wedding of Hans & Yurike",
      "hans-yurike",
      "2026-11-25",
      "#Hans&Yurike",
      5,
      3,
      "SEGERA",
      true,
      true,
      true,
      JSON.stringify(["RAW", "800T", "WARM", "BW"]),
      JSON.stringify(["GOLD_DECO", "POLAROID", "MINIMAL"]),
      "1FZoLfd0fczTX2N6y-xAI-G4KgVDnEfQk",
      "INAKTIF",
      "2026-11-08 18:30:00",
      ""
    ],
    categories: [
      ["KAT-101", "EVT-202611-392", "Best Dressed Guest", "Gaun & Jas paling elegan malam resepsi", 1],
      ["KAT-102", "EVT-202611-392", "The Best Groupie", "Wefie rombongan keluarga & kolega terkompak", 2],
      ["KAT-103", "EVT-202611-392", "Senyum Terhangat", "Senyuman paling manis dan tulus tertangkap lensa", 3]
    ],
    photos: [
      ["FTO-HY-001", "EVT-202611-392", "GUEST-011", "Hans & Yurike", "Bahagia selamanya mengarungi bahtera baru!", "800T", "GOLD_DECO", "", "https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1200&q=80", 15, true, "2026-11-08 20:15:00"],
      ["FTO-HY-002", "EVT-202611-392", "GUEST-012", "Raymond", "Sahabat sejak masa SMA akhirnya melepas masa lajang!", "WARM", "POLAROID", "", "https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1200&q=80", 10, false, "2026-11-08 20:25:00"],
      ["FTO-HY-003", "EVT-202611-392", "GUEST-013", "Jessica", "Bridesmaids squad siap mengawal ratu semalam!", "RAW", "MINIMAL", "", "https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=1200&q=80", 8, false, "2026-11-08 20:35:00"]
    ],
    votes: [
      ["VOT-HY-001", "EVT-202611-392", "FTO-HY-001", "KAT-101", "GUEST-111", "Fanny", "2026-11-08 20:40:00"],
      ["VOT-HY-002", "EVT-202611-392", "FTO-HY-002", "KAT-102", "GUEST-112", "Dion", "2026-11-08 20:45:00"]
    ]
  },
  {
    event: [
      "EVT-202612-105",
      "Annual Gala Dinner PT Nusantara Tech",
      "nusantara-gala-2026",
      "2026-12-15",
      "#NusantaraGala2026",
      8,
      2,
      "SETELAH",
      false,
      true,
      true,
      JSON.stringify(["RAW", "800T", "BW"]),
      JSON.stringify(["MINIMAL", "POLAROID"]),
      "",
      "INAKTIF",
      "2026-11-08 19:00:00",
      ""
    ],
    categories: [
      ["KAT-201", "EVT-202612-105", "Best Division Squad", "Divisi paling kompak, kreatif, dan inovatif", 1],
      ["KAT-202", "EVT-202612-105", "Future Leader Look", "Gaya paling profesional, berwibawa, dan kharismatik", 2]
    ],
    photos: [
      ["FTO-NT-001", "EVT-202612-105", "GUEST-021", "Tim Engineering", "Satu tahun penuh sprint, kolaborasi, dan pencapaian spektakuler!", "BW", "MINIMAL", "", "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=80", 22, true, "2026-11-08 21:00:00"],
      ["FTO-NT-002", "EVT-202612-105", "GUEST-022", "Tim Marketing", "Creative minds celebrating big milestone together!", "RAW", "POLAROID", "", "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=80", 14, false, "2026-11-08 21:10:00"]
    ],
    votes: [
      ["VOT-NT-001", "EVT-202612-105", "FTO-NT-001", "KAT-201", "GUEST-121", "Manager Joko", "2026-11-08 21:20:00"]
    ]
  },
  {
    event: [
      "EVT-202612-210",
      "Clarissa's Sweet 17: Enchanted Forest",
      "clarissa-sweet-17",
      "2026-12-28",
      "#ClarissaSweet17",
      12,
      3,
      "SEGERA",
      true,
      true,
      true,
      JSON.stringify(["RAW", "800T", "WARM"]),
      JSON.stringify(["GOLD_DECO", "POLAROID"]),
      "",
      "INAKTIF",
      "2026-11-08 19:30:00",
      ""
    ],
    categories: [
      ["KAT-301", "EVT-202612-210", "King & Queen of the Night", "Pasangan sahabat tamu paling memukau dan serasi", 1],
      ["KAT-302", "EVT-202612-210", "Tergokil & Terlucu", "Aksi foto paling spontan dan mengundang tawa", 2],
      ["KAT-303", "EVT-202612-210", "Paling Fotogenik", "Potret dengan pencahayaan dan estetika terbaik", 3]
    ],
    photos: [
      ["FTO-CL-001", "EVT-202612-210", "GUEST-031", "Clarissa", "Welcome to chapter 17 with magical souls and best friends forever!", "WARM", "GOLD_DECO", "", "https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=1200&q=80", 25, true, "2026-11-08 21:30:00"],
      ["FTO-CL-002", "EVT-202612-210", "GUEST-032", "Bella & Trio", "Happy birthday our sweetest princess Clarissa!", "800T", "POLAROID", "", "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1200&q=80", 17, false, "2026-11-08 21:40:00"]
    ],
    votes: [
      ["VOT-CL-001", "EVT-202612-210", "FTO-CL-001", "KAT-301", "GUEST-131", "Tasya", "2026-11-08 21:50:00"]
    ]
  },
  {
    event: [
      "EVT-202701-015",
      "Alumni Homecoming SMAN 1 Angkatan 2016",
      "reuni-smansa-2016",
      "2027-01-10",
      "#Smansa16Reunited",
      15,
      5,
      "SEGERA",
      true,
      true,
      true,
      JSON.stringify(["RAW", "800T", "WARM", "BW"]),
      JSON.stringify(["GOLD_DECO", "POLAROID", "MINIMAL", "NONE"]),
      "",
      "INAKTIF",
      "2026-11-08 20:00:00",
      ""
    ],
    categories: [
      ["KAT-401", "EVT-202701-015", "Nostalgia Terbaik", "Pose re-create foto masa SMA paling mirip dan seru", 1],
      ["KAT-402", "EVT-202701-015", "Paling Awet Muda", "Alumni dengan penampilan yang paling segar dan tidak berubah", 2],
      ["KAT-403", "EVT-202701-015", "Geng Paling Kompak", "Rombongan kelas dengan kehadiran paling banyak dan heboh", 3]
    ],
    photos: [
      ["FTO-AL-001", "EVT-202701-015", "GUEST-041", "Rombongan IPA 2", "Satu dekade berlalu, cerita dan kebersamaan kita tetap hangat!", "BW", "POLAROID", "", "https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1200&q=80", 30, true, "2026-11-08 22:00:00"],
      ["FTO-AL-002", "EVT-202701-015", "GUEST-042", "Budi & Reza", "Dulu sekelas, sekarang saling dukung karier masing-masing!", "RAW", "MINIMAL", "", "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80", 19, false, "2026-11-08 22:10:00"]
    ],
    votes: [
      ["VOT-AL-001", "EVT-202701-015", "FTO-AL-001", "KAT-401", "GUEST-141", "Hendro", "2026-11-08 22:15:00"]
    ]
  }
];

// Konfigurasi Enterprise Global Multi-Role
const ENTERPRISE_CONFIGS = [
  ["app_title", "SnapEvent Enterprise Studio", "Nama Platform Web App Resmi"],
  ["app_logo_url", "", "URL atau Gambar Logo Kustom Platform"],
  ["app_phone", "0812-3456-7890", "Nomor WhatsApp / Layanan Hotline Resmi"],
  ["app_instagram", "@snapevent", "Akun Media Sosial / Instagram Resmi"],
  ["admin_user", "admin", "Username Akses Administrator Utama"],
  ["admin_pass", "admin123", "Password Akses Administrator Utama"],
  ["admin_pin", "889900", "Master PIN Akses Cepat Ballroom"],
  [
    "user_accounts",
    JSON.stringify([
      { user: "crew", pass: "crew123", role: "operator" },
      { user: "spv", pass: "spv123", role: "supervisor" },
      { user: "photo", pass: "photo123", role: "photographer" }
    ]),
    "Daftar Akun Enterprise Operator & Kru Tambahan (JSON)"
  ],
  ["default_max_foto", "10", "Default Kuota Jepret per Tamu"],
  ["default_max_vote", "1", "Default Kuota Suara per Kategori (Strict 1x)"],
  ["master_drive_folder_id", "12LfLW50HIuMUPCGQiRJKy_aO4RhVICjw", "ID Folder Induk Google Drive Resmi (Master)"],
  ["gas_webapp_url", "https://script.google.com/macros/s/AKfycbxg-Owg7BrEqx4KHDI7UsLBX88ejLXcVxgQuSZNtz8d0rIJ_wCGVQFsOzpKGDO8w8cOrw/exec", "URL Backend Web App Endpoint Resmi (GAS)"]
];

/**
 * ================================================================================
 * TRIGGER ON-OPEN: MENU DROPDOWN LANGSUNG PADA GOOGLE SHEETS
 * ================================================================================
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("🚀 SnapEvent ERP")
    .addItem("⚡ Safe Migration (Cek Kolom Baru)", "inisialisasiDatabase")
    .addSeparator()
    .addItem("⚠️ ERP Mode: Reset & Terapkan 5 Data Dummy Lengkap", "konfirmasiERPMode")
    .addToUi();
}

/**
 * Dialog Konfirmasi Aman Sebelum Menjalankan ERP Mode
 */
function konfirmasiERPMode() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert(
    "Konfirmasi ERP Mode (Reset & Terapkan 5 Data Dummy)",
    "Perhatian: Tindakan ini akan membersihkan lembar kerja dan mengisikan kembali 5 data dummy event lengkap dengan kategori, foto sampel, dan voting.\n\nApakah Anda yakin ingin melanjutkan?",
    ui.ButtonSet.YES_NO
  );

  if (resp === ui.Button.YES) {
    const hasil = modeERP_ResetDanIsiDataDummy();
    ui.alert("Sukses!", hasil, ui.ButtonSet.OK);
  } else {
    ui.alert("Dibatalkan", "Operasi ERP Mode dibatalkan dengan aman.", ui.ButtonSet.OK);
  }
}

/**
 * ================================================================================
 * MODUS 1: inisialisasiDatabase() (DEFAULT SAFE MIGRATION MODE)
 * ================================================================================
 * Non-destruktif: Tidak menghapus data yang sudah ada, hanya menambahkan tab/kolom baru.
 */
function inisialisasiDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Proses setiap sheet sesuai skema resmi
  Object.keys(SCHEMA_HEADERS).forEach(function(sheetName) {
    let sheet = ss.getSheetByName(sheetName);
    const expectedHeaders = SCHEMA_HEADERS[sheetName];

    if (!sheet) {
      // Buat sheet baru jika belum ada
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(expectedHeaders);
      formatHeaderRow(sheet, expectedHeaders.length);
    } else {
      // Safe Migration: Cek jika ada penambahan header baru di masa depan
      const lastCol = sheet.getLastColumn();
      if (lastCol === 0) {
        sheet.appendRow(expectedHeaders);
        formatHeaderRow(sheet, expectedHeaders.length);
      } else {
        const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
        expectedHeaders.forEach(function(header) {
          if (currentHeaders.indexOf(header) === -1) {
            const nextCol = sheet.getLastColumn() + 1;
            sheet.getRange(1, nextCol).setValue(header).setFontWeight("bold");
          }
        });
      }
    }
  });

  // 2. Isi Data Awal / Seed Demo jika tabel DataEvent masih kosong
  const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENT);
  if (eventSheet && eventSheet.getLastRow() <= 1) {
    suntikDataDummyLengkap(ss);
  }

  // 3. Pastikan konfigurasi global tersedia
  suntikPengaturanGlobal(ss, false);

  hapusSheetDefaultJikaAda(ss);
  SpreadsheetApp.flush();
  Logger.log("Safe Migration SnapEvent Berhasil!");
  return "Database SnapEvent berhasil dimigrasikan secara aman.";
}

/**
 * ================================================================================
 * MODUS 2: modeERP_ResetDanIsiDataDummy() (ERASE, RESET & POPULATE MODE)
 * ================================================================================
 * Membersihkan data lama secara terstruktur dan mengisi ulang 5 data dummy lengkap
 * dengan kategori, foto sampel beresolusi tinggi, like, dan data voting.
 */
function modeERP_ResetDanIsiDataDummy() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Inisialisasi ulang seluruh sheet dan pasang header
  Object.keys(SCHEMA_HEADERS).forEach(function(sheetName) {
    let sheet = ss.getSheetByName(sheetName);
    const expectedHeaders = SCHEMA_HEADERS[sheetName];

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    } else {
      sheet.clearContents();
    }

    sheet.appendRow(expectedHeaders);
    formatHeaderRow(sheet, expectedHeaders.length);
  });

  // 2. Suntikkan 5 Event Lengkap Beserta Seluruh Relasi Datanya
  suntikDataDummyLengkap(ss);

  // 3. Suntikkan Konfigurasi Enterprise Global Multi-Role
  suntikPengaturanGlobal(ss, true);

  hapusSheetDefaultJikaAda(ss);
  SpreadsheetApp.flush();

  const msg = "ERP Mode Sukses: 5 Data Event Lengkap beserta Kategori, Foto Sampel, dan Voting telah berhasil diisikan ke Google Sheets!";
  Logger.log(msg);
  return msg;
}

/**
 * Helper: Menyuntikkan 5 Data Event, Kategori, Foto, dan Voting Lengkap
 */
function suntikDataDummyLengkap(ss) {
  const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENT);
  const katSheet = ss.getSheetByName(SHEET_NAMES.KATEGORI);
  const fotoSheet = ss.getSheetByName(SHEET_NAMES.FOTO);
  const voteSheet = ss.getSheetByName(SHEET_NAMES.VOTING);

  DUMMY_EVENTS_MASTER.forEach(function(item) {
    // 1. Append Baris Event
    if (eventSheet && Array.isArray(item.event)) {
      eventSheet.appendRow(item.event);
    }

    // 2. Append Baris Kategori
    if (katSheet && Array.isArray(item.categories)) {
      item.categories.forEach(function(cat) {
        katSheet.appendRow(cat);
      });
    }

    // 3. Append Baris Foto Sampel
    if (fotoSheet && Array.isArray(item.photos)) {
      item.photos.forEach(function(p) {
        fotoSheet.appendRow(p);
      });
    }

    // 4. Append Baris Voting
    if (voteSheet && Array.isArray(item.votes)) {
      item.votes.forEach(function(v) {
        voteSheet.appendRow(v);
      });
    }
  });
}

/**
 * Helper: Menyuntikkan Konfigurasi Global
 */
function suntikPengaturanGlobal(ss, isForceReset) {
  const configSheet = ss.getSheetByName(SHEET_NAMES.PENGATURAN);
  if (!configSheet) return;

  if (isForceReset || configSheet.getLastRow() <= 1) {
    ENTERPRISE_CONFIGS.forEach(function(cfg) {
      configSheet.appendRow(cfg);
    });
  } else {
    const existingKeys = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 1).getDisplayValues().map(function(r) { return r[0]; });
    ENTERPRISE_CONFIGS.forEach(function(cfg) {
      if (existingKeys.indexOf(cfg[0]) === -1) {
        configSheet.appendRow(cfg);
      }
    });
  }
}

/**
 * Helper: Styling Header Baris 1 Elegan (Dark Slate Theme)
 */
function formatHeaderRow(sheet, totalCols) {
  const headerRange = sheet.getRange(1, 1, 1, totalCols);
  headerRange.setBackground("#1E293B");
  headerRange.setFontColor("#F8FAFC");
  headerRange.setFontWeight("bold");
  headerRange.setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
}

/**
 * Helper: Hapus Tab Bawaan "Sheet1" jika Kosong
 */
function hapusSheetDefaultJikaAda(ss) {
  try {
    const defaultSheet = ss.getSheetByName("Sheet1") || ss.getSheetByName("Sheet 1");
    if (defaultSheet && ss.getSheets().length > 1) {
      ss.deleteSheet(defaultSheet);
    }
  } catch (err) {
    Logger.log("Note saat hapus sheet default: " + err.message);
  }
}
