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
 * 5. CORS Friendly JSON Output untuk dikonsumsi Frontend SPA.
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

/**
 * Helper Output JSON dengan Header CORS Terbuka
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * HTTP GET Router: Melayani pembacaan data (Events, Galeri, Status, Quota)
 */
function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const action = params.action || "ping";

    if (action === "ping") {
      return createJsonResponse({
        status: "success",
        message: "SnapEvent Backend API Online & Siap Digunakan",
        timestamp: new Date().toISOString()
      });
    }

    if (action === "getInitialData") {
      return createJsonResponse(handleGetInitialData());
    }

    if (action === "getAllEvents" || action === "adminGetEvents") {
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

    if (action === "adminGetSummary") {
      const pin = params.pin || "";
      return createJsonResponse(handleAdminGetSummary(pin));
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
 * HTTP POST Router: Melayani mutasi data (Upload Foto, Submit Vote, Admin Ops)
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
// HANDLER BUSINESS LOGIC: GUEST & EVENT
// ================================================================================

function handleGetInitialData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENT);
  const configSheet = ss.getSheetByName(SHEET_NAMES.PENGATURAN);

  if (!eventSheet) {
    return { status: "error", message: "Database belum diinisialisasi. Jalankan inisialisasiDatabase() di setup.gs" };
  }

  // Ambil Konfigurasi Global
  const configMap = {};
  if (configSheet && configSheet.getLastRow() > 1) {
    const configRows = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 3).getDisplayValues();
    configRows.forEach(function(r) {
      configMap[r[COL_CONFIG.KEY]] = r[COL_CONFIG.VAL];
    });
  }

  // Ambil Semua Daftar Event untuk Sinkronisasi Multi-Event
  const events = [];
  if (eventSheet.getLastRow() > 1) {
    const rows = eventSheet.getRange(2, 1, eventSheet.getLastRow() - 1, 17).getDisplayValues();
    rows.forEach(function(r) {
      if (r[COL_EVENT.ID]) {
        events.push({
          idEvent: r[COL_EVENT.ID],
          namaEvent: r[COL_EVENT.NAMA] || "Acara",
          slugEvent: r[COL_EVENT.SLUG] || createSlug(r[COL_EVENT.NAMA] || ""),
          tanggalEvent: r[COL_EVENT.TANGGAL] || "",
          hashtagEvent: r[COL_EVENT.HASHTAG] || "",
          maxFotoPerGuest: Number(r[COL_EVENT.MAX_FOTO]) || 10,
          maxVotePerGuest: Number(r[COL_EVENT.MAX_VOTE]) || 3,
          revealMode: r[COL_EVENT.REVEAL_MODE] || "SEGERA",
          isRevealed: r[COL_EVENT.IS_REVEALED] === "TRUE" || r[COL_EVENT.IS_REVEALED] === "true",
          likeEnabled: r[COL_EVENT.LIKE_ENABLED] !== "FALSE" && r[COL_EVENT.LIKE_ENABLED] !== "false",
          publicVisible: r[COL_EVENT.PUBLIC_VISIBLE] !== "FALSE" && r[COL_EVENT.PUBLIC_VISIBLE] !== "false",
          activeCameraStyles: parseJsonSafe(r[COL_EVENT.CAMERA_STYLES], ["RAW", "800T", "WARM", "BW"]),
          activeFrames: parseJsonSafe(r[COL_EVENT.FRAMES], ["GOLD_DECO", "POLAROID", "MINIMAL"]),
          gdriveFolderId: r[COL_EVENT.GDRIVE_FOLDER_ID] || "",
          statusEvent: r[COL_EVENT.STATUS] || "INAKTIF",
          customFrameUrl: r[COL_EVENT.CUSTOM_FRAME_URL] || ""
        });
      }
    });
  }

  return {
    status: "success",
    appTitle: configMap["app_title"] || "SnapEvent Enterprise Studio",
    globalConfig: configMap,
    events: events,
    allEvents: events
  };
}

function handleGetAllEvents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENT);
  const configSheet = ss.getSheetByName(SHEET_NAMES.PENGATURAN);

  if (!eventSheet || eventSheet.getLastRow() <= 1) {
    return { status: "success", events: [], totalEvents: 0 };
  }

  const events = [];
  const rows = eventSheet.getRange(2, 1, eventSheet.getLastRow() - 1, 17).getDisplayValues();
  rows.forEach(function(r) {
    if (r[COL_EVENT.ID]) {
      events.push({
        idEvent: r[COL_EVENT.ID],
        namaEvent: r[COL_EVENT.NAMA] || "Acara",
        slugEvent: r[COL_EVENT.SLUG] || createSlug(r[COL_EVENT.NAMA] || ""),
        tanggalEvent: r[COL_EVENT.TANGGAL] || "",
        hashtagEvent: r[COL_EVENT.HASHTAG] || "",
        maxFotoPerGuest: Number(r[COL_EVENT.MAX_FOTO]) || 10,
        maxVotePerGuest: Number(r[COL_EVENT.MAX_VOTE]) || 3,
        revealMode: r[COL_EVENT.REVEAL_MODE] || "SEGERA",
        isRevealed: r[COL_EVENT.IS_REVEALED] === "TRUE" || r[COL_EVENT.IS_REVEALED] === "true",
        likeEnabled: r[COL_EVENT.LIKE_ENABLED] !== "FALSE" && r[COL_EVENT.LIKE_ENABLED] !== "false",
        publicVisible: r[COL_EVENT.PUBLIC_VISIBLE] !== "FALSE" && r[COL_EVENT.PUBLIC_VISIBLE] !== "false",
        activeCameraStyles: parseJsonSafe(r[COL_EVENT.CAMERA_STYLES], ["RAW", "800T", "WARM", "BW"]),
        activeFrames: parseJsonSafe(r[COL_EVENT.FRAMES], ["GOLD_DECO", "POLAROID", "MINIMAL"]),
        gdriveFolderId: r[COL_EVENT.GDRIVE_FOLDER_ID] || "",
        statusEvent: r[COL_EVENT.STATUS] || "INAKTIF",
        customFrameUrl: r[COL_EVENT.CUSTOM_FRAME_URL] || ""
      });
    }
  });

  const globalConfig = {};
  if (configSheet && configSheet.getLastRow() > 1) {
    const cRows = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 2).getDisplayValues();
    cRows.forEach(function(r) {
      globalConfig[r[COL_CONFIG.KEY]] = r[COL_CONFIG.VAL];
    });
  }

  return {
    status: "success",
    events: events,
    totalEvents: events.length,
    globalConfig: globalConfig
  };
}

function handleGetEventDetails(eventId, guestId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENT);
  const fotoSheet = ss.getSheetByName(SHEET_NAMES.FOTO);
  const katSheet = ss.getSheetByName(SHEET_NAMES.KATEGORI);
  const voteSheet = ss.getSheetByName(SHEET_NAMES.VOTING);

  if (!eventSheet || eventSheet.getLastRow() <= 1) {
    return { status: "error", message: "Event tidak ditemukan" };
  }

  const rows = eventSheet.getRange(2, 1, eventSheet.getLastRow() - 1, 17).getDisplayValues();
  let eventData = null;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r[COL_EVENT.ID] === eventId || r[COL_EVENT.SLUG] === eventId) {
      eventData = {
        idEvent: r[COL_EVENT.ID],
        namaEvent: r[COL_EVENT.NAMA],
        slugEvent: r[COL_EVENT.SLUG],
        tanggalEvent: r[COL_EVENT.TANGGAL],
        hashtagEvent: r[COL_EVENT.HASHTAG],
        maxFotoPerGuest: Number(r[COL_EVENT.MAX_FOTO]) || 10,
        maxVotePerGuest: Number(r[COL_EVENT.MAX_VOTE]) || 3,
        revealMode: r[COL_EVENT.REVEAL_MODE],
        isRevealed: r[COL_EVENT.IS_REVEALED] === "TRUE" || r[COL_EVENT.IS_REVEALED] === "true",
        likeEnabled: r[COL_EVENT.LIKE_ENABLED] !== "FALSE" && r[COL_EVENT.LIKE_ENABLED] !== "false",
        publicVisible: r[COL_EVENT.PUBLIC_VISIBLE] !== "FALSE" && r[COL_EVENT.PUBLIC_VISIBLE] !== "false",
        activeCameraStyles: parseJsonSafe(r[COL_EVENT.CAMERA_STYLES], ["RAW", "800T", "WARM", "BW"]),
        activeFrames: parseJsonSafe(r[COL_EVENT.FRAMES], ["GOLD_DECO", "POLAROID", "MINIMAL"]),
        customFrameUrl: r[COL_EVENT.CUSTOM_FRAME_URL] || "",
        statusEvent: r[COL_EVENT.STATUS]
      };
      break;
    }
  }

  if (!eventData) {
    return { status: "error", message: "Event tidak ditemukan atau sudah tidak aktif" };
  }

  // Hitung jumlah foto yang sudah diupload oleh guestId ini
  let guestPhotoCount = 0;
  if (guestId && fotoSheet && fotoSheet.getLastRow() > 1) {
    const fRows = fotoSheet.getRange(2, 1, fotoSheet.getLastRow() - 1, 4).getDisplayValues();
    fRows.forEach(function(fr) {
      if (fr[COL_FOTO.ID_EVENT] === eventData.idEvent && fr[COL_FOTO.GUEST_ID] === guestId) {
        guestPhotoCount++;
      }
    });
  }

  // Ambil Kategori Voting untuk Event Ini
  const categories = [];
  if (katSheet && katSheet.getLastRow() > 1) {
    const kRows = katSheet.getRange(2, 1, katSheet.getLastRow() - 1, 5).getDisplayValues();
    kRows.forEach(function(kr) {
      if (kr[COL_KAT.ID_EVENT] === eventData.idEvent) {
        categories.push({
          idKategori: kr[COL_KAT.ID],
          namaKategori: kr[COL_KAT.NAMA],
          deskripsi: kr[COL_KAT.DESKRIPSI],
          urutan: Number(kr[COL_KAT.URUTAN]) || 1
        });
      }
    });
    categories.sort(function(a, b) { return a.urutan - b.urutan; });
  }

  // Hitung Kuota Voting yang Sudah Digunakan oleh Guest
  const guestVotesMap = {}; // idKategori -> count
  if (guestId && voteSheet && voteSheet.getLastRow() > 1) {
    const vRows = voteSheet.getRange(2, 1, voteSheet.getLastRow() - 1, 5).getDisplayValues();
    vRows.forEach(function(vr) {
      if (vr[COL_VOTE.ID_EVENT] === eventData.idEvent && vr[COL_VOTE.GUEST_ID] === guestId) {
        const catId = vr[COL_VOTE.ID_KAT];
        guestVotesMap[catId] = (guestVotesMap[catId] || 0) + 1;
      }
    });
  }

  // Ambil Pengaturan Global
  const configSheet = ss.getSheetByName(SHEET_NAMES.PENGATURAN);
  const globalConfig = {};
  if (configSheet && configSheet.getLastRow() > 1) {
    const cRows = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 2).getDisplayValues();
    cRows.forEach(function(r) {
      globalConfig[r[COL_CONFIG.KEY]] = r[COL_CONFIG.VAL];
    });
  }

  // Ambil Semua Event Ringkas untuk Sinkronisasi Multi-Event
  const allEvents = [];
  for (let eIdx = 0; eIdx < rows.length; eIdx++) {
    const er = rows[eIdx];
    if (er[COL_EVENT.ID]) {
      allEvents.push({
        idEvent: er[COL_EVENT.ID],
        namaEvent: er[COL_EVENT.NAMA] || "Acara",
        slugEvent: er[COL_EVENT.SLUG] || createSlug(er[COL_EVENT.NAMA] || ""),
        tanggalEvent: er[COL_EVENT.TANGGAL] || "",
        hashtagEvent: er[COL_EVENT.HASHTAG] || "",
        maxFotoPerGuest: Number(er[COL_EVENT.MAX_FOTO]) || 10,
        maxVotePerGuest: Number(er[COL_EVENT.MAX_VOTE]) || 3,
        revealMode: er[COL_EVENT.REVEAL_MODE] || "SEGERA",
        isRevealed: er[COL_EVENT.IS_REVEALED] === "TRUE" || er[COL_EVENT.IS_REVEALED] === "true",
        likeEnabled: er[COL_EVENT.LIKE_ENABLED] !== "FALSE" && er[COL_EVENT.LIKE_ENABLED] !== "false",
        publicVisible: er[COL_EVENT.PUBLIC_VISIBLE] !== "FALSE" && er[COL_EVENT.PUBLIC_VISIBLE] !== "false",
        gdriveFolderId: er[COL_EVENT.GDRIVE_FOLDER_ID] || "",
        statusEvent: er[COL_EVENT.STATUS] || "INAKTIF",
        customFrameUrl: er[COL_EVENT.CUSTOM_FRAME_URL] || ""
      });
    }
  }

  return {
    status: "success",
    event: eventData,
    allEvents: allEvents,
    globalConfig: globalConfig,
    guestStats: {
      guestPhotoCount: guestPhotoCount,
      remainingPhotos: Math.max(0, eventData.maxFotoPerGuest - guestPhotoCount),
      guestVotesMap: guestVotesMap
    },
    categories: categories
  };
}

function handleGetGallery(eventId, guestId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENT);
  const fotoSheet = ss.getSheetByName(SHEET_NAMES.FOTO);
  const voteSheet = ss.getSheetByName(SHEET_NAMES.VOTING);

  // Ambil info status reveal event
  let isRevealed = true;
  let revealMode = "SEGERA";
  let likeEnabled = true;

  if (eventSheet && eventSheet.getLastRow() > 1) {
    const evRows = eventSheet.getRange(2, 1, eventSheet.getLastRow() - 1, 10).getDisplayValues();
    for (let i = 0; i < evRows.length; i++) {
      if (evRows[i][COL_EVENT.ID] === eventId || evRows[i][COL_EVENT.SLUG] === eventId) {
        revealMode = evRows[i][COL_EVENT.REVEAL_MODE];
        const revFlag = evRows[i][COL_EVENT.IS_REVEALED];
        isRevealed = (revFlag === "TRUE" || revFlag === "true" || revealMode === "SEGERA");
        likeEnabled = evRows[i][COL_EVENT.LIKE_ENABLED] !== "FALSE" && evRows[i][COL_EVENT.LIKE_ENABLED] !== "false";
        break;
      }
    }
  }

  // Jika revealMode adalah SETELAH dan admin belum klik reveal, kunci galeri untuk publik
  if (!isRevealed) {
    return {
      status: "locked",
      isRevealed: false,
      message: "Foto-foto sedang disimpan rapi di rol film! Galeri akan terbuka secara resmi setelah acara selesai.",
      photos: []
    };
  }

  // Ambil daftar foto
  const photos = [];
  if (fotoSheet && fotoSheet.getLastRow() > 1) {
    const fRows = fotoSheet.getRange(2, 1, fotoSheet.getLastRow() - 1, 12).getDisplayValues();
    for (let j = 0; j < fRows.length; j++) {
      const fr = fRows[j];
      if (fr[COL_FOTO.ID_EVENT] === eventId) {
        photos.push({
          idFoto: fr[COL_FOTO.ID],
          guestNama: fr[COL_FOTO.GUEST_NAMA],
          caption: fr[COL_FOTO.CAPTION],
          cameraStyle: fr[COL_FOTO.CAMERA_STYLE],
          frameStyle: fr[COL_FOTO.FRAME_STYLE],
          gdriveViewUrl: fr[COL_FOTO.GDRIVE_VIEW_URL],
          totalLikes: Number(fr[COL_FOTO.TOTAL_LIKES]) || 0,
          isFeatured: fr[COL_FOTO.IS_FEATURED] === "TRUE" || fr[COL_FOTO.IS_FEATURED] === "true",
          createdAt: fr[COL_FOTO.CREATED_AT]
        });
      }
    }
  }

  // Balik urutan agar foto terbaru tampil di paling atas
  photos.reverse();

  // Ambil riwayat foto yang sudah divote oleh guest ini
  const votedPhotoIds = [];
  if (guestId && voteSheet && voteSheet.getLastRow() > 1) {
    const vRows = voteSheet.getRange(2, 1, voteSheet.getLastRow() - 1, 6).getDisplayValues();
    vRows.forEach(function(vr) {
      if (vr[COL_VOTE.ID_EVENT] === eventId && vr[COL_VOTE.GUEST_ID] === guestId) {
        votedPhotoIds.push(vr[COL_VOTE.ID_FOTO]);
      }
    });
  }

  return {
    status: "success",
    isRevealed: true,
    likeEnabled: likeEnabled,
    photos: photos,
    votedPhotoIds: votedPhotoIds
  };
}

function handleGetSlideshowPhotos(eventId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const fotoSheet = ss.getSheetByName(SHEET_NAMES.FOTO);
  const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENT);

  let hashtag = "#SnapEvent";
  let namaEvent = "Live Event Gallery";

  if (eventSheet && eventSheet.getLastRow() > 1) {
    const evRows = eventSheet.getRange(2, 1, eventSheet.getLastRow() - 1, 5).getDisplayValues();
    for (let i = 0; i < evRows.length; i++) {
      if (evRows[i][COL_EVENT.ID] === eventId || evRows[i][COL_EVENT.SLUG] === eventId) {
        namaEvent = evRows[i][COL_EVENT.NAMA];
        hashtag = evRows[i][COL_EVENT.HASHTAG];
        break;
      }
    }
  }

  const photos = [];
  if (fotoSheet && fotoSheet.getLastRow() > 1) {
    const fRows = fotoSheet.getRange(2, 1, fotoSheet.getLastRow() - 1, 12).getDisplayValues();
    for (let j = 0; j < fRows.length; j++) {
      const fr = fRows[j];
      if (fr[COL_FOTO.ID_EVENT] === eventId) {
        photos.push({
          idFoto: fr[COL_FOTO.ID],
          guestNama: fr[COL_FOTO.GUEST_NAMA],
          caption: fr[COL_FOTO.CAPTION],
          gdriveViewUrl: fr[COL_FOTO.GDRIVE_VIEW_URL],
          createdAt: fr[COL_FOTO.CREATED_AT]
        });
      }
    }
  }

  photos.reverse();

  return {
    status: "success",
    namaEvent: namaEvent,
    hashtag: hashtag,
    photos: photos
  };
}

// ================================================================================
// UPLOAD FOTO KE GOOGLE DRIVE & SIMPAN DATABASE
// ================================================================================

function handleUploadPhoto(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000); // Kunci agar perhitungan kuota dan ID aman dari tabrakan
  } catch (lockErr) {
    return { status: "error", message: "Server sibuk, silakan coba upload lagi." };
  }

  try {
    const eventId = String(payload.eventId || "").trim();
    const guestId = String(payload.guestId || "").trim();
    const guestNama = String(payload.guestNama || "Tamu").trim();
    const caption = String(payload.caption || "").trim();
    const cameraStyle = String(payload.cameraStyle || "RAW").trim();
    const frameStyle = String(payload.frameStyle || "POLAROID").trim();
    const imageBase64 = payload.imageBase64 || "";

    if (!eventId || !guestId || !imageBase64) {
      return { status: "error", message: "Parameter eventId, guestId, dan gambar wajib diisi." };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENT);
    const fotoSheet = ss.getSheetByName(SHEET_NAMES.FOTO);

    if (!eventSheet || !fotoSheet) {
      return { status: "error", message: "Tabel database belum siap." };
    }

    // 1. Cek Metadata Event & Batas Kuota
    let targetEventRow = -1;
    let maxFoto = 10;
    let folderId = "";
    let namaEvent = "Event";

    if (eventSheet.getLastRow() <= 1) {
      return { status: "error", message: "Belum ada data event yang terdaftar." };
    }

    const evRows = eventSheet.getRange(2, 1, eventSheet.getLastRow() - 1, 17).getDisplayValues();
    for (let i = 0; i < evRows.length; i++) {
      if (evRows[i][COL_EVENT.ID] === eventId || evRows[i][COL_EVENT.SLUG] === eventId) {
        targetEventRow = i + 2;
        maxFoto = Number(evRows[i][COL_EVENT.MAX_FOTO]) || 10;
        folderId = extractDriveFolderId(evRows[i][COL_EVENT.GDRIVE_FOLDER_ID]);
        if (!folderId && payload.folderId) {
          folderId = extractDriveFolderId(payload.folderId);
        }
        namaEvent = evRows[i][COL_EVENT.NAMA];
        break;
      }
    }

    if (targetEventRow === -1) {
      return { status: "error", message: "Event tidak valid atau belum terdaftar." };
    }

    // 2. Validasi Kuota Foto Tamu
    let currentGuestUploads = 0;
    if (fotoSheet.getLastRow() > 1) {
      const fRows = fotoSheet.getRange(2, 1, fotoSheet.getLastRow() - 1, 4).getDisplayValues();
      fRows.forEach(function(fr) {
        if (fr[COL_FOTO.ID_EVENT] === eventId && fr[COL_FOTO.GUEST_ID] === guestId) {
          currentGuestUploads++;
        }
      });
    }

    if (currentGuestUploads >= maxFoto) {
      return {
        status: "limit_reached",
        message: "Rol kamera Anda untuk event ini sudah penuh (" + maxFoto + " foto). Nikmati pestanya!"
      };
    }

    // 3. Simpan File ke Google Drive Target Resmi (Folder yang Telah Ditentukan)
    let targetFolder = null;

    // A. Prioritas 1: Gunakan folderId spesifik event jika ada
    if (folderId && folderId.trim() !== "") {
      try {
        targetFolder = DriveApp.getFolderById(folderId);
      } catch (eFolder) {
        Logger.log("getFolderById gagal pada folderId '" + folderId + "': " + eFolder.message);
      }
    }

    // B. Prioritas 2: Gunakan master folder dari pengaturan global jika folderId event kosong
    let masterFolderId = "";
    if (!targetFolder) {
      const configSheet = ss.getSheetByName(SHEET_NAMES.PENGATURAN);
      if (configSheet && configSheet.getLastRow() > 1) {
        const cRows = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 2).getDisplayValues();
        cRows.forEach(function(cr) {
          if (cr[0] === "master_drive_folder_id") masterFolderId = extractDriveFolderId(cr[1]);
        });
      }
      if (!masterFolderId) {
        masterFolderId = "12LfLW50HIuMUPCGQiRJKy_aO4RhVICjw";
      }

      if (masterFolderId) {
        try {
          targetFolder = DriveApp.getFolderById(masterFolderId);
        } catch (eMaster) {
          Logger.log("getFolderById gagal pada masterFolderId: " + eMaster.message);
        }
      }
    }

    // C. Prioritas 3: Fallback buat subfolder terorganisir di Drive
    if (!targetFolder) {
      try {
        const root = DriveApp.getRootFolder();
        targetFolder = root.createFolder("SnapEvent_" + namaEvent.replace(/[^a-zA-Z0-9]/g, "_"));
        targetFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (eRoot) {
        targetFolder = DriveApp.getRootFolder();
      }
    }

    // Rekam target folder ID ke DataEvent agar upload berikutnya konsisten di folder yang sama
    if (targetFolder && targetEventRow !== -1) {
      try {
        const existingColVal = evRows[targetEventRow - 2][COL_EVENT.GDRIVE_FOLDER_ID];
        if (!existingColVal || existingColVal.trim() === "") {
          eventSheet.getRange(targetEventRow, COL_EVENT.GDRIVE_FOLDER_ID + 1).setValue(targetFolder.getId());
        }
      } catch (eSync) {}
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

    const decodedBytes = Utilities.base64Decode(pureBase64);
    const timeZone = Session.getScriptTimeZone() || "Asia/Jakarta";
    const nowStr = Utilities.formatDate(new Date(), timeZone, "yyyy-MM-dd HH:mm:ss");
    const dateCompact = Utilities.formatDate(new Date(), timeZone, "yyyyMMdd");

    // Generator ID Foto Incremental
    const newIdFoto = generateIncrementalId(fotoSheet, "FTO-" + dateCompact + "-", COL_FOTO.ID);
    const fileName = newIdFoto + "_" + guestNama.replace(/[^a-zA-Z0-9]/g, "") + ".jpg";

    const blob = Utilities.newBlob(decodedBytes, mimeType, fileName);
    const driveFile = targetFolder.createFile(blob);
    driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const fileId = driveFile.getId();
    // Direct link tampilan gambar Google Drive
    const directViewUrl = "https://lh3.googleusercontent.com/d/" + fileId;

    // 4. Catat ke DataFoto
    fotoSheet.appendRow([
      newIdFoto,            // COL[0] ID
      eventId,              // COL[1] ID_EVENT
      guestId,              // COL[2] GUEST_ID
      guestNama,            // COL[3] GUEST_NAMA
      caption,              // COL[4] CAPTION
      cameraStyle,          // COL[5] CAMERA_STYLE
      frameStyle,           // COL[6] FRAME_STYLE
      fileId,               // COL[7] GDRIVE_FILE_ID
      directViewUrl,        // COL[8] GDRIVE_VIEW_URL
      0,                    // COL[9] TOTAL_LIKES
      false,                // COL[10] IS_FEATURED
      nowStr                // COL[11] CREATED_AT
    ]);

    SpreadsheetApp.flush();

    return {
      status: "success",
      message: "Foto berhasil disimpan ke rol acara!",
      idFoto: newIdFoto,
      viewUrl: directViewUrl,
      fileId: fileId,
      folderId: targetFolder ? targetFolder.getId() : "",
      remainingPhotos: Math.max(0, maxFoto - (currentGuestUploads + 1))
    };
  } finally {
    lock.releaseLock();
  }
}

// ================================================================================
// VOTING & POLLING HANDLER
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
    const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENT);
    const fotoSheet = ss.getSheetByName(SHEET_NAMES.FOTO);
    const voteSheet = ss.getSheetByName(SHEET_NAMES.VOTING);

    // Cek batas vote event
    let maxVote = 3;
    if (eventSheet && eventSheet.getLastRow() > 1) {
      const evRows = eventSheet.getRange(2, 1, eventSheet.getLastRow() - 1, 7).getDisplayValues();
      for (let i = 0; i < evRows.length; i++) {
        if (evRows[i][COL_EVENT.ID] === eventId || evRows[i][COL_EVENT.SLUG] === eventId) {
          maxVote = Number(evRows[i][COL_EVENT.MAX_VOTE]) || 3;
          break;
        }
      }
    }

    // Cek apakah tamu sudah memilih foto ini sebelumnya
    let userVotesInCat = 0;
    if (voteSheet.getLastRow() > 1) {
      const vRows = voteSheet.getRange(2, 1, voteSheet.getLastRow() - 1, 6).getDisplayValues();
      for (let j = 0; j < vRows.length; j++) {
        const vr = vRows[j];
        if (vr[COL_VOTE.ID_EVENT] === eventId && vr[COL_VOTE.GUEST_ID] === guestId) {
          if (vr[COL_VOTE.ID_FOTO] === idFoto) {
            return { status: "already_voted", message: "Anda sudah menyukai foto ini!" };
          }
          if (idKategori && vr[COL_VOTE.ID_KAT] === idKategori) {
            userVotesInCat++;
          }
        }
      }
    }

    if (userVotesInCat >= 1) {
      return {
        status: "limit_reached",
        message: "Anda sudah memberikan voting pada kategori ini (Maksimal 1 suara per kategori)."
      };
    }

    // Tambah counter like di DataFoto
    let updatedLikes = 1;
    let targetFotoRow = -1;
    if (fotoSheet.getLastRow() > 1) {
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
      newIdVote,
      eventId,
      idFoto,
      idKategori,
      guestId,
      guestNama,
      nowStr
    ]);

    SpreadsheetApp.flush();

    return {
      status: "success",
      message: "Suara Anda berhasil dicatat!",
      updatedLikes: updatedLikes
    };
  } finally {
    lock.releaseLock();
  }
}

// ================================================================================
// ADMIN OPERASIONAL & KONTROL
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

  // 1. Cek Akun Administrator Utama atau Master PIN
  if ((username && password && username === expectedUser && password === expectedPass) || (pin && pin === expectedPin)) {
    return { status: "success", message: "Autentikasi Administrator Berhasil.", user: username || expectedUser, role: "admin" };
  }

  // 2. Cek Akun Operator / Kru Tambahan
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
  if (loginCheck.status !== "success") {
    return loginCheck;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENT);
  const fotoSheet = ss.getSheetByName(SHEET_NAMES.FOTO);
  const voteSheet = ss.getSheetByName(SHEET_NAMES.VOTING);
  const katSheet = ss.getSheetByName(SHEET_NAMES.KATEGORI);
  const configSheet = ss.getSheetByName(SHEET_NAMES.PENGATURAN);

  const totalEvents = eventSheet ? Math.max(0, eventSheet.getLastRow() - 1) : 0;
  const totalPhotos = fotoSheet ? Math.max(0, fotoSheet.getLastRow() - 1) : 0;
  const totalVotes = voteSheet ? Math.max(0, voteSheet.getLastRow() - 1) : 0;

  // Daftar Semua Event
  const events = [];
  if (eventSheet && totalEvents > 0) {
    const rows = eventSheet.getRange(2, 1, totalEvents, 17).getDisplayValues();
    rows.forEach(function(r) {
      events.push({
        idEvent: r[COL_EVENT.ID],
        namaEvent: r[COL_EVENT.NAMA],
        slugEvent: r[COL_EVENT.SLUG],
        tanggalEvent: r[COL_EVENT.TANGGAL],
        hashtagEvent: r[COL_EVENT.HASHTAG],
        maxFotoPerGuest: Number(r[COL_EVENT.MAX_FOTO]) || 10,
        maxVotePerGuest: Number(r[COL_EVENT.MAX_VOTE]) || 3,
        revealMode: r[COL_EVENT.REVEAL_MODE],
        isRevealed: r[COL_EVENT.IS_REVEALED] === "TRUE" || r[COL_EVENT.IS_REVEALED] === "true",
        likeEnabled: r[COL_EVENT.LIKE_ENABLED] !== "FALSE" && r[COL_EVENT.LIKE_ENABLED] !== "false",
        publicVisible: r[COL_EVENT.PUBLIC_VISIBLE] !== "FALSE" && r[COL_EVENT.PUBLIC_VISIBLE] !== "false",
        gdriveFolderId: r[COL_EVENT.GDRIVE_FOLDER_ID],
        statusEvent: r[COL_EVENT.STATUS],
        createdAt: r[COL_EVENT.CREATED_AT]
      });
    });
  }

  // Pengaturan Global
  const globalConfig = {};
  if (configSheet && configSheet.getLastRow() > 1) {
    const cRows = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 2).getDisplayValues();
    cRows.forEach(function(r) {
      globalConfig[r[COL_CONFIG.KEY]] = r[COL_CONFIG.VAL];
    });
  }

  return {
    status: "success",
    metrics: {
      totalEvents: totalEvents,
      totalPhotos: totalPhotos,
      totalVotes: totalVotes
    },
    events: events,
    globalConfig: globalConfig
  };
}

function handleAdminSaveEvent(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { status: "error", message: "Server sibuk saat menyimpan event." };
  }

  try {
    const idEvent = String(payload.idEvent || "").trim();
    const namaEvent = String(payload.namaEvent || "Event Baru").trim();
    const slugEvent = String(payload.slugEvent || createSlug(namaEvent)).trim();
    const tanggalEvent = String(payload.tanggalEvent || "").trim();
    const hashtagEvent = String(payload.hashtagEvent || "").trim();
    const maxFoto = Number(payload.maxFotoPerGuest) || 10;
    const maxVote = Number(payload.maxVotePerGuest) || 3;
    const revealMode = payload.revealMode === "SETELAH" ? "SETELAH" : "SEGERA";
    const isRevealed = payload.isRevealed === true || payload.isRevealed === "true";
    const likeEnabled = payload.likeEnabled !== false && payload.likeEnabled !== "false";
    const publicVisible = payload.publicVisible !== false && payload.publicVisible !== "false";
    const cameraStyles = JSON.stringify(payload.activeCameraStyles || ["RAW", "800T", "WARM", "BW"]);
    const frames = JSON.stringify(payload.activeFrames || ["GOLD_DECO", "POLAROID", "MINIMAL"]);
    let customFrameUrl = String(payload.customFrameUrl || "").trim();
    if (customFrameUrl && customFrameUrl.indexOf("data:image/") === 0) {
      try {
        let frameBase64 = customFrameUrl.split(",")[1];
        let frameMime = "image/png";
        if (customFrameUrl.indexOf("image/jpeg") !== -1) frameMime = "image/jpeg";
        const frameBytes = Utilities.base64Decode(frameBase64);
        const frameBlob = Utilities.newBlob(frameBytes, frameMime, "frame_" + slugEvent + "_" + Date.now() + ".png");
        let fFolder = DriveApp.getRootFolder();
        if (folderId) {
          try { fFolder = DriveApp.getFolderById(folderId); } catch(fe) {}
        }
        const fFile = fFolder.createFile(frameBlob);
        fFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        customFrameUrl = "https://lh3.googleusercontent.com/d/" + fFile.getId();
      } catch (fErr) {
        Logger.log("Custom frame upload error: " + fErr.message);
      }
    }
    const categories = payload.categories || [];

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENT);
    const katSheet = ss.getSheetByName(SHEET_NAMES.KATEGORI);

    const timeZone = Session.getScriptTimeZone() || "Asia/Jakarta";
    const nowStr = Utilities.formatDate(new Date(), timeZone, "yyyy-MM-dd HH:mm:ss");
    const ymStr = Utilities.formatDate(new Date(), timeZone, "yyyyMM");

    let savedIdEvent = idEvent;
    let folderId = payload.gdriveFolderId || "";

    // Buat Subfolder Google Drive jika belum ada
    if (!folderId) {
      try {
        const root = DriveApp.getRootFolder();
        const iter = root.getFoldersByName("SnapEvent_Gallery_Master");
        const master = iter.hasNext() ? iter.next() : root.createFolder("SnapEvent_Gallery_Master");
        const newFolder = master.createFolder(slugEvent.replace(/[^a-zA-Z0-9_-]/g, ""));
        newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        folderId = newFolder.getId();
      } catch (dErr) {
        Logger.log("Drive folder warn: " + dErr.message);
      }
    }

    if (!idEvent) {
      // INSERT EVENT BARU (17 Kolom)
      savedIdEvent = generateIncrementalId(eventSheet, "EVT-" + ymStr + "-", COL_EVENT.ID);
      eventSheet.appendRow([
        savedIdEvent,
        namaEvent,
        slugEvent,
        tanggalEvent,
        hashtagEvent,
        maxFoto,
        maxVote,
        revealMode,
        isRevealed,
        likeEnabled,
        publicVisible,
        cameraStyles,
        frames,
        folderId,
        "AKTIF",
        nowStr,
        customFrameUrl
      ]);
    } else {
      // UPDATE EVENT EKSISTING (17 Kolom Resmi)
      let targetRow = -1;
      const rows = eventSheet.getRange(2, 1, eventSheet.getLastRow() - 1, 1).getDisplayValues();
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][0] === idEvent) {
          targetRow = i + 2;
          break;
        }
      }

      if (targetRow !== -1) {
        const oldRow = eventSheet.getRange(targetRow, 1, 1, 17).getDisplayValues()[0];
        const curStatus = oldRow[COL_EVENT.STATUS] || "INAKTIF";
        const curCreatedAt = oldRow[COL_EVENT.CREATED_AT] || nowStr;

        eventSheet.getRange(targetRow, 1, 1, 17).setValues([[
          idEvent,
          namaEvent,
          slugEvent,
          tanggalEvent,
          hashtagEvent,
          maxFoto,
          maxVote,
          revealMode,
          isRevealed,
          likeEnabled,
          publicVisible,
          cameraStyles,
          frames,
          folderId,
          curStatus,
          curCreatedAt,
          customFrameUrl
        ]]);
      }
    }

    // SIMPAN / PERBARUI KATEGORI VOTING
    if (categories && categories.length > 0 && katSheet) {
      // Hapus kategori lama event ini jika ada
      if (katSheet.getLastRow() > 1) {
        const kRows = katSheet.getRange(2, 1, katSheet.getLastRow() - 1, 2).getDisplayValues();
        for (let k = kRows.length - 1; k >= 0; k--) {
          if (kRows[k][COL_KAT.ID_EVENT] === savedIdEvent) {
            katSheet.deleteRow(k + 2);
          }
        }
      }

      // Masukkan kategori baru
      categories.forEach(function(cat, idx) {
        const catId = "KAT-" + (idx + 1);
        katSheet.appendRow([
          catId,
          savedIdEvent,
          cat.namaKategori || "Kategori " + (idx + 1),
          cat.deskripsi || "",
          idx + 1
        ]);
      });
    }

    SpreadsheetApp.flush();

    return {
      status: "success",
      message: "Event '" + namaEvent + "' berhasil disimpan!",
      idEvent: savedIdEvent,
      folderId: folderId,
      customFrameUrl: customFrameUrl
    };
  } finally {
    lock.releaseLock();
  }
}

function handleAdminToggleReveal(payload) {
  const eventId = String(payload.eventId || "").trim();
  const isRevealed = payload.isRevealed === true || payload.isRevealed === "true";

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENT);

  if (!eventSheet || eventSheet.getLastRow() <= 1) {
    return { status: "error", message: "Event tidak ditemukan." };
  }

  const rows = eventSheet.getRange(2, 1, eventSheet.getLastRow() - 1, 1).getDisplayValues();
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === eventId) {
      const targetRow = i + 2;
      eventSheet.getRange(targetRow, COL_EVENT.IS_REVEALED + 1).setValue(isRevealed);
      SpreadsheetApp.flush();
      return {
        status: "success",
        message: isRevealed ? "Galeri foto resmi DIBUKA untuk tamu!" : "Galeri foto DITUTUP sementara.",
        isRevealed: isRevealed
      };
    }
  }

  return { status: "error", message: "Event ID tidak ditemukan." };
}

function handleAdminSetActiveEvent(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { status: "error", message: "Server sibuk saat mengaktifkan event." };
  }

  try {
    const idEvent = String(payload.idEvent || "").trim();
    if (!idEvent) {
      return { status: "error", message: "ID Event diperlukan." };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENT);
    if (!eventSheet || eventSheet.getLastRow() <= 1) {
      return { status: "error", message: "Sheet Event kosong." };
    }

    const rows = eventSheet.getRange(2, 1, eventSheet.getLastRow() - 1, 17).getDisplayValues();
    let found = false;
    for (let i = 0; i < rows.length; i++) {
      const rowIndex = i + 2;
      const curId = rows[i][COL_EVENT.ID];
      if (curId === idEvent) {
        eventSheet.getRange(rowIndex, COL_EVENT.STATUS + 1).setValue("AKTIF");
        found = true;
      } else {
        eventSheet.getRange(rowIndex, COL_EVENT.STATUS + 1).setValue("INAKTIF");
      }
    }
    SpreadsheetApp.flush();

    if (!found) {
      return { status: "error", message: "Event ID '" + idEvent + "' tidak ditemukan dalam database." };
    }

    return {
      status: "success",
      activeEventId: idEvent,
      message: "Event " + idEvent + " berhasil diaktifkan sebagai acara utama!"
    };
  } catch (err) {
    return { status: "error", message: "Error activating event: " + err.message };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function handleAdminUpdateGlobalConfig(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName(SHEET_NAMES.PENGATURAN);

  if (!configSheet) {
    return { status: "error", message: "Tabel pengaturan tidak ditemukan." };
  }

  const updates = payload.updates || {};
  let rows = [];
  if (configSheet.getLastRow() > 1) {
    rows = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 2).getDisplayValues();
  }

  Object.keys(updates).forEach(function(key) {
    let found = false;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][COL_CONFIG.KEY] === key) {
        configSheet.getRange(i + 2, COL_CONFIG.VAL + 1).setValue(updates[key]);
        found = true;
        break;
      }
    }
    if (!found) {
      configSheet.appendRow([key, updates[key], "Kustom Config"]);
    }
  });

  SpreadsheetApp.flush();
  return { status: "success", message: "Pengaturan global berhasil diperbarui." };
}

// ================================================================================
// HELPER UTILITIES: INCREMENTAL ID & PARSER
// ================================================================================

function generateIncrementalId(sheet, prefix, colIndex) {
  if (sheet.getLastRow() <= 1) {
    return prefix + "001";
  }

  const values = sheet.getRange(2, colIndex + 1, sheet.getLastRow() - 1, 1).getDisplayValues();
  let maxNum = 0;

  values.forEach(function(r) {
    const idStr = String(r[0] || "");
    if (idStr.indexOf(prefix) === 0) {
      const numPart = parseInt(idStr.substring(prefix.length), 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
  });

  const nextNum = maxNum + 1;
  const padded = ("000" + nextNum).slice(-3);
  return prefix + padded;
}

function parseJsonSafe(jsonStr, fallback) {
  if (!jsonStr) return fallback;
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    return fallback;
  }
}

function createSlug(text) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

function extractDriveFolderId(input) {
  if (!input) return "";
  const str = String(input).trim();
  const folderMatch = str.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) return folderMatch[1];
  const idMatch = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) return idMatch[1];
  return str;
}

