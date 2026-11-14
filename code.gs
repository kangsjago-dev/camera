/**
 * ================================================================================
 * SNAPEVENT: CODE.GS - BACKEND CONTROLLER & GOOGLE DRIVE INTEGRATION
 * ================================================================================
 * Engine: ZettBOT Core v4.1 (Standard Google Apps Script Engineering)
 * Aturan Rekayasa Mutlak:
 * 1. Index-Based Column Mapping (COL) kebal perubahan teks header.
 * 2. getDisplayValues() untuk cegah distorsi tanggal/waktu timezone.
 * 3. SpreadsheetApp.flush() sebelum return response.
 * 4. LockService untuk penomoran ID unik sekuensial anti-tabrakan.
 * 5. Sanitasi Mutlak: Dilarang menyimpan base64 ke cell Spreadsheet (maks 45k chars).
 * 6. Folder Reuse: Mencegah duplikasi folder kosong di Google Drive.
 * 7. CORS Friendly JSON Output untuk dikonsumsi Frontend SPA.
 * ================================================================================
 */

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

const SHEET_NAMES = {
  EVENT: "DataEvent",
  FOTO: "DataFoto",
  KATEGORI: "DataKategori",
  VOTING: "DataVoting",
  PENGATURAN: "Config"
};

/**
 * Helper Output JSON dengan Header CORS Terbuka
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Sanitasi Ketat String untuk Sel Spreadsheet
 * Mencegah error 'Your input contains more than the maximum of 50000 characters in a single cell'
 */
function sanitizeCellValue(val, maxLen) {
  if (val === null || val === undefined) return "";
  const limit = maxLen || 45000;
  let str = String(val);
  // Dilarang keras menyimpan data URI base64 ke dalam cell
  if (str.indexOf("data:") === 0) {
    return "";
  }
  if (str.length > limit) {
    return str.substring(0, limit);
  }
  return str;
}

/**
 * Helper Ekstraksi ID Folder Google Drive dari URL atau Raw ID
 */
function extractDriveFolderId(input) {
  if (!input) return "";
  const str = String(input).trim();
  const match = str.match(/[-\w]{25,}/);
  return match ? match[0] : str;
}

/**
 * Helper Pembuatan Slug Acara yang Bersih
 */
function createSlug(text) {
  if (!text) return "acara-" + Date.now();
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/**
 * Helper Aman JSON Parsing
 */
function parseJsonSafe(jsonStr, fallback) {
  if (!jsonStr) return fallback;
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    return fallback;
  }
}

/**
 * Generator ID Unik Sekuensial
 */
function generateIncrementalId(sheet, prefix, colIndex) {
  let maxNum = 0;
  if (sheet && sheet.getLastRow() > 1) {
    const vals = sheet.getRange(2, colIndex + 1, sheet.getLastRow() - 1, 1).getDisplayValues();
    vals.forEach(function(r) {
      const val = r[0];
      if (val && val.indexOf(prefix) === 0) {
        const numPart = parseInt(val.replace(prefix, ""), 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    });
  }
  const nextNum = maxNum + 1;
  const padded = ("000" + nextNum).slice(-3);
  return prefix + padded;
}

/**
 * GENERATOR ID FOTO SEKUENSIAL MONOTONIK DENGAN ANTI-COLLISION MUTLAK
 * Memeriksa DataFoto, PropertiesService, dan file fisik Google Drive agar nomor ID tidak pernah bertabrakan
 */
function generateIncrementalPhotoId(sheet, dateCompact, targetFolder) {
  const prefix = "FTO-" + dateCompact + "-";
  let maxNum = 0;

  // 1. Cek dari Spreadsheet DataFoto
  if (sheet && sheet.getLastRow() > 1) {
    const vals = sheet.getRange(2, COL_FOTO.ID + 1, sheet.getLastRow() - 1, 1).getDisplayValues();
    vals.forEach(function(r) {
      const val = String(r[0] || "");
      if (val.indexOf(prefix) === 0) {
        const rawNum = val.replace(prefix, "").split("_")[0].split("-")[0];
        const numPart = parseInt(rawNum, 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    });
  }

  // 2. Cek dari PropertiesService (Monotonic counter yang tidak pernah berkurang)
  const scriptProps = PropertiesService.getScriptProperties();
  const propKey = "SEQ_FTO_" + dateCompact;
  const propVal = parseInt(scriptProps.getProperty(propKey) || "0", 10);
  if (!isNaN(propVal) && propVal > maxNum) {
    maxNum = propVal;
  }

  // 3. Cek dari Google Drive folder fisik acara
  if (targetFolder) {
    try {
      const fIter = targetFolder.getFiles();
      while (fIter.hasNext()) {
        const f = fIter.next();
        if (f.isTrashed()) continue;
        const fname = f.getName();
        if (fname.indexOf(prefix) === 0) {
          const rawNum = fname.replace(prefix, "").split("_")[0].split("-")[0];
          const numPart = parseInt(rawNum, 10);
          if (!isNaN(numPart) && numPart > maxNum) {
            maxNum = numPart;
          }
        }
      }
    } catch(eDrive) {}
  }

  const nextNum = maxNum + 1;
  scriptProps.setProperty(propKey, String(nextNum));
  const padded = ("000" + nextNum).slice(-3);
  return prefix + padded;
}

/**
 * Smart Folder Discovery & Reuse (Eliminasi Folder Kosong Dobel di Google Drive)
 */
function getOrCreateEventSubFolder(parentFolder, eventId, eventSlug, eventName) {
  const cleanName = (eventSlug || eventName || eventId).replace(/[/\\:*?"<>|]/g, "_").trim();
  const candidateNames = [
    cleanName,
    "SnapEvent_" + cleanName,
    eventSlug,
    eventId
  ];

  for (let i = 0; i < candidateNames.length; i++) {
    const iter = parentFolder.getFoldersByName(candidateNames[i]);
    if (iter.hasNext()) {
      return iter.next();
    }
  }

  // Jika belum ada, buat 1 folder baru
  const newFolder = parentFolder.createFolder(cleanName);
  try {
    newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {}
  return newFolder;
}

/**
 * HTTP GET Router
 */
function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const action = params.action || "ping";

    if (action === "ping" || action === "testConnection") {
      return createJsonResponse({
        status: "success",
        message: "SnapEvent Backend API Online & Siap Digunakan",
        timestamp: new Date().toISOString()
      });
    }

    if (action === "getInitialData" || action === "getAllEvents" || action === "adminGetEvents") {
      return createJsonResponse(handleGetAllEvents());
    }

    if (action === "getEventDetails") {
      const eventId = params.eventId || "";
      const guestId = params.guestId || "";
      return createJsonResponse(handleGetEventDetails(eventId, guestId));
    }

    if (action === "getGallery") {
      const eventId = params.eventId || "";
      const guestId = params.guestId || "";
      return createJsonResponse(handleGetGallery(eventId, guestId));
    }

    if (action === "getSlideshowPhotos") {
      const eventId = params.eventId || "";
      return createJsonResponse(handleGetSlideshowPhotos(eventId));
    }

    if (action === "getGuestQuota") {
      const eventId = params.eventId || "";
      const guestId = params.guestId || "";
      return createJsonResponse(handleGetGuestQuota(eventId, guestId));
    }

    if (action === "adminGetSummary") {
      const pin = params.pin || "";
      return createJsonResponse(handleAdminGetSummary(pin));
    }

    if (action === "cleanDeletedPhotos") {
      const eventId = params.eventId || "";
      return createJsonResponse(handleCleanDeletedPhotos(eventId));
    }

    return createJsonResponse({
      status: "error",
      message: "Action GET '" + action + "' tidak dikenali."
    });
  } catch (err) {
    return createJsonResponse({
      status: "error",
      message: "Internal Server Error: " + err.message
    });
  }
}

/**
 * HTTP POST Router
 */
function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        payload = e.parameter || {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const action = payload.action || "";

    if (action === "uploadPhoto") {
      return createJsonResponse(handleUploadPhoto(payload));
    }

    if (action === "uploadCustomFrame") {
      return createJsonResponse(handleUploadCustomFrame(payload));
    }

    if (action === "submitVote") {
      return createJsonResponse(handleSubmitVote(payload));
    }

    if (action === "adminLogin") {
      return createJsonResponse(handleAdminLogin(payload));
    }

    if (action === "adminSaveEvent") {
      return createJsonResponse(handleAdminSaveEvent(payload));
    }

    if (action === "adminToggleReveal") {
      return createJsonResponse(handleAdminToggleReveal(payload));
    }

    if (action === "adminSetActiveEvent") {
      return createJsonResponse(handleAdminSetActiveEvent(payload));
    }

    if (action === "adminUpdateGlobalConfig") {
      return createJsonResponse(handleAdminUpdateGlobalConfig(payload));
    }

    return createJsonResponse({
      status: "error",
      message: "Action POST '" + action + "' tidak dikenali."
    });
  } catch (err) {
    return createJsonResponse({
      status: "error",
      message: "Error processing request: " + err.message
    });
  }
}

// ================================================================================
// HANDLER EVENT & GALLERY
// ================================================================================

function handleGetAllEvents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENT);
  const fotoSheet = ss.getSheetByName(SHEET_NAMES.FOTO);
  const voteSheet = ss.getSheetByName(SHEET_NAMES.VOTING);
  const configSheet = ss.getSheetByName(SHEET_NAMES.PENGATURAN);

  if (!eventSheet) {
    return { status: "error", message: "Database belum siap. Sheet DataEvent tidak ditemukan." };
  }

  const events = [];
  if (eventSheet.getLastRow() > 1) {
    const rows = eventSheet.getRange(2, 1, eventSheet.getLastRow() - 1, 17).getDisplayValues();
    rows.forEach(function(r) {
      if (r[COL_EVENT.ID]) {
        const rawFrames = parseJsonSafe(r[COL_EVENT.FRAMES], ["GOLD_DECO", "POLAROID", "MINIMAL"]);
        let fMode = "multi";
        let fLocked = "GOLD_DECO";
        let fList = ["GOLD_DECO", "POLAROID", "MINIMAL"];
        if (rawFrames && typeof rawFrames === "object" && !Array.isArray(rawFrames)) {
          fMode = rawFrames.mode || "multi";
          fLocked = rawFrames.locked || "GOLD_DECO";
          fList = Array.isArray(rawFrames.frames) ? rawFrames.frames : [fLocked];
        } else if (Array.isArray(rawFrames)) {
          fList = rawFrames;
          if (rawFrames.length === 1) {
            fMode = "single";
            fLocked = rawFrames[0];
          }
        }

        const revFlag = String(r[COL_EVENT.IS_REVEALED] || "").trim().toUpperCase();
        let isRev = false;
        if (revFlag === "TRUE") {
          isRev = true;
        } else if (revFlag === "FALSE") {
          isRev = false;
        } else {
          isRev = (r[COL_EVENT.REVEAL_MODE] === "SEGERA");
        }

        events.push({
          idEvent: r[COL_EVENT.ID],
          namaEvent: r[COL_EVENT.NAMA] || "Acara",
          slugEvent: r[COL_EVENT.SLUG] || createSlug(r[COL_EVENT.NAMA] || ""),
          tanggalEvent: r[COL_EVENT.TANGGAL] || "",
          hashtagEvent: r[COL_EVENT.HASHTAG] || "",
          maxFotoPerGuest: Number(r[COL_EVENT.MAX_FOTO]) || 10,
          maxVotePerGuest: Number(r[COL_EVENT.MAX_VOTE]) || 3,
          revealMode: r[COL_EVENT.REVEAL_MODE] || "SEGERA",
          isRevealed: isRev,
          likeEnabled: r[COL_EVENT.LIKE_ENABLED] !== "FALSE" && r[COL_EVENT.LIKE_ENABLED] !== "false",
          publicVisible: r[COL_EVENT.PUBLIC_VISIBLE] !== "FALSE" && r[COL_EVENT.PUBLIC_VISIBLE] !== "false",
          activeCameraStyles: parseJsonSafe(r[COL_EVENT.CAMERA_STYLES], ["RAW", "800T", "WARM", "BW"]),
          activeFrames: fList,
          frameLockMode: fMode,
          singleLockedFrame: fLocked,
          gdriveFolderId: r[COL_EVENT.GDRIVE_FOLDER_ID] || "",
          statusEvent: r[COL_EVENT.STATUS] || "INAKTIF",
          customFrameUrl: r[COL_EVENT.CUSTOM_FRAME_URL] || ""
        });
      }
    });
  }

  const totalEvents = events.length;
  const totalPhotos = fotoSheet ? Math.max(0, fotoSheet.getLastRow() - 1) : 0;
  const totalVotes = voteSheet ? Math.max(0, voteSheet.getLastRow() - 1) : 0;

  const globalConfig = {};
  if (configSheet && configSheet.getLastRow() > 1) {
    const cRows = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 2).getDisplayValues();
    cRows.forEach(function(cr) {
      globalConfig[cr[COL_CONFIG.KEY]] = cr[COL_CONFIG.VAL];
    });
  }

  return {
    status: "success",
    events: events,
    totalEvents: totalEvents,
    totalPhotos: totalPhotos,
    totalVotes: totalVotes,
    metrics: {
      totalEvents: totalEvents,
      totalPhotos: totalPhotos,
      totalVotes: totalVotes
    },
    globalConfig: globalConfig
  };
}

function handleGetEventDetails(eventId, guestId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENT);
  const katSheet = ss.getSheetByName(SHEET_NAMES.KATEGORI);
  const fotoSheet = ss.getSheetByName(SHEET_NAMES.FOTO);
  const voteSheet = ss.getSheetByName(SHEET_NAMES.VOTING);
  const configSheet = ss.getSheetByName(SHEET_NAMES.PENGATURAN);

  if (!eventSheet || eventSheet.getLastRow() <= 1) {
    return { status: "error", message: "Event tidak ditemukan." };
  }

  let matchedRow = null;
  const rows = eventSheet.getRange(2, 1, eventSheet.getLastRow() - 1, 17).getDisplayValues();

  // 1. Coba cari berdasarkan eventId (ID atau Slug)
  if (eventId && eventId !== "ACTIVE" && eventId !== "DEFAULT") {
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][COL_EVENT.ID] === eventId || rows[i][COL_EVENT.SLUG] === eventId) {
        matchedRow = rows[i];
        break;
      }
    }
  }

  // 2. Jika tidak ditemukan atau eventId kosong/default, pilih event pertama yang berstatus AKTIF
  if (!matchedRow) {
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][COL_EVENT.STATUS] === "AKTIF") {
        matchedRow = rows[i];
        break;
      }
    }
  }

  // 3. Fallback: ambil baris event pertama
  if (!matchedRow && rows.length > 0) {
    matchedRow = rows[0];
  }

  if (!matchedRow) {
    return { status: "error", message: "Event tidak ditemukan." };
  }

  const r = matchedRow;
  const rawFrames = parseJsonSafe(r[COL_EVENT.FRAMES], ["GOLD_DECO", "POLAROID", "MINIMAL"]);
  let fMode = "multi";
  let fLocked = "GOLD_DECO";
  let fList = ["GOLD_DECO", "POLAROID", "MINIMAL"];
  if (rawFrames && typeof rawFrames === "object" && !Array.isArray(rawFrames)) {
    fMode = rawFrames.mode || "multi";
    fLocked = rawFrames.locked || "GOLD_DECO";
    fList = Array.isArray(rawFrames.frames) ? rawFrames.frames : [fLocked];
  } else if (Array.isArray(rawFrames)) {
    fList = rawFrames;
    if (rawFrames.length === 1) {
      fMode = "single";
      fLocked = rawFrames[0];
    }
  }

  const revFlag = String(r[COL_EVENT.IS_REVEALED] || "").trim().toUpperCase();
  let isRev = false;
  if (revFlag === "TRUE") {
    isRev = true;
  } else if (revFlag === "FALSE") {
    isRev = false;
  } else {
    isRev = (r[COL_EVENT.REVEAL_MODE] === "SEGERA");
  }

  const matchedEvent = {
    idEvent: r[COL_EVENT.ID],
    namaEvent: r[COL_EVENT.NAMA],
    slugEvent: r[COL_EVENT.SLUG],
    tanggalEvent: r[COL_EVENT.TANGGAL],
    hashtagEvent: r[COL_EVENT.HASHTAG],
    maxFotoPerGuest: Number(r[COL_EVENT.MAX_FOTO]) || 10,
    maxVotePerGuest: Number(r[COL_EVENT.MAX_VOTE]) || 3,
    revealMode: r[COL_EVENT.REVEAL_MODE],
    isRevealed: isRev,
    likeEnabled: r[COL_EVENT.LIKE_ENABLED] !== "FALSE" && r[COL_EVENT.LIKE_ENABLED] !== "false",
    publicVisible: r[COL_EVENT.PUBLIC_VISIBLE] !== "FALSE" && r[COL_EVENT.PUBLIC_VISIBLE] !== "false",
    activeCameraStyles: parseJsonSafe(r[COL_EVENT.CAMERA_STYLES], ["RAW", "800T", "WARM", "BW"]),
    activeFrames: fList,
    frameLockMode: fMode,
    singleLockedFrame: fLocked,
    gdriveFolderId: r[COL_EVENT.GDRIVE_FOLDER_ID],
    statusEvent: r[COL_EVENT.STATUS],
    customFrameUrl: r[COL_EVENT.CUSTOM_FRAME_URL] || ""
  };

  // Ambil Kategori Acara
  const categories = [];
  if (katSheet && katSheet.getLastRow() > 1) {
    const kRows = katSheet.getRange(2, 1, katSheet.getLastRow() - 1, 5).getDisplayValues();
    kRows.forEach(function(kr) {
      if (kr[COL_KAT.ID_EVENT] === matchedEvent.idEvent || kr[COL_KAT.ID_EVENT] === matchedEvent.slugEvent) {
        categories.push({
          idKategori: kr[COL_KAT.ID],
          namaKategori: kr[COL_KAT.NAMA],
          deskripsi: kr[COL_KAT.DESKRIPSI],
          urutan: Number(kr[COL_KAT.URUTAN]) || 1
        });
      }
    });
  }

  // Statistik Tamu
  let guestUploadedPhotos = 0;
  if (guestId && fotoSheet && fotoSheet.getLastRow() > 1) {
    const fRows = fotoSheet.getRange(2, 1, fotoSheet.getLastRow() - 1, 4).getDisplayValues();
    fRows.forEach(function(fr) {
      if (fr[COL_FOTO.ID_EVENT] === matchedEvent.idEvent && fr[COL_FOTO.GUEST_ID] === guestId) {
        guestUploadedPhotos++;
      }
    });
  }

  const guestVotesMap = {};
  if (guestId && voteSheet && voteSheet.getLastRow() > 1) {
    const vRows = voteSheet.getRange(2, 1, voteSheet.getLastRow() - 1, 6).getDisplayValues();
    vRows.forEach(function(vr) {
      if (vr[COL_VOTE.ID_EVENT] === matchedEvent.idEvent && vr[COL_VOTE.GUEST_ID] === guestId) {
        const cat = vr[COL_VOTE.ID_KAT] || "DEFAULT";
        guestVotesMap[cat] = (guestVotesMap[cat] || 0) + 1;
      }
    });
  }

  const allEventsRes = handleGetAllEvents();

  return {
    status: "success",
    event: matchedEvent,
    categories: categories,
    guestStats: {
      uploadedPhotos: guestUploadedPhotos,
      remainingPhotos: Math.max(0, matchedEvent.maxFotoPerGuest - guestUploadedPhotos),
      guestVotesMap: guestVotesMap
    },
    allEvents: allEventsRes.events || [],
    metrics: allEventsRes.metrics,
    globalConfig: allEventsRes.globalConfig
  };
}

/**
 * GET GALLERY DENGAN SINKRONISASI OTOMATIS GOOGLE DRIVE
 * 1. Menghapus foto yang filenya sudah dihapus di Google Drive (023, 024)
 * 2. Mengingest foto yang ada di Google Drive tapi belum tercatat di Sheet (032, 033)
 */
function handleGetGallery(eventId, guestId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENT);
  const fotoSheet = ss.getSheetByName(SHEET_NAMES.FOTO);
  const voteSheet = ss.getSheetByName(SHEET_NAMES.VOTING);
  const katSheet = ss.getSheetByName(SHEET_NAMES.KATEGORI);

  let canonicalEventId = eventId;
  let isRevealed = true;
  let revealMode = "SEGERA";
  let folderId = "";
  let eventSlug = "";
  let eventName = "";

  if (eventSheet && eventSheet.getLastRow() > 1) {
    const evRows = eventSheet.getRange(2, 1, eventSheet.getLastRow() - 1, 15).getDisplayValues();
    let matchedEvRow = null;
    if (eventId && eventId !== "DEFAULT" && eventId !== "ACTIVE") {
      for (let i = 0; i < evRows.length; i++) {
        if (evRows[i][COL_EVENT.ID] === eventId || evRows[i][COL_EVENT.SLUG] === eventId) {
          matchedEvRow = evRows[i];
          break;
        }
      }
    }
    if (!matchedEvRow) {
      for (let i = 0; i < evRows.length; i++) {
        if (evRows[i][COL_EVENT.STATUS] === "AKTIF") {
          matchedEvRow = evRows[i];
          break;
        }
      }
    }
    if (!matchedEvRow && evRows.length > 0) {
      matchedEvRow = evRows[0];
    }
    if (matchedEvRow) {
      canonicalEventId = matchedEvRow[COL_EVENT.ID];
      revealMode = matchedEvRow[COL_EVENT.REVEAL_MODE] || "SEGERA";
      const revFlag = String(matchedEvRow[COL_EVENT.IS_REVEALED] || "").trim().toUpperCase();
      if (revFlag === "FALSE") {
        isRevealed = false;
      } else if (revFlag === "TRUE") {
        isRevealed = true;
      } else {
        isRevealed = (revealMode === "SEGERA");
      }
      folderId = extractDriveFolderId(matchedEvRow[COL_EVENT.GDRIVE_FOLDER_ID]);
      eventSlug = matchedEvRow[COL_EVENT.SLUG];
      eventName = matchedEvRow[COL_EVENT.NAMA];
    }
  }

  if (!isRevealed) {
    return {
      status: "locked",
      isRevealed: false,
      message: "Foto-foto sedang disimpan rapi di rol film! Galeri akan terbuka secara resmi setelah acara selesai.",
      photos: []
    };
  }

  // Multi-Folder Discovery: Cari candidate folder acara di Google Drive
  const candidateFolders = [];
  if (folderId) {
    try { candidateFolders.push(DriveApp.getFolderById(folderId)); } catch(e) {}
  }

  // Periksa subfolder di bawah Master Folder
  const configSheet = ss.getSheetByName(SHEET_NAMES.PENGATURAN);
  let masterFolderId = "12LfLW50HIuMUPCGQiRJKy_aO4RhVICjw";
  if (configSheet && configSheet.getLastRow() > 1) {
    const cRows = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 2).getDisplayValues();
    cRows.forEach(function(cr) {
      if (cr[0] === "master_drive_folder_id") masterFolderId = extractDriveFolderId(cr[1]) || masterFolderId;
    });
  }

  if (masterFolderId) {
    try {
      const masterF = DriveApp.getFolderById(masterFolderId);
      const searchNames = [
        eventSlug, 
        "SnapEvent_" + eventSlug, 
        eventName, 
        "SnapEvent_" + eventName.replace(/[^a-zA-Z0-9]/g, "_"),
        canonicalEventId,
        "ilham---sherwin"
      ];
      searchNames.forEach(function(name) {
        if (!name) return;
        const it = masterF.getFoldersByName(name);
        while (it.hasNext()) {
          const f = it.next();
          if (!candidateFolders.some(cf => cf.getId() === f.getId())) {
            candidateFolders.push(f);
          }
        }
      });
      // Cari jika ada folder yang memuat slug di namanya
      if (candidateFolders.length === 0 && eventSlug) {
        const allSubFolders = masterF.getFolders();
        while (allSubFolders.hasNext()) {
          const sf = allSubFolders.next();
          if (sf.getName().toLowerCase().indexOf(eventSlug.toLowerCase()) !== -1) {
            candidateFolders.push(sf);
          }
        }
      }
    } catch (e) {}
  }

  // 1. Sinkronisasi Google Drive & Spreadsheet DataFoto:
  // - Kumpulkan seluruh file yang aktif (bukan trashed) di folder acara Google Drive
  // - Deteksi dan bersihkan file kembar identik fisik di Google Drive
  // - Otomatis tambahkan file yang ada di Google Drive ke DataFoto jika belum tercatat
  const liveDriveFilesMap = new Map();
  const seenDriveSignatures = new Map(); // [nama_ukuran] -> fId

  candidateFolders.forEach(function(targetF) {
    try {
      const filesIter = targetF.getFiles();
      while (filesIter.hasNext()) {
        const file = filesIter.next();
        if (file.isTrashed()) continue;
        const fId = file.getId();
        const fName = file.getName();
        const lower = fName.toLowerCase();
        if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp') || fName.indexOf('FTO-') === 0) {
          const fSize = file.getSize();
          const signature = fName + "_" + fSize;
          // Jika ada file kembar identik dengan nama & ukuran sama persis di folder Drive, bersihkan salinan kedua
          if (seenDriveSignatures.has(signature)) {
            try { file.setTrashed(true); } catch(eTrash) {}
            continue;
          }
          seenDriveSignatures.set(signature, fId);
          liveDriveFilesMap.set(fId, {
            id: fId,
            name: fName,
            created: file.getDateCreated(),
            size: fSize
          });
        }
      }
    } catch (e) {}
  });

  const photos = [];
  const existingFileIds = new Set();
  const seenPhotoIds = new Set();
  const rowsToDelete = [];
  const timeZone = Session.getScriptTimeZone() || "Asia/Jakarta";
  const nowStr = Utilities.formatDate(new Date(), timeZone, "yyyy-MM-dd HH:mm:ss");

  if (fotoSheet && fotoSheet.getLastRow() > 1) {
    const fRows = fotoSheet.getRange(2, 1, fotoSheet.getLastRow() - 1, 12).getDisplayValues();
    for (let j = 0; j < fRows.length; j++) {
      const fr = fRows[j];
      const rowEventId = fr[COL_FOTO.ID_EVENT];
      if (rowEventId === eventId || rowEventId === canonicalEventId || rowEventId === eventSlug) {
        const fileId = String(fr[COL_FOTO.GDRIVE_FILE_ID] || "").trim();
        let fileExists = false;

        if (fileId) {
          if (liveDriveFilesMap.has(fileId)) {
            fileExists = true;
          } else {
            // Verifikasi langsung ke Drive jika file berada di luar subfolder kandidat
            try {
              const checkF = DriveApp.getFileById(fileId);
              if (checkF && !checkF.isTrashed()) {
                fileExists = true;
              }
            } catch (dErr) {
              fileExists = false;
            }
          }
        }

        if (fileExists) {
          existingFileIds.add(fileId);
          let uniqueId = fr[COL_FOTO.ID];
          if (seenPhotoIds.has(uniqueId)) {
            uniqueId = uniqueId + "-" + (fileId ? fileId.slice(-4) : (j + 1));
          }
          seenPhotoIds.add(uniqueId);

          photos.push({
            idFoto: uniqueId,
            guestNama: fr[COL_FOTO.GUEST_NAMA] || "Tamu",
            caption: fr[COL_FOTO.CAPTION] || "Momen seru!",
            cameraStyle: fr[COL_FOTO.CAMERA_STYLE] || "RAW",
            frameStyle: fr[COL_FOTO.FRAME_STYLE] || "POLAROID",
            gdriveViewUrl: fr[COL_FOTO.GDRIVE_VIEW_URL] || (fileId ? ("https://lh3.googleusercontent.com/d/" + fileId) : ""),
            totalLikes: Number(fr[COL_FOTO.TOTAL_LIKES]) || 0,
            isFeatured: fr[COL_FOTO.IS_FEATURED] === "TRUE" || fr[COL_FOTO.IS_FEATURED] === "true",
            createdAt: fr[COL_FOTO.CREATED_AT] || nowStr
          });
        } else {
          // File fisik tidak ditemukan di Google Drive -> Jangan tampilkan & bersihkan baris hantu dari DataFoto
          rowsToDelete.push(j + 2);
        }
      }
    }

    // Bersihkan baris hantu di DataFoto dari bawah ke atas agar indeks baris tidak bergeser
    if (rowsToDelete.length > 0) {
      for (let d = rowsToDelete.length - 1; d >= 0; d--) {
        try {
          fotoSheet.deleteRow(rowsToDelete[d]);
        } catch (delErr) {}
      }
      SpreadsheetApp.flush();
    }
  }

  // 2. Auto-ingest foto yang ada di Google Drive tapi belum ada di Spreadsheet
  liveDriveFilesMap.forEach(function(dfInfo, fId) {
    if (!existingFileIds.has(fId)) {
      try {
        const fObj = DriveApp.getFileById(fId);
        fObj.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (e) {}

      const directUrl = "https://lh3.googleusercontent.com/d/" + fId;
      const parts = dfInfo.name.split("_");
      let photoIdCandidate = (parts[0] && parts[0].indexOf("FTO-") === 0) ? parts[0] : ("FTO-" + Date.now());
      const guestCandidate = parts[1] ? parts[1].replace(/\.[^/.]+$/, "") : "Tamu";
      const createdDateStr = dfInfo.created ? Utilities.formatDate(dfInfo.created, timeZone, "yyyy-MM-dd HH:mm:ss") : nowStr;

      // JAMIN KEUNIKAN ID: Cegah bentrokan ID jika terdapat foto tamu lain dengan nomor sama (misal 033)
      if (seenPhotoIds.has(photoIdCandidate)) {
        photoIdCandidate = photoIdCandidate + "-" + fId.slice(-4);
      }
      seenPhotoIds.add(photoIdCandidate);

      if (fotoSheet) {
        fotoSheet.appendRow([
          sanitizeCellValue(photoIdCandidate),
          sanitizeCellValue(canonicalEventId),
          "GUEST-CLOUD",
          sanitizeCellValue(guestCandidate),
          "Momen seru!",
          "RAW",
          "POLAROID",
          sanitizeCellValue(fId),
          sanitizeCellValue(directUrl),
          0,
          false,
          createdDateStr
        ]);
      }

      photos.push({
        idFoto: photoIdCandidate,
        guestNama: guestCandidate,
        caption: "Momen seru!",
        cameraStyle: "RAW",
        frameStyle: "POLAROID",
        gdriveViewUrl: directUrl,
        totalLikes: 0,
        isFeatured: false,
        createdAt: createdDateStr
      });
      existingFileIds.add(fId);
    }
  });

  photos.reverse();

  // Riwayat vote tamu ini
  const votedPhotoIds = [];
  if (guestId && voteSheet && voteSheet.getLastRow() > 1) {
    const vRows = voteSheet.getRange(2, 1, voteSheet.getLastRow() - 1, 6).getDisplayValues();
    vRows.forEach(function(vr) {
      if (vr[COL_VOTE.ID_EVENT] === eventId && vr[COL_VOTE.GUEST_ID] === guestId) {
        votedPhotoIds.push(vr[COL_VOTE.ID_FOTO]);
      }
    });
  }

  // Kategori voting
  const categories = [];
  if (katSheet && katSheet.getLastRow() > 1) {
    const kRows = katSheet.getRange(2, 1, katSheet.getLastRow() - 1, 5).getDisplayValues();
    kRows.forEach(function(kr) {
      if (kr[COL_KAT.ID_EVENT] === eventId || kr[COL_KAT.ID_EVENT] === eventSlug) {
        categories.push({
          idKategori: kr[COL_KAT.ID],
          namaKategori: kr[COL_KAT.NAMA],
          deskripsi: kr[COL_KAT.DESKRIPSI],
          urutan: Number(kr[COL_KAT.URUTAN]) || 1
        });
      }
    });
  }

  return {
    status: "success",
    isRevealed: true,
    photos: photos,
    votedPhotoIds: votedPhotoIds,
    categories: categories
  };
}

function handleGetSlideshowPhotos(eventId) {
  const galRes = handleGetGallery(eventId, "");
  return {
    status: "success",
    photos: galRes.photos || [],
    categories: galRes.categories || []
  };
}

function handleGetGuestQuota(eventId, guestId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENT);
  const fotoSheet = ss.getSheetByName(SHEET_NAMES.FOTO);

  let maxFoto = 10;
  if (eventSheet && eventSheet.getLastRow() > 1) {
    const evRows = eventSheet.getRange(2, 1, eventSheet.getLastRow() - 1, 7).getDisplayValues();
    for (let i = 0; i < evRows.length; i++) {
      if (evRows[i][COL_EVENT.ID] === eventId || evRows[i][COL_EVENT.SLUG] === eventId) {
        maxFoto = Number(evRows[i][COL_EVENT.MAX_FOTO]) || 10;
        break;
      }
    }
  }

  let uploaded = 0;
  if (fotoSheet && fotoSheet.getLastRow() > 1) {
    const fRows = fotoSheet.getRange(2, 1, fotoSheet.getLastRow() - 1, 4).getDisplayValues();
    fRows.forEach(function(fr) {
      if (fr[COL_FOTO.ID_EVENT] === eventId && fr[COL_FOTO.GUEST_ID] === guestId) {
        uploaded++;
      }
    });
  }

  return {
    status: "success",
    maxFoto: maxFoto,
    uploaded: uploaded,
    remaining: Math.max(0, maxFoto - uploaded)
  };
}

function handleCleanDeletedPhotos(eventId) {
  return handleGetGallery(eventId, "");
}

// ================================================================================
// UPLOAD FOTO & FRAME KE GOOGLE DRIVE
// ================================================================================

function handleUploadPhoto(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (lockErr) {
    return { status: "error", message: "Server sedang sibuk memproses antrean foto, silakan coba sesaat lagi." };
  }

  try {
    const eventId = String(payload.eventId || "").trim();
    const guestId = String(payload.guestId || "").trim();
    const guestNama = String(payload.guestNama || "Tamu").trim();
    const caption = String(payload.caption || "").trim();
    const cameraStyle = String(payload.cameraStyle || "RAW").trim();
    const frameStyle = String(payload.frameStyle || "POLAROID").trim();
    const imageBase64 = payload.imageBase64 || "";

    if (!guestId || !imageBase64) {
      return { status: "error", message: "Parameter guestId dan gambar wajib diisi." };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENT);
    const fotoSheet = ss.getSheetByName(SHEET_NAMES.FOTO);

    if (!eventSheet || !fotoSheet) {
      return { status: "error", message: "Tabel database belum siap." };
    }

    if (eventSheet.getLastRow() <= 1) {
      return { status: "error", message: "Belum ada data event yang terdaftar." };
    }

    // 1. Cek Metadata Event & Resolusi Acara Aktif secara Defensif
    let targetEventRow = -1;
    let maxFoto = 10;
    let folderId = "";
    let namaEvent = "Event";
    let slugEvent = "";
    let canonicalEventId = eventId;

    const evRows = eventSheet.getRange(2, 1, eventSheet.getLastRow() - 1, 17).getDisplayValues();
    if (eventId && eventId !== "DEFAULT" && eventId !== "ACTIVE") {
      for (let i = 0; i < evRows.length; i++) {
        if (evRows[i][COL_EVENT.ID] === eventId || evRows[i][COL_EVENT.SLUG] === eventId) {
          canonicalEventId = evRows[i][COL_EVENT.ID];
          targetEventRow = i + 2;
          maxFoto = Number(evRows[i][COL_EVENT.MAX_FOTO]) || 10;
          folderId = extractDriveFolderId(evRows[i][COL_EVENT.GDRIVE_FOLDER_ID]);
          namaEvent = evRows[i][COL_EVENT.NAMA];
          slugEvent = evRows[i][COL_EVENT.SLUG];
          break;
        }
      }
    }

    // Fallback ke event berstatus AKTIF jika ID tidak cocok atau masih default client
    if (targetEventRow === -1) {
      for (let i = 0; i < evRows.length; i++) {
        if (evRows[i][COL_EVENT.STATUS] === "AKTIF") {
          canonicalEventId = evRows[i][COL_EVENT.ID];
          targetEventRow = i + 2;
          maxFoto = Number(evRows[i][COL_EVENT.MAX_FOTO]) || 10;
          folderId = extractDriveFolderId(evRows[i][COL_EVENT.GDRIVE_FOLDER_ID]);
          namaEvent = evRows[i][COL_EVENT.NAMA];
          slugEvent = evRows[i][COL_EVENT.SLUG];
          break;
        }
      }
    }

    // Fallback pamungkas ke baris event pertama
    if (targetEventRow === -1 && evRows.length > 0) {
      canonicalEventId = evRows[0][COL_EVENT.ID];
      targetEventRow = 2;
      maxFoto = Number(evRows[0][COL_EVENT.MAX_FOTO]) || 10;
      folderId = extractDriveFolderId(evRows[0][COL_EVENT.GDRIVE_FOLDER_ID]);
      namaEvent = evRows[0][COL_EVENT.NAMA];
      slugEvent = evRows[0][COL_EVENT.SLUG];
    }

    // Ekstraksi Base64 Data
    let pureBase64 = imageBase64;
    let mimeType = "image/jpeg";
    if (pureBase64.indexOf("data:") === 0) {
      const parts = pureBase64.split(",");
      const meta = parts[0];
      pureBase64 = parts[1];
      if (meta.indexOf("image/png") !== -1) mimeType = "image/png";
    }

    // Anti-Duplicate Idempotency Cache: Mencegah upload file kembar dari retry / auto-sync bersamaan
    const imgFingerprint = "UPL_" + canonicalEventId + "_" + guestId + "_" + pureBase64.length + "_" + pureBase64.substring(0, 32);
    const cache = CacheService.getScriptCache();
    const cachedResponse = cache.get(imgFingerprint);
    if (cachedResponse) {
      try {
        return JSON.parse(cachedResponse);
      } catch(e) {}
    }

    // 2. Validasi Kuota Foto Tamu & Deteksi Duplikasi Riwayat Upload Baru
    let currentGuestUploads = 0;
    if (fotoSheet.getLastRow() > 1) {
      const fRows = fotoSheet.getRange(2, 1, fotoSheet.getLastRow() - 1, 12).getDisplayValues();
      const nowMs = Date.now();
      for (let frIdx = 0; frIdx < fRows.length; frIdx++) {
        const fr = fRows[frIdx];
        const matchEv = (fr[COL_FOTO.ID_EVENT] === eventId || fr[COL_FOTO.ID_EVENT] === canonicalEventId || fr[COL_FOTO.ID_EVENT] === slugEvent);
        if (matchEv && fr[COL_FOTO.GUEST_ID] === guestId) {
          currentGuestUploads++;
          // Cek apakah tamu ini baru saja upload foto dengan caption sama dalam 3 menit terakhir
          const createdMs = fr[COL_FOTO.CREATED_AT] ? new Date(fr[COL_FOTO.CREATED_AT]).getTime() : 0;
          if (createdMs && Math.abs(nowMs - createdMs) < 180000 && fr[COL_FOTO.CAPTION] === caption) {
            const existingFileId = fr[COL_FOTO.GDRIVE_FILE_ID];
            if (existingFileId) {
              try {
                const existingFile = DriveApp.getFileById(existingFileId);
                if (existingFile && !existingFile.isTrashed()) {
                  const reuseRes = {
                    status: "success",
                    message: "Foto sudah tersimpan sebelumnya di rol acara!",
                    idFoto: fr[COL_FOTO.ID],
                    viewUrl: fr[COL_FOTO.GDRIVE_VIEW_URL] || ("https://lh3.googleusercontent.com/d/" + existingFileId),
                    remainingPhotos: Math.max(0, maxFoto - currentGuestUploads)
                  };
                  try { cache.put(imgFingerprint, JSON.stringify(reuseRes), 180); } catch(cErr) {}
                  return reuseRes;
                }
              } catch(eCheck) {}
            }
          }
        }
      }
    }

    if (currentGuestUploads >= maxFoto) {
      return {
        status: "limit_reached",
        message: "Rol kamera Anda untuk event ini sudah penuh (" + maxFoto + " foto). Nikmati pestanya!"
      };
    }

    // 3. Simpan File ke Google Drive (Dengan Smart Reuse, Mencegah Folder Kosong Dobel)
    const configSheet = ss.getSheetByName(SHEET_NAMES.PENGATURAN);
    let masterFolderId = "12LfLW50HIuMUPCGQiRJKy_aO4RhVICjw";
    if (configSheet && configSheet.getLastRow() > 1) {
      const cRows = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 2).getDisplayValues();
      cRows.forEach(function(cr) {
        if (cr[0] === "master_drive_folder_id") masterFolderId = extractDriveFolderId(cr[1]) || masterFolderId;
      });
    }

    let parentFolder = DriveApp.getRootFolder();
    if (masterFolderId) {
      try { parentFolder = DriveApp.getFolderById(masterFolderId); } catch(e) {}
    }

    let targetFolder;
    if (folderId && folderId.trim() !== "") {
      try { targetFolder = DriveApp.getFolderById(folderId); } catch(e) {}
    }
    if (!targetFolder) {
      targetFolder = getOrCreateEventSubFolder(parentFolder, canonicalEventId, slugEvent, namaEvent);
      // Simpan folderId baru ke DataEvent agar permintaan berikutnya memakai folder yang sama
      eventSheet.getRange(targetEventRow, COL_EVENT.GDRIVE_FOLDER_ID + 1).setValue(targetFolder.getId());
      SpreadsheetApp.flush();
    }

    const decodedBytes = Utilities.base64Decode(pureBase64);
    const timeZone = Session.getScriptTimeZone() || "Asia/Jakarta";
    const nowStr = Utilities.formatDate(new Date(), timeZone, "yyyy-MM-dd HH:mm:ss");
    const dateCompact = Utilities.formatDate(new Date(), timeZone, "yyyyMMdd");

    // Generator ID Foto Incremental Sekuensial Monotonik (Bebas Bentrokan ID)
    const newIdFoto = generateIncrementalPhotoId(fotoSheet, dateCompact, targetFolder);
    const cleanGuestName = guestNama.replace(/[^a-zA-Z0-9]/g, "") || "Tamu";
    const fileName = newIdFoto + "_" + cleanGuestName + ".jpg";

    // Cek apakah targetFolder sudah memiliki file dengan nama yang sama (Anti Double File Drive)
    let driveFile = null;
    const sameNamedFiles = targetFolder.getFilesByName(fileName);
    if (sameNamedFiles.hasNext()) {
      driveFile = sameNamedFiles.next();
    } else {
      const blob = Utilities.newBlob(decodedBytes, mimeType, fileName);
      driveFile = targetFolder.createFile(blob);
      try {
        driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch(eShare) {}
    }

    const fileId = driveFile.getId();
    const directViewUrl = "https://lh3.googleusercontent.com/d/" + fileId;

    // 4. Catat ke DataFoto dengan sanitasi mutlak & ID canonical
    fotoSheet.appendRow([
      sanitizeCellValue(newIdFoto),
      sanitizeCellValue(canonicalEventId),
      sanitizeCellValue(guestId),
      sanitizeCellValue(guestNama),
      sanitizeCellValue(caption),
      sanitizeCellValue(cameraStyle),
      sanitizeCellValue(frameStyle),
      sanitizeCellValue(fileId),
      sanitizeCellValue(directViewUrl),
      0,
      false,
      nowStr
    ]);

    SpreadsheetApp.flush();

    const resultSuccess = {
      status: "success",
      message: "Foto berhasil disimpan ke rol acara!",
      idFoto: newIdFoto,
      viewUrl: directViewUrl,
      remainingPhotos: Math.max(0, maxFoto - (currentGuestUploads + 1))
    };

    try {
      cache.put(imgFingerprint, JSON.stringify(resultSuccess), 180);
    } catch(eCache) {}

    return resultSuccess;
  } finally {
    lock.releaseLock();
  }
}

/**
 * UPLOAD CUSTOM FRAME PNG LANGSUNG KE GOOGLE DRIVE DENGAN SINGLE-FILE RETENTION
 */
function handleUploadCustomFrame(payload) {
  try {
    const eventId = String(payload.eventId || "").trim();
    const imageBase64 = payload.imageBase64 || "";

    if (!eventId || !imageBase64) {
      return { status: "error", message: "Parameter eventId dan gambar bingkai wajib diisi." };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENT);
    const configSheet = ss.getSheetByName(SHEET_NAMES.PENGATURAN);

    let masterFolderId = "12LfLW50HIuMUPCGQiRJKy_aO4RhVICjw";
    if (configSheet && configSheet.getLastRow() > 1) {
      const cRows = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 2).getDisplayValues();
      cRows.forEach(function(cr) {
        if (cr[0] === "master_drive_folder_id") masterFolderId = extractDriveFolderId(cr[1]) || masterFolderId;
      });
    }

    let parentFolder = DriveApp.getRootFolder();
    if (masterFolderId) {
      try { parentFolder = DriveApp.getFolderById(masterFolderId); } catch(e) {}
    }

    // Subfolder khusus frame
    const frameSubIter = parentFolder.getFoldersByName("SnapEvent_Custom_Frames");
    const targetFolder = frameSubIter.hasNext() ? frameSubIter.next() : parentFolder.createFolder("SnapEvent_Custom_Frames");
    try { targetFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e) {}

    // Hapus file frame lama untuk event ini agar tidak ada penumpukan
    const oldFiles = targetFolder.getFilesByName("FRAME_" + eventId + ".png");
    while (oldFiles.hasNext()) {
      try { oldFiles.next().setTrashed(true); } catch(e) {}
    }

    let pureBase64 = imageBase64;
    let mimeType = "image/png";
    if (pureBase64.indexOf("data:") === 0) {
      const parts = pureBase64.split(",");
      pureBase64 = parts[1];
    }

    const decodedBytes = Utilities.base64Decode(pureBase64);
    const blob = Utilities.newBlob(decodedBytes, mimeType, "FRAME_" + eventId + ".png");
    const newFile = targetFolder.createFile(blob);
    newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const directUrl = "https://lh3.googleusercontent.com/d/" + newFile.getId();

    // Simpan direct URL ke DataEvent kolom CUSTOM_FRAME_URL (Dukung match via ID atau Slug)
    if (eventSheet && eventSheet.getLastRow() > 1) {
      const evRows = eventSheet.getRange(2, 1, eventSheet.getLastRow() - 1, 3).getDisplayValues();
      for (let r = 0; r < evRows.length; r++) {
        if (evRows[r][COL_EVENT.ID] === eventId || evRows[r][COL_EVENT.SLUG] === eventId) {
          eventSheet.getRange(r + 2, COL_EVENT.CUSTOM_FRAME_URL + 1).setValue(directUrl);
          break;
        }
      }
      SpreadsheetApp.flush();
    }

    return {
      status: "success",
      fileId: newFile.getId(),
      customFrameUrl: directUrl
    };
  } catch (err) {
    return { status: "error", message: "Gagal upload frame: " + err.message };
  }
}

// ================================================================================
// VOTING DENGAN DUKUNGAN KATEGORI & 1 SUARA PER KATEGORI
// ================================================================================

function handleSubmitVote(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { status: "error", message: "Server sibuk, silakan coba sesaat lagi." };
  }

  try {
    const eventId = String(payload.eventId || "").trim();
    const idFoto = String(payload.idFoto || "").trim();
    const idKategori = String(payload.idKategori || "").trim();
    const guestId = String(payload.guestId || "").trim();
    const guestNama = String(payload.guestNama || "Tamu").trim();

    if (!eventId || !idFoto || !guestId) {
      return { status: "error", message: "Data voting tidak lengkap." };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const voteSheet = ss.getSheetByName(SHEET_NAMES.VOTING);
    const fotoSheet = ss.getSheetByName(SHEET_NAMES.FOTO);

    // Cek apakah tamu sudah memilih kategori ini sebelumnya (1x per kategori)
    let alreadyVotedCat = false;
    if (voteSheet && voteSheet.getLastRow() > 1) {
      const vRows = voteSheet.getRange(2, 1, voteSheet.getLastRow() - 1, 6).getDisplayValues();
      for (let j = 0; j < vRows.length; j++) {
        const vr = vRows[j];
        if (vr[COL_VOTE.ID_EVENT] === eventId && vr[COL_VOTE.GUEST_ID] === guestId) {
          if (idKategori && vr[COL_VOTE.ID_KAT] === idKategori) {
            alreadyVotedCat = true;
            break;
          }
        }
      }
    }

    if (alreadyVotedCat) {
      return {
        status: "already_voted",
        message: "Anda sudah memberikan voting pada kategori ini (Maksimal 1 suara per kategori)."
      };
    }

    // Tambah counter like di DataFoto
    let updatedLikes = 1;
    let targetFotoRow = -1;
    if (fotoSheet && fotoSheet.getLastRow() > 1) {
      const fRows = fotoSheet.getRange(2, 1, fotoSheet.getLastRow() - 1, 10).getDisplayValues();
      for (let k = 0; k < fRows.length; k++) {
        if (fRows[k][COL_FOTO.ID] === idFoto) {
          targetFotoRow = k + 2;
          updatedLikes = (Number(fRows[k][COL_FOTO.TOTAL_LIKES]) || 0) + 1;
          break;
        }
      }
    }

    if (targetFotoRow !== -1) {
      fotoSheet.getRange(targetFotoRow, COL_FOTO.TOTAL_LIKES + 1).setValue(updatedLikes);
    }

    // Catat ke DataVoting
    const timeZone = Session.getScriptTimeZone() || "Asia/Jakarta";
    const nowStr = Utilities.formatDate(new Date(), timeZone, "yyyy-MM-dd HH:mm:ss");
    const newIdVote = generateIncrementalId(voteSheet, "VOT-", COL_VOTE.ID);

    voteSheet.appendRow([
      sanitizeCellValue(newIdVote),
      sanitizeCellValue(eventId),
      sanitizeCellValue(idFoto),
      sanitizeCellValue(idKategori),
      sanitizeCellValue(guestId),
      sanitizeCellValue(guestNama),
      nowStr
    ]);

    SpreadsheetApp.flush();

    return {
      status: "success",
      message: "Suara Anda berhasil dicatat!",
      updatedLikes: updatedLikes,
      idKategori: idKategori,
      idFoto: idFoto
    };
  } finally {
    lock.releaseLock();
  }
}

// ================================================================================
// ADMIN OPERASIONAL & PENGATURAN GLOBAL
// ================================================================================

function handleAdminLogin(payload) {
  const username = String(payload.username || "").trim();
  const password = String(payload.password || "").trim();
  const pin = String(payload.pin || "").trim();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName(SHEET_NAMES.PENGATURAN);

  let expectedUser = "admin";
  let expectedPass = "admin123";
  let expectedPin = "889900";
  let userAccounts = [];

  if (configSheet && configSheet.getLastRow() > 1) {
    const rows = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 2).getDisplayValues();
    rows.forEach(function(r) {
      if (r[COL_CONFIG.KEY] === "admin_user") expectedUser = r[COL_CONFIG.VAL];
      if (r[COL_CONFIG.KEY] === "admin_pass") expectedPass = r[COL_CONFIG.VAL];
      if (r[COL_CONFIG.KEY] === "admin_pin") expectedPin = r[COL_CONFIG.VAL];
      if (r[COL_CONFIG.KEY] === "user_accounts") {
        userAccounts = parseJsonSafe(r[COL_CONFIG.VAL], []);
      }
    });
  }

  if ((username && password && username === expectedUser && password === expectedPass) || (pin && pin === expectedPin)) {
    return { status: "success", message: "Autentikasi Administrator Berhasil.", user: username || expectedUser, role: "admin" };
  }

  if (username && password && Array.isArray(userAccounts)) {
    for (let u = 0; u < userAccounts.length; u++) {
      const acc = userAccounts[u];
      if (acc && acc.user === username && acc.pass === password) {
        return {
          status: "success",
          message: "Autentikasi Akun " + (acc.role === "operator" ? "Operator Kru" : "User") + " Berhasil.",
          user: acc.user,
          role: acc.role || "operator"
        };
      }
    }
  }

  return { status: "error", message: "Username atau Password login salah!" };
}

function handleAdminGetSummary(pin) {
  const loginCheck = handleAdminLogin({ pin: pin });
  if (loginCheck.status !== "success") return loginCheck;
  return handleGetAllEvents();
}

function handleAdminSaveEvent(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { status: "error", message: "Server sibuk saat menyimpan event." };
  }

  try {
    const idEvent = String(payload.idEvent || payload.eventId || "").trim();
    const namaEvent = String(payload.namaEvent || "Event Baru").trim();
    const slugEvent = String(payload.slugEvent || createSlug(namaEvent)).trim();
    const tanggalEvent = String(payload.tanggalEvent || "").trim();
    const hashtagEvent = String(payload.hashtagEvent || "").trim();
    const maxFoto = Number(payload.maxFotoPerGuest) || 10;
    const maxVote = Number(payload.maxVotePerGuest) || 3;
    const revealMode = payload.revealMode === "SETELAH" ? "SETELAH" : "SEGERA";
    const isRevealed = payload.isRevealed !== undefined 
      ? (payload.isRevealed === true || payload.isRevealed === "true" || payload.isRevealed === "TRUE")
      : (revealMode === "SEGERA");
    const likeEnabled = payload.likeEnabled !== false && payload.likeEnabled !== "false";
    const publicVisible = payload.publicVisible !== false && payload.publicVisible !== "false";
    const cameraStyles = JSON.stringify(payload.activeCameraStyles || ["RAW", "800T", "WARM", "BW"]);
    const framesObj = {
      mode: payload.frameLockMode || "multi",
      locked: payload.singleLockedFrame || "GOLD_DECO",
      frames: Array.isArray(payload.activeFrames) ? payload.activeFrames : ["GOLD_DECO", "POLAROID", "MINIMAL"]
    };
    const frames = JSON.stringify(framesObj);
    let folderId = payload.gdriveFolderId ? extractDriveFolderId(payload.gdriveFolderId) : "";
    let customFrameUrl = String(payload.customFrameUrl || "").trim();

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENT);
    const katSheet = ss.getSheetByName(SHEET_NAMES.KATEGORI);
    const configSheet = ss.getSheetByName(SHEET_NAMES.PENGATURAN);

    // Pastikan folder acara ada di Drive
    let masterFolderId = "12LfLW50HIuMUPCGQiRJKy_aO4RhVICjw";
    if (configSheet && configSheet.getLastRow() > 1) {
      const cRows = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 2).getDisplayValues();
      cRows.forEach(function(cr) {
        if (cr[0] === "master_drive_folder_id") masterFolderId = extractDriveFolderId(cr[1]) || masterFolderId;
      });
    }

    let parentFolder = DriveApp.getRootFolder();
    if (masterFolderId) {
      try { parentFolder = DriveApp.getFolderById(masterFolderId); } catch(e) {}
    }

    if (!folderId) {
      try {
        const eventFolder = getOrCreateEventSubFolder(parentFolder, idEvent, slugEvent, namaEvent);
        folderId = eventFolder.getId();
      } catch (dErr) {
        Logger.log("Drive folder warn: " + dErr.message);
      }
    }

    // Sanitasi customFrameUrl: jika base64, simpan sebagai file PNG ke Drive
    if (customFrameUrl && customFrameUrl.indexOf("data:image/") === 0) {
      try {
        const frameRes = handleUploadCustomFrame({ eventId: idEvent || slugEvent, imageBase64: customFrameUrl });
        if (frameRes && frameRes.customFrameUrl) {
          customFrameUrl = frameRes.customFrameUrl;
        } else {
          customFrameUrl = "";
        }
      } catch (fErr) {
        customFrameUrl = "";
      }
    }

    const timeZone = Session.getScriptTimeZone() || "Asia/Jakarta";
    const nowStr = Utilities.formatDate(new Date(), timeZone, "yyyy-MM-dd HH:mm:ss");
    const ymStr = Utilities.formatDate(new Date(), timeZone, "yyyyMM");

    let savedIdEvent = idEvent;

    if (!idEvent) {
      // INSERT EVENT BARU (17 Kolom)
      savedIdEvent = generateIncrementalId(eventSheet, "EVT-" + ymStr + "-", COL_EVENT.ID);
      eventSheet.appendRow([
        sanitizeCellValue(savedIdEvent),
        sanitizeCellValue(namaEvent),
        sanitizeCellValue(slugEvent),
        sanitizeCellValue(tanggalEvent),
        sanitizeCellValue(hashtagEvent),
        maxFoto,
        maxVote,
        revealMode,
        isRevealed,
        likeEnabled,
        publicVisible,
        sanitizeCellValue(cameraStyles),
        sanitizeCellValue(frames),
        sanitizeCellValue(folderId),
        "AKTIF",
        nowStr,
        sanitizeCellValue(customFrameUrl, 500)
      ]);
    } else {
      // UPDATE EVENT EKSISTING (17 Kolom)
      let targetRow = -1;
      const rows = eventSheet.getRange(2, 1, eventSheet.getLastRow() - 1, 3).getDisplayValues();
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][COL_EVENT.ID] === idEvent || rows[i][COL_EVENT.SLUG] === idEvent || (slugEvent && rows[i][COL_EVENT.SLUG] === slugEvent)) {
          targetRow = i + 2;
          break;
        }
      }

      if (targetRow !== -1) {
        const updateRange = eventSheet.getRange(targetRow, 1, 1, 17);
        const curVals = updateRange.getValues()[0];
        updateRange.setValues([[
          sanitizeCellValue(idEvent),
          sanitizeCellValue(namaEvent),
          sanitizeCellValue(slugEvent),
          sanitizeCellValue(tanggalEvent),
          sanitizeCellValue(hashtagEvent),
          maxFoto,
          maxVote,
          revealMode,
          isRevealed,
          likeEnabled,
          publicVisible,
          sanitizeCellValue(cameraStyles),
          sanitizeCellValue(frames),
          sanitizeCellValue(folderId || curVals[COL_EVENT.GDRIVE_FOLDER_ID]),
          curVals[COL_EVENT.STATUS] || "AKTIF",
          curVals[COL_EVENT.CREATED_AT] || nowStr,
          sanitizeCellValue(customFrameUrl || curVals[COL_EVENT.CUSTOM_FRAME_URL], 500)
        ]]);
      }
    }

    // Simpan Kategori Acara
    const categories = payload.categories || [];
    if (katSheet && Array.isArray(categories)) {
      if (idEvent && katSheet.getLastRow() > 1) {
        const kRows = katSheet.getRange(2, 1, katSheet.getLastRow() - 1, 2).getDisplayValues();
        for (let kr = kRows.length - 1; kr >= 0; kr--) {
          if (kRows[kr][COL_KAT.ID_EVENT] === savedIdEvent || kRows[kr][COL_KAT.ID_EVENT] === slugEvent) {
            katSheet.deleteRow(kr + 2);
          }
        }
      }
      categories.forEach(function(cat, idx) {
        const catName = typeof cat === "string" ? cat : (cat.namaKategori || cat.name);
        if (catName && catName.trim() !== "") {
          const newIdKat = generateIncrementalId(katSheet, "KAT-", COL_KAT.ID);
          katSheet.appendRow([
            sanitizeCellValue(newIdKat),
            sanitizeCellValue(savedIdEvent),
            sanitizeCellValue(catName.trim()),
            sanitizeCellValue(cat.deskripsi || "Kategori Pilihan Tamu"),
            idx + 1
          ]);
        }
      });
    }

    SpreadsheetApp.flush();

    return {
      status: "success",
      message: "Event '" + namaEvent + "' berhasil disimpan!",
      idEvent: savedIdEvent,
      gdriveFolderId: folderId,
      customFrameUrl: customFrameUrl
    };
  } finally {
    lock.releaseLock();
  }
}

function handleAdminToggleReveal(payload) {
  const eventId = String(payload.eventId || payload.idEvent || "").trim();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENT);

  if (!eventSheet || eventSheet.getLastRow() <= 1) {
    return { status: "error", message: "Sheet DataEvent kosong." };
  }

  const rows = eventSheet.getRange(2, 1, eventSheet.getLastRow() - 1, 15).getDisplayValues();
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][COL_EVENT.ID] === eventId || rows[i][COL_EVENT.SLUG] === eventId) {
      const cur = rows[i][COL_EVENT.IS_REVEALED];
      let newVal;
      if (payload.isRevealed !== undefined && payload.isRevealed !== null) {
        newVal = (payload.isRevealed === true || payload.isRevealed === "true" || payload.isRevealed === "TRUE");
      } else {
        newVal = (cur === "TRUE" || cur === "true") ? false : true;
      }

      eventSheet.getRange(i + 2, COL_EVENT.IS_REVEALED + 1).setValue(newVal ? "TRUE" : "FALSE");
      eventSheet.getRange(i + 2, COL_EVENT.REVEAL_MODE + 1).setValue(newVal ? "SEGERA" : "SETELAH");
      SpreadsheetApp.flush();

      return {
        status: "success",
        idEvent: rows[i][COL_EVENT.ID],
        isRevealed: newVal,
        revealMode: newVal ? "SEGERA" : "SETELAH",
        message: newVal ? "Galeri foto resmi DIBUKA untuk tamu!" : "Galeri foto resmi DIKUNCI (ditahan)."
      };
    }
  }

  return { status: "error", message: "Event ID '" + eventId + "' tidak ditemukan." };
}

function handleAdminSetActiveEvent(payload) {
  const idEvent = String(payload.idEvent || payload.eventId || "").trim();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENT);

  if (!eventSheet || eventSheet.getLastRow() <= 1) {
    return { status: "error", message: "Sheet DataEvent kosong." };
  }

  const totalRows = eventSheet.getLastRow() - 1;
  const rows = eventSheet.getRange(2, 1, totalRows, 15).getDisplayValues();

  for (let i = 0; i < rows.length; i++) {
    const isTarget = (rows[i][COL_EVENT.ID] === idEvent || rows[i][COL_EVENT.SLUG] === idEvent);
    eventSheet.getRange(i + 2, COL_EVENT.STATUS + 1).setValue(isTarget ? "AKTIF" : "INAKTIF");
  }

  SpreadsheetApp.flush();
  return { status: "success", idEvent: idEvent, message: "Event '" + idEvent + "' sekarang aktif!" };
}

function handleAdminUpdateGlobalConfig(payload) {
  const updates = payload.updates || {};
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName(SHEET_NAMES.PENGATURAN);

  if (!configSheet) {
    return { status: "error", message: "Sheet Config tidak ditemukan." };
  }

  const keys = Object.keys(updates);
  if (keys.length === 0) {
    return { status: "error", message: "Tidak ada data konfigurasi yang diupdate." };
  }

  const existingMap = {};
  if (configSheet.getLastRow() > 1) {
    const rows = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 2).getDisplayValues();
    rows.forEach(function(r, idx) {
      existingMap[r[COL_CONFIG.KEY]] = idx + 2;
    });
  }

  keys.forEach(function(k) {
    const val = sanitizeCellValue(updates[k], 45000);
    if (existingMap[k]) {
      configSheet.getRange(existingMap[k], COL_CONFIG.VAL + 1).setValue(val);
    } else {
      configSheet.appendRow([k, val, "Updated via Web Admin"]);
    }
  });

  SpreadsheetApp.flush();
  return { status: "success", message: "Konfigurasi global berhasil disimpan ke Google Sheets." };
}
