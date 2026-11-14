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
 * Sanitasi Nilai Sel Google Sheets: Batasi Panjang Maksimal 49.000 Karakter
 * Mencegah Error: 'Your input contains more than the maximum of 50000 characters in a single cell'
 */
function sanitizeCellValue(val, maxLen) {
  if (val === null || val === undefined) return "";
  maxLen = maxLen || 49000;
  var str = String(val);
  if (str.length > maxLen) {
    Logger.log("WARNING: Nilai sel dipangkas dari " + str.length + " ke " + maxLen + " karakter untuk proteksi sel Sheets");
    return str.substring(0, maxLen);
  }
  return str;
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

    if (action === "adminCleanDeletedPhotos") {
      return createJsonResponse(handleAdminCleanDeletedPhotos(payload));
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
    rows.forEach(function(r, rowIdx) {
      if (r[COL_EVENT.ID]) {
        let cleanFrameUrl = r[COL_EVENT.CUSTOM_FRAME_URL] || "";
        // Sanitisasi proaktif: jika sel terisi Base64 raksasa (>500 char), netralkan seketika
        if (cleanFrameUrl.indexOf("data:") === 0 || cleanFrameUrl.length > 500) {
          cleanFrameUrl = "";
          try {
            eventSheet.getRange(rowIdx + 2, COL_EVENT.CUSTOM_FRAME_URL + 1).setValue("");
          } catch(cleanErr) {}
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
          isRevealed: r[COL_EVENT.IS_REVEALED] === "TRUE" || r[COL_EVENT.IS_REVEALED] === "true",
          likeEnabled: r[COL_EVENT.LIKE_ENABLED] !== "FALSE" && r[COL_EVENT.LIKE_ENABLED] !== "false",
          publicVisible: r[COL_EVENT.PUBLIC_VISIBLE] !== "FALSE" && r[COL_EVENT.PUBLIC_VISIBLE] !== "false",
          activeCameraStyles: parseJsonSafe(r[COL_EVENT.CAMERA_STYLES], ["RAW", "800T", "WARM", "BW"]),
          activeFrames: parseJsonSafe(r[COL_EVENT.FRAMES], ["GOLD_DECO", "POLAROID", "MINIMAL"]),
          podiumTitles: (parseJsonSafe(r[COL_EVENT.FRAMES], {}).podiumTitles) || null,
          gdriveFolderId: r[COL_EVENT.GDRIVE_FOLDER_ID] || "",
          statusEvent: r[COL_EVENT.STATUS] || "INAKTIF",
          customFrameUrl: cleanFrameUrl
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
        podiumTitles: (parseJsonSafe(r[COL_EVENT.FRAMES], {}).podiumTitles) || null,
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
        podiumTitles: (parseJsonSafe(r[COL_EVENT.FRAMES], {}).podiumTitles) || null,
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

  // Ambil info status reveal event & resolusi Event ID resmi (Mendukung ID maupun Slug)
  let resolvedEventId = eventId;
  let isRevealed = true;
  let revealMode = "SEGERA";
  let likeEnabled = true;

  if (eventSheet && eventSheet.getLastRow() > 1) {
    const evRows = eventSheet.getRange(2, 1, eventSheet.getLastRow() - 1, 10).getDisplayValues();
    for (let i = 0; i < evRows.length; i++) {
      if (evRows[i][COL_EVENT.ID] === eventId || evRows[i][COL_EVENT.SLUG] === eventId) {
        resolvedEventId = evRows[i][COL_EVENT.ID];
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

  // Agregasi Suara per Kategori dari DataVoting (Menghitung like per kategori untuk tiap foto)
  const photoCatLikes = {}; // { [idFoto]: { [idKategori]: count } }
  const votedPhotoIds = [];
  const guestVotesMap = {};

  if (voteSheet && voteSheet.getLastRow() > 1) {
    const vRows = voteSheet.getRange(2, 1, voteSheet.getLastRow() - 1, 7).getDisplayValues();
    for (let vIdx = 0; vIdx < vRows.length; vIdx++) {
      const vr = vRows[vIdx];
      const rowEvtId = vr[COL_VOTE.ID_EVENT];
      if (rowEvtId === resolvedEventId || rowEvtId === eventId) {
        const pId = vr[COL_VOTE.ID_FOTO];
        const cId = vr[COL_VOTE.ID_KAT] || "GENERAL";
        const gId = vr[COL_VOTE.GUEST_ID];

        if (pId) {
          if (!photoCatLikes[pId]) photoCatLikes[pId] = {};
          photoCatLikes[pId][cId] = (photoCatLikes[pId][cId] || 0) + 1;
        }

        if (guestId && gId === guestId) {
          if (pId && !votedPhotoIds.includes(pId)) {
            votedPhotoIds.push(pId);
          }
          if (cId) {
            guestVotesMap[cId] = (guestVotesMap[cId] || 0) + 1;
          }
        }
      }
    }
  }

  // Ambil daftar foto
  const photos = [];
  if (fotoSheet && fotoSheet.getLastRow() > 1) {
    const fRows = fotoSheet.getRange(2, 1, fotoSheet.getLastRow() - 1, 12).getDisplayValues();
    for (let j = 0; j < fRows.length; j++) {
      const fr = fRows[j];
      const fEvtId = fr[COL_FOTO.ID_EVENT];
      if (fEvtId === resolvedEventId || fEvtId === eventId) {
        // Abaikan baris bingkai sistem agar tidak tampil sebagai foto di galeri tamu
        if (fr[COL_FOTO.GUEST_ID] === "SYSTEM_FRAME" || fr[COL_FOTO.CAMERA_STYLE] === "FRAME") {
          continue;
        }

        const curPhotoId = fr[COL_FOTO.ID];
        const gdriveId = fr[COL_FOTO.GDRIVE_FILE_ID];

        // Validasi Defensif Cepat: Jangan buang foto jika hanya kendala izin akses DriveApp
        let isTrashed = false;
        if (gdriveId) {
          try {
            const driveFile = DriveApp.getFileById(gdriveId);
            if (driveFile.isTrashed()) {
              isTrashed = true;
            }
          } catch (fileErr) {
            // Jika DriveApp throws exception / restricted, jangan buang foto
            isTrashed = false;
          }
        }
        if (isTrashed) {
          continue; // Lewati hanya jika terbukti file ada di Trash Google Drive
        }

        const catLikes = photoCatLikes[curPhotoId] || {};
        photos.push({
          idFoto: curPhotoId,
          guestNama: fr[COL_FOTO.GUEST_NAMA],
          caption: fr[COL_FOTO.CAPTION],
          cameraStyle: fr[COL_FOTO.CAMERA_STYLE],
          frameStyle: fr[COL_FOTO.FRAME_STYLE],
          gdriveViewUrl: fr[COL_FOTO.GDRIVE_VIEW_URL],
          totalLikes: Number(fr[COL_FOTO.TOTAL_LIKES]) || 0,
          categoryLikes: catLikes,
          isFeatured: fr[COL_FOTO.IS_FEATURED] === "TRUE" || fr[COL_FOTO.IS_FEATURED] === "true",
          createdAt: fr[COL_FOTO.CREATED_AT]
        });
      }
    }
  }

  // Balik urutan agar foto terbaru tampil di paling atas
  photos.reverse();

  // Hitung Pemenang Voting per Kategori Acara
  const katSheet = ss.getSheetByName(SHEET_NAMES.KATEGORI);
  const categories = [];
  const categoryWinners = [];

  if (katSheet && katSheet.getLastRow() > 1) {
    const kRows = katSheet.getRange(2, 1, katSheet.getLastRow() - 1, 5).getDisplayValues();
    kRows.forEach(function(kr) {
      if (kr[COL_KAT.ID_EVENT] === resolvedEventId || kr[COL_KAT.ID_EVENT] === eventId) {
        const catId = kr[COL_KAT.ID];
        const catName = kr[COL_KAT.NAMA];
        categories.push({
          idKategori: catId,
          namaKategori: catName,
          deskripsi: kr[COL_KAT.DESKRIPSI]
        });

        // Cari foto dengan like tertinggi di kategori ini
        let topPhoto = null;
        let maxLikesInCat = 0;
        photos.forEach(function(p) {
          const lCount = (p.categoryLikes && p.categoryLikes[catId]) || 0;
          if (lCount > maxLikesInCat) {
            maxLikesInCat = lCount;
            topPhoto = {
              idFoto: p.idFoto,
              guestNama: p.guestNama,
              caption: p.caption,
              gdriveViewUrl: p.gdriveViewUrl,
              likesInCat: lCount,
              totalLikes: p.totalLikes
            };
          }
        });

        if (topPhoto) {
          categoryWinners.push({
            idKategori: catId,
            namaKategori: catName,
            winner: topPhoto
          });
        }
      }
    });
  }

  return {
    status: "success",
    isRevealed: true,
    likeEnabled: likeEnabled,
    photos: photos,
    votedPhotoIds: votedPhotoIds,
    guestVotesMap: guestVotesMap,
    categories: categories,
    categoryWinners: categoryWinners
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

    // 2B. Proteksi Anti-Duplikasi Ekstrem: Cek apakah foto yang sama persis baru saja diunggah tamu ini
    if (fotoSheet.getLastRow() > 1) {
      const recentCount = Math.min(10, fotoSheet.getLastRow() - 1);
      const startR = Math.max(2, fotoSheet.getLastRow() - recentCount + 1);
      const recentRows = fotoSheet.getRange(startR, 1, recentCount, 12).getDisplayValues();
      for (let ri = recentRows.length - 1; ri >= 0; ri--) {
        const rCheck = recentRows[ri];
        if (rCheck[COL_FOTO.ID_EVENT] === eventId && 
            rCheck[COL_FOTO.GUEST_ID] === guestId && 
            rCheck[COL_FOTO.CAPTION] === caption && 
            rCheck[COL_FOTO.GDRIVE_FILE_ID]) {
          Logger.log("Mencegah duplikasi file Drive: Foto identik telah tercatat sebagai " + rCheck[COL_FOTO.ID]);
          return {
            status: "success",
            message: "Foto sudah tersimpan aman di rol acara!",
            idFoto: rCheck[COL_FOTO.ID],
            viewUrl: rCheck[COL_FOTO.GDRIVE_VIEW_URL] || ("https://lh3.googleusercontent.com/d/" + rCheck[COL_FOTO.GDRIVE_FILE_ID]),
            fileId: rCheck[COL_FOTO.GDRIVE_FILE_ID],
            folderId: folderId,
            remainingPhotos: Math.max(0, maxFoto - currentGuestUploads)
          };
        }
      }
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

    // C. Prioritas 3: Fallback ke Master Folder atau Root langsung (Cegah pembuatan folder kosong acak)
    if (!targetFolder) {
      if (masterFolderId) {
        try { targetFolder = DriveApp.getFolderById(masterFolderId); } catch (eMasterFallback) {}
      }
      if (!targetFolder) {
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

    let fileId = "";
    let directViewUrl = "";

    try {
      // Cek apakah file dengan nama fileName sudah ada di folder target untuk mencegah duplikasi
      let driveFile = null;
      if (targetFolder) {
        try {
          const existFiles = targetFolder.getFilesByName(fileName);
          if (existFiles.hasNext()) {
            driveFile = existFiles.next();
          }
        } catch (exErr) {}
      }

      if (!driveFile && targetFolder) {
        const blob = Utilities.newBlob(decodedBytes, mimeType, fileName);
        driveFile = targetFolder.createFile(blob);
      }

      if (driveFile) {
        fileId = driveFile.getId();
        directViewUrl = "https://lh3.googleusercontent.com/d/" + fileId;
        try {
          driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (shareErr) {
          Logger.log("Safe setSharing photo warn: " + shareErr.message);
        }
      }
    } catch (dErr) {
      Logger.log("Drive file creation warn: " + dErr.message);
    }

    // 4. Catat ke DataFoto dengan Sanitisasi Sel Penuh
    fotoSheet.appendRow([
      sanitizeCellValue(newIdFoto),            // COL[0] ID
      sanitizeCellValue(eventId),              // COL[1] ID_EVENT
      sanitizeCellValue(guestId),              // COL[2] GUEST_ID
      sanitizeCellValue(guestNama),            // COL[3] GUEST_NAMA
      sanitizeCellValue(caption),              // COL[4] CAPTION
      sanitizeCellValue(cameraStyle),          // COL[5] CAMERA_STYLE
      sanitizeCellValue(frameStyle),           // COL[6] FRAME_STYLE
      sanitizeCellValue(fileId),               // COL[7] GDRIVE_FILE_ID
      sanitizeCellValue(directViewUrl),        // COL[8] GDRIVE_VIEW_URL
      0,                                       // COL[9] TOTAL_LIKES
      false,                                   // COL[10] IS_FEATURED
      sanitizeCellValue(nowStr)                // COL[11] CREATED_AT
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
// DEDICATED CUSTOM FRAME HANDLER (SINGLE FILE DEDUPLICATION - ZERO DATA_FOTO POLLUTION)
// ================================================================================

function handleUploadCustomFrame(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { status: "error", message: "Server sibuk saat mengunggah bingkai kustom." };
  }

  try {
    const eventId = String(payload.eventId || "").trim();
    const imageBase64 = payload.imageBase64 || "";
    let folderId = extractDriveFolderId(payload.folderId || "");

    if (!imageBase64) {
      return { status: "error", message: "Data gambar bingkai tidak boleh kosong." };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENT);

    // Cari target folder jika spesifik
    let targetFolder = null;
    if (folderId) {
      try { targetFolder = DriveApp.getFolderById(folderId); } catch(fe) {}
    }

    // Jika folder event belum ada, cari master folder
    if (!targetFolder) {
      const configSheet = ss.getSheetByName(SHEET_NAMES.PENGATURAN);
      let masterFolderId = "";
      if (configSheet && configSheet.getLastRow() > 1) {
        const cRows = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 2).getDisplayValues();
        cRows.forEach(function(cr) {
          if (cr[0] === "master_drive_folder_id") masterFolderId = extractDriveFolderId(cr[1]);
        });
      }
      if (!masterFolderId) masterFolderId = "12LfLW50HIuMUPCGQiRJKy_aO4RhVICjw";

      if (masterFolderId) {
        try { targetFolder = DriveApp.getFolderById(masterFolderId); } catch(me) {}
      }
    }

    if (!targetFolder) {
      targetFolder = DriveApp.getRootFolder();
    }

    // Ekstraksi Base64 Data
    let pureBase64 = imageBase64;
    let mimeType = "image/png";
    if (pureBase64.indexOf("data:") === 0) {
      const parts = pureBase64.split(",");
      pureBase64 = parts[1];
      if (parts[0].indexOf("image/jpeg") !== -1) mimeType = "image/jpeg";
    }

    const decodedBytes = Utilities.base64Decode(pureBase64);
    const cleanEventId = (eventId || "event").replace(/[^a-zA-Z0-9_-]/g, "");
    const frameFileName = "frame_" + cleanEventId + ".png";

    // PENCEGAHAN DUPLIKASI MUTLAK:
    // Bersihkan file bingkai lama untuk event ini agar di Google Drive HANYA ADA 1 FILE BINGKAI!
    try {
      const existingFiles = targetFolder.getFilesByName(frameFileName);
      while (existingFiles.hasNext()) {
        const oldFile = existingFiles.next();
        try { oldFile.setTrashed(true); } catch(te) {}
      }
    } catch(se) {}

    const blob = Utilities.newBlob(decodedBytes, mimeType, frameFileName);
    const driveFile = targetFolder.createFile(blob);
    try {
      driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {
      Logger.log("Safe setSharing custom frame warn: " + shareErr.message);
    }

    const fileId = driveFile.getId();
    const directViewUrl = "https://lh3.googleusercontent.com/d/" + fileId;

    // Catat URL ringkas ke DataEvent secara otomatis jika event terdaftar
    if (eventSheet && eventSheet.getLastRow() > 1 && eventId) {
      const evRows = eventSheet.getRange(2, 1, eventSheet.getLastRow() - 1, 17).getDisplayValues();
      for (let i = 0; i < evRows.length; i++) {
        if (evRows[i][COL_EVENT.ID] === eventId || evRows[i][COL_EVENT.SLUG] === eventId) {
          eventSheet.getRange(i + 2, COL_EVENT.CUSTOM_FRAME_URL + 1).setValue(sanitizeCellValue(directViewUrl));
          break;
        }
      }
    }

    SpreadsheetApp.flush();

    return {
      status: "success",
      message: "Bingkai kustom berhasil disimpan (Tepat 1 file di Google Drive)!",
      fileId: fileId,
      viewUrl: directViewUrl,
      customFrameUrl: directViewUrl
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
      const rawFrames = parseJsonSafe(r[COL_EVENT.FRAMES], ["GOLD_DECO", "POLAROID", "MINIMAL"]);
      let evMode = "multi";
      let evLocked = "GOLD_DECO";
      let evFramesList = ["GOLD_DECO", "POLAROID", "MINIMAL"];
      if (rawFrames && typeof rawFrames === "object" && !Array.isArray(rawFrames)) {
        evMode = rawFrames.mode || "single";
        evLocked = rawFrames.locked || "GOLD_DECO";
        evFramesList = Array.isArray(rawFrames.frames) ? rawFrames.frames : [evLocked];
      } else if (Array.isArray(rawFrames)) {
        evFramesList = rawFrames;
        evMode = rawFrames.length === 1 ? "single" : "multi";
        evLocked = rawFrames[0] || "GOLD_DECO";
      }

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
        activeCameraStyles: parseJsonSafe(r[COL_EVENT.CAMERA_STYLES], ["RAW", "800T", "WARM", "BW"]),
        activeFrames: evFramesList,
        frameLockMode: evMode,
        singleLockedFrame: evLocked,
        gdriveFolderId: r[COL_EVENT.GDRIVE_FOLDER_ID],
        statusEvent: r[COL_EVENT.STATUS],
        createdAt: r[COL_EVENT.CREATED_AT],
        customFrameUrl: r[COL_EVENT.CUSTOM_FRAME_URL] || ""
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
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENT);
    const katSheet = ss.getSheetByName(SHEET_NAMES.KATEGORI);

    const timeZone = Session.getScriptTimeZone() || "Asia/Jakarta";
    const nowStr = Utilities.formatDate(new Date(), timeZone, "yyyy-MM-dd HH:mm:ss");
    const ymStr = Utilities.formatDate(new Date(), timeZone, "yyyyMM");

    let savedIdEvent = idEvent;

    // Cari baris event eksisting jika ini adalah update
    let targetRow = -1;
    let oldRow = null;
    if (idEvent && eventSheet && eventSheet.getLastRow() > 1) {
      const rows = eventSheet.getRange(2, 1, eventSheet.getLastRow() - 1, 17).getDisplayValues();
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][COL_EVENT.ID] === idEvent) {
          targetRow = i + 2;
          oldRow = rows[i];
          break;
        }
      }
    }

    // Resolusi Google Drive Folder ID (Pertahankan folder eksisting & cegah pembentukan folder duplikat)
    let folderId = String(payload.gdriveFolderId || "").trim();
    if (!folderId && oldRow) {
      folderId = String(oldRow[COL_EVENT.GDRIVE_FOLDER_ID] || "").trim();
    }

    // Jika folderId belum ada, cari di folder Master Drive atau root secara idempoten
    if (!folderId) {
      try {
        const safeFolderName = (slugEvent || createSlug(namaEvent)).replace(/[^a-zA-Z0-9_-]/g, "");
        const root = DriveApp.getRootFolder();
        let masterFolder = null;
        const configSheet = ss.getSheetByName(SHEET_NAMES.PENGATURAN);
        let masterIdConfig = "";
        if (configSheet && configSheet.getLastRow() > 1) {
          const cRows = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 2).getDisplayValues();
          for (let ci = 0; ci < cRows.length; ci++) {
            if (cRows[ci][COL_CONFIG.KEY] === "master_drive_folder_id") {
              masterIdConfig = extractDriveFolderId(cRows[ci][COL_CONFIG.VAL]);
            }
          }
        }
        if (masterIdConfig) {
          try { masterFolder = DriveApp.getFolderById(masterIdConfig); } catch(me) {}
        }
        if (!masterFolder) {
          try {
            const iter = root.getFoldersByName("SnapEvent_Gallery_Master");
            masterFolder = iter.hasNext() ? iter.next() : root.createFolder("SnapEvent_Gallery_Master");
            try { masterFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (msErr) {}
          } catch (mErr) {
            masterFolder = root;
          }
        }

        // Cek apakah folder sudah ada di masterFolder untuk mencegah duplikasi (Anti-Folder Duplikat)
        let foundFolder = null;
        try {
          const subIter = masterFolder.getFoldersByName(safeFolderName);
          if (subIter.hasNext()) {
            foundFolder = subIter.next();
          }
        } catch (sfErr) {}

        // Cek juga di root jika belum ditemukan di masterFolder
        if (!foundFolder) {
          try {
            const rootIter = root.getFoldersByName(safeFolderName);
            if (rootIter.hasNext()) {
              foundFolder = rootIter.next();
            }
          } catch (rfErr) {}
        }

        if (foundFolder) {
          folderId = foundFolder.getId();
        } else {
          try {
            const newFolder = masterFolder.createFolder(safeFolderName);
            folderId = newFolder.getId();
            try { newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (nsErr) {}
          } catch (cfErr) {
            Logger.log("Gagal membuat folder baru: " + cfErr.message);
          }
        }
      } catch (dErr) {
        Logger.log("Drive folder reuse warn: " + dErr.message);
      }
    }

    // Upload & Konversi Custom Frame Base64 ke File Drive (Anti-Duplikasi: Tepat 1 File)
    let customFrameUrl = String(payload.customFrameUrl || "").trim();
    if (customFrameUrl && customFrameUrl.indexOf("data:image/") === 0) {
      try {
        let frameMime = "image/png";
        if (customFrameUrl.indexOf("image/jpeg") !== -1) frameMime = "image/jpeg";
        const frameBase64 = customFrameUrl.indexOf(",") !== -1 ? customFrameUrl.split(",")[1] : customFrameUrl;
        const frameBytes = Utilities.base64Decode(frameBase64);
        const frameFileName = "frame_" + (slugEvent || "custom") + ".png";
        let fFolder = DriveApp.getRootFolder();
        if (folderId) {
          try { fFolder = DriveApp.getFolderById(folderId); } catch(fe) {}
        }
        // Bersihkan file bingkai lama untuk event ini
        try {
          const oldIter = fFolder.getFilesByName(frameFileName);
          while (oldIter.hasNext()) {
            try { oldIter.next().setTrashed(true); } catch(te) {}
          }
        } catch(oe) {}

        const frameBlob = Utilities.newBlob(frameBytes, frameMime, frameFileName);
        const fFile = fFolder.createFile(frameBlob);
        try {
          fFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (fShareErr) {}
        customFrameUrl = "https://lh3.googleusercontent.com/d/" + fFile.getId();
      } catch (fErr) {
        Logger.log("Custom frame upload error: " + fErr.message);
        customFrameUrl = (oldRow && oldRow[COL_EVENT.CUSTOM_FRAME_URL] && oldRow[COL_EVENT.CUSTOM_FRAME_URL].length <= 500 && oldRow[COL_EVENT.CUSTOM_FRAME_URL].indexOf("data:") !== 0) 
          ? oldRow[COL_EVENT.CUSTOM_FRAME_URL] 
          : "";
      }
    }

    // SANITISASI MUTLAK CELL GOOGLE SHEETS:
    // Google Sheets membatasi 50.000 karakter per cell. Cegah error 'contains more than maximum 50000 characters'!
    if (customFrameUrl.indexOf("data:") === 0 || customFrameUrl.length > 500) {
      Logger.log("Sanitasi customFrameUrl terlalu panjang: " + customFrameUrl.length + " karakter");
      customFrameUrl = (oldRow && oldRow[COL_EVENT.CUSTOM_FRAME_URL] && oldRow[COL_EVENT.CUSTOM_FRAME_URL].length <= 500 && oldRow[COL_EVENT.CUSTOM_FRAME_URL].indexOf("data:") !== 0)
        ? oldRow[COL_EVENT.CUSTOM_FRAME_URL]
        : "";
    }

    // Struktur Penyimpanan Kebijakan Bingkai & Gelar Juara Podium
    const podiumTitles = payload.podiumTitles || {
      p1: payload.podiumTitleP1 || "👑 JUARA 1 EMAS",
      p2: payload.podiumTitleP2 || "⭐ JUARA 2 PERAK",
      p3: payload.podiumTitleP3 || "🥉 JUARA 3 PERUNGGU"
    };

    const framePolicyObj = {
      mode: payload.frameLockMode || (payload.activeFrames && payload.activeFrames.length === 1 ? "single" : "multi"),
      locked: payload.singleLockedFrame || (payload.activeFrames && payload.activeFrames[0]) || "GOLD_DECO",
      frames: payload.activeFrames || ["GOLD_DECO", "POLAROID", "MINIMAL"],
      podiumTitles: podiumTitles
    };
    const frames = JSON.stringify(framePolicyObj);
    const cameraStyles = JSON.stringify(payload.activeCameraStyles || ["RAW", "800T", "WARM", "BW"]);
    const categories = payload.categories || [];

    if (!idEvent) {
      // INSERT EVENT BARU (17 Kolom) dengan Sanitasi Mutlak 49.000 Karakter
      savedIdEvent = generateIncrementalId(eventSheet, "EVT-" + ymStr + "-", COL_EVENT.ID);
      eventSheet.appendRow([
        sanitizeCellValue(savedIdEvent),
        sanitizeCellValue(namaEvent),
        sanitizeCellValue(slugEvent),
        sanitizeCellValue(tanggalEvent),
        sanitizeCellValue(hashtagEvent),
        maxFoto,
        maxVote,
        sanitizeCellValue(revealMode),
        isRevealed,
        likeEnabled,
        publicVisible,
        sanitizeCellValue(cameraStyles),
        sanitizeCellValue(frames),
        sanitizeCellValue(folderId),
        "AKTIF",
        sanitizeCellValue(nowStr),
        sanitizeCellValue(customFrameUrl)
      ]);
    } else {
      // UPDATE EVENT EKSISTING (17 Kolom Resmi) dengan Sanitasi Mutlak 49.000 Karakter
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
          sanitizeCellValue(idEvent),
          sanitizeCellValue(namaEvent),
          sanitizeCellValue(slugEvent),
          sanitizeCellValue(tanggalEvent),
          sanitizeCellValue(hashtagEvent),
          maxFoto,
          maxVote,
          sanitizeCellValue(revealMode),
          isRevealed,
          likeEnabled,
          publicVisible,
          sanitizeCellValue(cameraStyles),
          sanitizeCellValue(frames),
          sanitizeCellValue(folderId),
          sanitizeCellValue(curStatus),
          sanitizeCellValue(curCreatedAt),
          sanitizeCellValue(customFrameUrl)
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
    const safeVal = sanitizeCellValue(updates[key], 49000);
    const safeKey = sanitizeCellValue(key, 500);
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][COL_CONFIG.KEY] === safeKey) {
        configSheet.getRange(i + 2, COL_CONFIG.VAL + 1).setValue(safeVal);
        found = true;
        break;
      }
    }
    if (!found) {
      configSheet.appendRow([safeKey, safeVal, "Kustom Config"]);
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

/**
 * Pembersih Foto Terhapus (Admin Tool):
 * Memeriksa sheet DataFoto dan menghapus baris yang file fisiknya sudah terhapus di Drive
 */
function handleAdminCleanDeletedPhotos(payload) {
  const pin = payload.pin || "";
  const loginCheck = handleAdminLogin({ pin: pin });
  if (loginCheck.status !== "success") return loginCheck;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const fotoSheet = ss.getSheetByName(SHEET_NAMES.FOTO);
  if (!fotoSheet || fotoSheet.getLastRow() <= 1) {
    return { status: "success", message: "Tidak ada baris foto di sheet DataFoto.", cleanedCount: 0 };
  }

  let cleanedCount = 0;
  const lastRow = fotoSheet.getLastRow();
  for (let r = lastRow; r >= 2; r--) {
    const rowVals = fotoSheet.getRange(r, 1, 1, 12).getDisplayValues()[0];
    const gdriveId = rowVals[COL_FOTO.GDRIVE_FILE_ID];
    if (gdriveId) {
      let isDead = false;
      try {
        const file = DriveApp.getFileById(gdriveId);
        if (file.isTrashed()) isDead = true;
      } catch (err) {
        isDead = true;
      }
      if (isDead) {
        fotoSheet.deleteRow(r);
        cleanedCount++;
      }
    }
  }

  return {
    status: "success",
    message: "Berhasil membersihkan " + cleanedCount + " baris foto yang telah dihapus di Drive.",
    cleanedCount: cleanedCount
  };
}

