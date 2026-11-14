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
/**
 * ================================================================================
 * SNAPEVENT BACKEND: ROUTER.GS
 * HTTP Request Dispatcher & CORS JSON Responses
 * ================================================================================
 */

function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === "getEvents") {
      return createJsonResponse(handleGetEvents());
    }

    if (action === "getGallery") {
      return createJsonResponse(handleGetGallery(e.parameter));
    }

    if (action === "getConfig") {
      return createJsonResponse(handleAdminGetConfig());
    }

    if (action === "getGuestQuota") {
      return createJsonResponse(handleGetGuestQuota(e.parameter));
    }

    if (action === "testConnection") {
      return createJsonResponse({
        status: "success",
        message: "Koneksi Google Apps Script & Google Drive Terhubung Sempurna!",
        timestamp: new Date().toISOString()
      });
    }

    return createJsonResponse({
      status: "error",
      message: "Action GET '" + action + "' tidak dikenali oleh backend."
    });
  } catch (err) {
    return createJsonResponse({
      status: "error",
      message: "Terjadi kesalahan internal GAS: " + err.message
    });
  }
}

function doPost(e) {
  try {
    let payload = {};
    if (e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        return createJsonResponse({
          status: "error",
          message: "Format payload JSON tidak valid."
        });
      }
    }

    const action = payload.action || e.parameter.action;

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

    if (action === "cleanDeletedPhotos") {
      return createJsonResponse(handleCleanDeletedPhotos(payload));
    }

    return createJsonResponse({
      status: "error",
      message: "Action POST '" + action + "' tidak didukung."
    });
  } catch (err) {
    return createJsonResponse({
      status: "error",
      message: "Error processing request: " + err.message
    });
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
/**
 * ================================================================================
 * SNAPEVENT BACKEND: GUESTSERVICE.GS
 * Public Gallery Engine, Photo Ingestion, Voting & Google Drive Auto-Sync
 * ================================================================================
 */

function handleGetEvents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENT);
  if (!eventSheet || eventSheet.getLastRow() <= 1) {
    return { status: "success", events: [] };
  }

  const rows = eventSheet.getRange(2, 1, eventSheet.getLastRow() - 1, 17).getDisplayValues();
  const events = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r[COL_EVENT.ID]) {
      let cameraStyles = ["RAW", "800T", "WARM", "BW"];
      let activeFrames = ["GOLD_DECO", "POLAROID", "MINIMAL"];
      let frameLockMode = "multi";
      let singleLockedFrame = "GOLD_DECO";
      let podiumTitles = {
        p1: "ðŸ‘‘ JUARA 1 EMAS",
        p2: "â­ JUARA 2 PERAK",
        p3: "ðŸ¥‰ JUARA 3 PERUNGGU"
      };

      try {
        if (r[COL_EVENT.CAMERA_STYLES]) cameraStyles = JSON.parse(r[COL_EVENT.CAMERA_STYLES]);
      } catch (e) {}

      try {
        if (r[COL_EVENT.FRAMES]) {
          const parsed = JSON.parse(r[COL_EVENT.FRAMES]);
          if (Array.isArray(parsed)) {
            activeFrames = parsed;
          } else if (typeof parsed === "object") {
            frameLockMode = parsed.mode || frameLockMode;
            singleLockedFrame = parsed.locked || singleLockedFrame;
            activeFrames = Array.isArray(parsed.frames) ? parsed.frames : activeFrames;
            if (parsed.podiumTitles) podiumTitles = parsed.podiumTitles;
          }
        }
      } catch (e) {}

      let rawCustomFrameUrl = r[COL_EVENT.CUSTOM_FRAME_URL] || "";
      if (rawCustomFrameUrl.indexOf("data:") === 0 || rawCustomFrameUrl.length > 500) {
        rawCustomFrameUrl = "";
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
        activeCameraStyles: cameraStyles,
        frameLockMode: frameLockMode,
        singleLockedFrame: singleLockedFrame,
        activeFrames: activeFrames,
        podiumTitles: podiumTitles,
        gdriveFolderId: r[COL_EVENT.GDRIVE_FOLDER_ID],
        statusEvent: r[COL_EVENT.STATUS],
        createdAt: r[COL_EVENT.CREATED_AT],
        customFrameUrl: rawCustomFrameUrl
      });
    }
  }

  return { status: "success", events: events };
}

function handleGetGallery(params) {
  const eventId = params.eventId;
  const guestId = params.guestId;

  if (!eventId) {
    return { status: "error", message: "Parameter eventId wajib diisi." };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENT);
  const fotoSheet = ss.getSheetByName(SHEET_NAMES.FOTO);
  const voteSheet = ss.getSheetByName(SHEET_NAMES.VOTING);

  // Ambil data event
  let eventFolderId = "";
  let isRevealed = true;
  let likeEnabled = true;
  let eventNama = "";
  let resolvedEventId = eventId;
  let targetEventRow = -1;

  if (eventSheet && eventSheet.getLastRow() > 1) {
    const eRows = eventSheet.getRange(2, 1, eventSheet.getLastRow() - 1, 17).getDisplayValues();
    for (let i = 0; i < eRows.length; i++) {
      const rowId = eRows[i][COL_EVENT.ID];
      const rowSlug = eRows[i][COL_EVENT.SLUG];
      if (rowId === eventId || rowSlug === eventId) {
        resolvedEventId = rowId;
        eventFolderId = eRows[i][COL_EVENT.GDRIVE_FOLDER_ID];
        eventNama = eRows[i][COL_EVENT.NAMA];
        targetEventRow = i + 2;

        const revMode = eRows[i][COL_EVENT.REVEAL_MODE];
        const isRevVal = eRows[i][COL_EVENT.IS_REVEALED];
        isRevealed = isRevVal === "TRUE" || isRevVal === "true";
        if (revMode === "SEGERA") isRevealed = true;

        const likeVal = eRows[i][COL_EVENT.LIKE_ENABLED];
        likeEnabled = likeVal !== "FALSE" && likeVal !== "false";
        break;
      }
    }
  }

  // Jika mode setelah acara dan belum di-reveal
  if (!isRevealed) {
    return {
      status: "locked",
      isRevealed: false,
      message: "Foto-foto sedang disimpan rapi di rol film! Galeri akan terbuka secara resmi setelah acara selesai.",
      photos: []
    };
  }

  // 1. CARI SELURUH TARGET FOLDER GOOGLE DRIVE ACARA (Termasuk Multi-Folder & Duplikat)
  const candidateFolders = [];
  const candidateFolderIds = {};

  if (eventFolderId && eventFolderId.trim() !== "") {
    try {
      const ef = DriveApp.getFolderById(eventFolderId.trim());
      if (ef && !ef.isTrashed()) {
        candidateFolders.push(ef);
        candidateFolderIds[ef.getId()] = true;
      }
    } catch (eFolder) {
      Logger.log("handleGetGallery getFolderById warn: " + eFolder.message);
    }
  }

  // Pindai Master Folder untuk mendeteksi folder acara dan seluruh foldernya (Deduplikasi Multi-Folder)
  let masterFolderId = "12LfLW50HIuMUPCGQiRJKy_aO4RhVICjw";
  const configSheet = ss.getSheetByName(SHEET_NAMES.PENGATURAN);
  if (configSheet && configSheet.getLastRow() > 1) {
    const cRows = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 2).getDisplayValues();
    cRows.forEach(function(cr) {
      if (cr[0] === "master_drive_folder_id") masterFolderId = extractDriveFolderId(cr[1]) || masterFolderId;
    });
  }

  if (masterFolderId) {
    try {
      const mFolder = DriveApp.getFolderById(masterFolderId);
      const folderSlug = (eventNama || resolvedEventId).replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
      const cleanName = (eventNama || "").toLowerCase().replace(/[^a-zA-Z0-9]/g, "");
      const subFolders = mFolder.getFolders();
      while (subFolders.hasNext()) {
        const sf = subFolders.next();
        if (!sf.isTrashed()) {
          const sfName = sf.getName().toLowerCase();
          const sfClean = sfName.replace(/[^a-zA-Z0-9]/g, "");
          if (sfClean.indexOf(cleanName) !== -1 || sfName.indexOf(folderSlug) !== -1 || (cleanName.length > 3 && sfClean.indexOf(cleanName.slice(0, 5)) !== -1)) {
            if (!candidateFolderIds[sf.getId()]) {
              candidateFolders.push(sf);
              candidateFolderIds[sf.getId()] = true;
            }
          }
        }
      }
    } catch (eMaster) {
      Logger.log("handleGetGallery master folder scan warn: " + eMaster.message);
    }
  }

  // 2. PINDAI SELURUH BERKAS FISIK DI GOOGLE DRIVE (Mendeteksi Foto Asli Termasuk dari Folder Duplikat)
  const driveFilesById = {};
  const driveFilesByName = {};
  const drivePhotoFiles = [];
  let bestFolderId = eventFolderId;
  let maxFoundInFolder = 0;

  for (let c = 0; c < candidateFolders.length; c++) {
    const cFolder = candidateFolders[c];
    let countInFolder = 0;
    try {
      const fileIter = cFolder.getFiles();
      while (fileIter.hasNext()) {
        const df = fileIter.next();
        if (!df.isTrashed()) {
          const dfId = df.getId();
          const dfName = df.getName();
          driveFilesById[dfId] = df;
          driveFilesByName[dfName] = df;
          if (dfName.indexOf("FTO-") === 0) {
            drivePhotoFiles.push(df);
            countInFolder++;
          }
        }
      }
      if (countInFolder > maxFoundInFolder) {
        maxFoundInFolder = countInFolder;
        bestFolderId = cFolder.getId();
      }
    } catch (errIter) {
      Logger.log("handleGetGallery Drive iteration warn: " + errIter.message);
    }
  }

  // Jika folder aktif saat ini berbeda dengan folder terbaik yang menyimpan foto asli, perbarui DataEvent
  if (bestFolderId && bestFolderId !== eventFolderId && targetEventRow !== -1) {
    try {
      eventSheet.getRange(targetEventRow, COL_EVENT.GDRIVE_FOLDER_ID + 1).setValue(bestFolderId);
    } catch (eUpdateFolder) {}
  }

  // Agregasi Suara per Kategori dari DataVoting
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

  // 3. Ambil daftar foto & Validasi Eksistensi Berkas Fisik
  const recordedPhotoIds = {};
  const recordedFileIds = {};
  const photos = [];
  const rowsToDelete = [];
  const hasCandidateFolders = candidateFolders.length > 0;

  if (fotoSheet && fotoSheet.getLastRow() > 1) {
    const fRows = fotoSheet.getRange(2, 1, fotoSheet.getLastRow() - 1, 12).getDisplayValues();
    for (let j = 0; j < fRows.length; j++) {
      const fr = fRows[j];
      const fEvtId = fr[COL_FOTO.ID_EVENT];
      if (fEvtId === resolvedEventId || fEvtId === eventId) {
        // Abaikan baris bingkai sistem
        if (fr[COL_FOTO.GUEST_ID] === "SYSTEM_FRAME" || fr[COL_FOTO.CAMERA_STYLE] === "FRAME") {
          continue;
        }

        const curPhotoId = fr[COL_FOTO.ID];
        const gdriveId = fr[COL_FOTO.GDRIVE_FILE_ID];

        // Validasi Eksistensi: Buang foto jika file fisiknya sudah dihapus permanen atau di Trash Google Drive
        let isFileValid = true;
        if (gdriveId) {
          if (driveFilesById[gdriveId]) {
            isFileValid = true;
          } else if (hasCandidateFolders) {
            try {
              const testFile = DriveApp.getFileById(gdriveId);
              if (testFile.isTrashed()) {
                isFileValid = false;
              }
            } catch (fileErr) {
              isFileValid = false;
            }
          }
        }

        if (!isFileValid) {
          // File fisik telah dihapus dari Google Drive! Tandai baris untuk dibersihkan
          rowsToDelete.push(j + 2);
          continue; // Lewati agar tidak pernah muncul sebagai kartu hitam kosong di galeri dan podium!
        }

        recordedPhotoIds[curPhotoId] = true;
        if (gdriveId) recordedFileIds[gdriveId] = true;

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

  // 4. REKONSILIASI 2 ARAH: INGEST OTOMATIS FOTO DI DRIVE YANG BELUM TERCATAT DI SHEETS
  // Menyelesaikan masalah: "file ada di Google Drive (misal FTO-032 & FTO-033) tapi tidak kelihatan di galeri"
  if (drivePhotoFiles.length > 0) {
    const timeZone = Session.getScriptTimeZone() || "Asia/Jakarta";
    drivePhotoFiles.forEach(function(df) {
      const dfId = df.getId();
      const dfName = df.getName();
      const idMatch = dfName.match(/^(FTO-\d+-\d+)/i);
      const parsedPhotoId = idMatch ? idMatch[1] : ("FTO-" + dfId.slice(-8));

      // Jika file fisik ada di Drive tapi belum pernah dicatat di Google Sheets
      if (!recordedPhotoIds[parsedPhotoId] && !recordedFileIds[dfId]) {
        try {
          df.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (eShare) {}

        let guestNama = "Tamu";
        const nameMatch = dfName.match(/^FTO-[^_]+_(.+)\.[a-zA-Z0-9]+$/i);
        if (nameMatch && nameMatch[1]) {
          guestNama = nameMatch[1];
        }
        const viewUrl = "https://lh3.googleusercontent.com/d/" + dfId;
        let createdStr = "";
        try {
          createdStr = Utilities.formatDate(df.getDateCreated(), timeZone, "yyyy-MM-dd HH:mm:ss");
        } catch (eDate) {
          createdStr = Utilities.formatDate(new Date(), timeZone, "yyyy-MM-dd HH:mm:ss");
        }

        // Catat ke DataFoto Sheets secara otomatis
        fotoSheet.appendRow([
          sanitizeCellValue(parsedPhotoId),
          sanitizeCellValue(resolvedEventId),
          "GUEST-RECON",
          sanitizeCellValue(guestNama),
          "Momen seru!",
          "800T",
          "CUSTOM_EVENT",
          sanitizeCellValue(dfId),
          sanitizeCellValue(viewUrl),
          0,
          false,
          sanitizeCellValue(createdStr)
        ]);

        // Masukkan langsung ke hasil galeri agar seketika tampil di layar tamu
        photos.push({
          idFoto: parsedPhotoId,
          guestNama: guestNama,
          caption: "Momen seru!",
          cameraStyle: "800T",
          frameStyle: "CUSTOM_EVENT",
          gdriveViewUrl: viewUrl,
          totalLikes: 0,
          categoryLikes: {},
          isFeatured: false,
          createdAt: createdStr
        });

        recordedPhotoIds[parsedPhotoId] = true;
        recordedFileIds[dfId] = true;
      }
    });
  }

  // Bersihkan baris foto yang file Drive-nya sudah dihapus (dari bawah ke atas agar indeks aman)
  if (rowsToDelete.length > 0) {
    for (let d = rowsToDelete.length - 1; d >= 0; d--) {
      try {
        fotoSheet.deleteRow(rowsToDelete[d]);
      } catch (eDel) {}
    }
  }

  if (rowsToDelete.length > 0 || drivePhotoFiles.length > 0) {
    try { SpreadsheetApp.flush(); } catch (eF) {}
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

        // Cari foto dengan like terbanyak di kategori ini
        let topPhoto = null;
        let maxLikes = 0;

        photos.forEach(function(p) {
          const lk = (p.categoryLikes && p.categoryLikes[catId]) || 0;
          if (lk > maxLikes) {
            maxLikes = lk;
            topPhoto = p;
          }
        });

        if (topPhoto && maxLikes > 0) {
          categoryWinners.push({
            idKategori: catId,
            namaKategori: catName,
            winner: {
              idFoto: topPhoto.idFoto,
              guestNama: topPhoto.guestNama,
              caption: topPhoto.caption,
              gdriveViewUrl: topPhoto.gdriveViewUrl,
              likesInCat: maxLikes,
              totalLikes: topPhoto.totalLikes
            }
          });
        }
      }
    });
  }

  return {
    status: "success",
    isRevealed: isRevealed,
    likeEnabled: likeEnabled,
    photos: photos,
    votedPhotoIds: votedPhotoIds,
    guestVotesMap: guestVotesMap,
    categories: categories,
    categoryWinners: categoryWinners
  };
}

function handleUploadPhoto(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { status: "error", message: "Server sibuk saat memproses antrian unggah foto." };
  }

  try {
    const eventId = String(payload.eventId || "").trim();
    let folderId = extractDriveFolderId(payload.folderId || "");
    const guestId = String(payload.guestId || "GUEST").trim();
    const guestNama = String(payload.guestNama || "Tamu").trim();
    const caption = String(payload.caption || "Momen seru!").trim();
    const cameraStyle = String(payload.cameraStyle || "800T").trim();
    const frameStyle = String(payload.frameStyle || "GOLD_DECO").trim();
    const imageBase64 = payload.imageBase64 || "";

    if (!imageBase64) {
      return { status: "error", message: "Data gambar (Base64) kosong." };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENT);
    const fotoSheet = ss.getSheetByName(SHEET_NAMES.FOTO);

    // 1. Validasi Kuota Foto Tamu
    let maxFotoPerGuest = 10;
    let targetEventRow = -1;
    let eventNama = "";

    if (eventSheet && eventSheet.getLastRow() > 1) {
      const eRows = eventSheet.getRange(2, 1, eventSheet.getLastRow() - 1, 17).getDisplayValues();
      for (let i = 0; i < eRows.length; i++) {
        if (eRows[i][COL_EVENT.ID] === eventId || eRows[i][COL_EVENT.SLUG] === eventId) {
          maxFotoPerGuest = Number(eRows[i][COL_EVENT.MAX_FOTO]) || 10;
          if (!folderId) folderId = extractDriveFolderId(eRows[i][COL_EVENT.GDRIVE_FOLDER_ID]);
          eventNama = eRows[i][COL_EVENT.NAMA];
          targetEventRow = i + 2;
          break;
        }
      }
    }

    if (fotoSheet && fotoSheet.getLastRow() > 1 && guestId) {
      const fRows = fotoSheet.getRange(2, 1, fotoSheet.getLastRow() - 1, 4).getDisplayValues();
      let guestPhotoCount = 0;
      for (let j = 0; j < fRows.length; j++) {
        if (fRows[j][COL_FOTO.ID_EVENT] === eventId && fRows[j][COL_FOTO.GUEST_ID] === guestId) {
          guestPhotoCount++;
        }
      }
      if (guestPhotoCount >= maxFotoPerGuest) {
        return {
          status: "limit_reached",
          message: "Anda telah mencapai batas kuota jepretan foto (" + maxFotoPerGuest + " foto) untuk acara ini."
        };
      }
    }

    // 2. Dapatkan Folder Google Drive Target
    let targetFolder = null;
    if (folderId) {
      try {
        targetFolder = DriveApp.getFolderById(folderId);
        if (targetFolder.isTrashed()) targetFolder = null;
      } catch (fe) {
        targetFolder = null;
      }
    }

    // Jika folder belum ditemukan, cari di masterFolder
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
        try {
          const mFolder = DriveApp.getFolderById(masterFolderId);
          const safeName = (eventNama || eventId).replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
          const cleanName = (eventNama || "").toLowerCase().replace(/[^a-zA-Z0-9]/g, "");
          const subF = mFolder.getFolders();
          while (subF.hasNext()) {
            const sf = subF.next();
            if (!sf.isTrashed()) {
              const sfClean = sf.getName().toLowerCase().replace(/[^a-zA-Z0-9]/g, "");
              if (sfClean.indexOf(cleanName) !== -1 || sf.getName().toLowerCase().indexOf(safeName) !== -1) {
                targetFolder = sf;
                break;
              }
            }
          }
          if (!targetFolder) {
            targetFolder = mFolder.createFolder(safeName || "Event_" + eventId);
            try { targetFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (eSh) {}
          }
        } catch (me) {}
      }
    }

    if (!targetFolder) {
      targetFolder = DriveApp.getRootFolder();
    }

    // Perbarui folderId di DataEvent jika sebelumnya kosong
    if (targetFolder && targetEventRow !== -1) {
      try {
        eventSheet.getRange(targetEventRow, COL_EVENT.GDRIVE_FOLDER_ID + 1).setValue(targetFolder.getId());
      } catch (eSync) {}
    }

    // 3. Simpan File Foto ke Google Drive
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

    const newIdFoto = generateIncrementalId(fotoSheet, "FTO-" + dateCompact + "-", COL_FOTO.ID);
    const fileName = newIdFoto + "_" + guestNama.replace(/[^a-zA-Z0-9]/g, "") + ".jpg";

    let fileId = "";
    let directViewUrl = "";

    try {
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
        } catch (shareErr) {}
      }
    } catch (dErr) {
      Logger.log("Drive file creation warn: " + dErr.message);
    }

    // 4. Catat ke DataFoto dengan Sanitisasi Sel Penuh (Maks 45.000 karakter, NO Base64)
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
      folderId: targetFolder ? targetFolder.getId() : ""
    };
  } finally {
    lock.releaseLock();
  }
}

function handleSubmitVote(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { status: "error", message: "Server sibuk saat memproses suara voting." };
  }

  try {
    const eventId = String(payload.eventId || "").trim();
    const fotoId = String(payload.idFoto || "").trim();
    const kategoriId = String(payload.idKategori || "GENERAL").trim();
    const guestId = String(payload.guestId || "").trim();
    const guestNama = String(payload.guestNama || "Tamu").trim();

    if (!eventId || !fotoId || !guestId) {
      return { status: "error", message: "Data voting tidak lengkap." };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const voteSheet = ss.getSheetByName(SHEET_NAMES.VOTING);
    const fotoSheet = ss.getSheetByName(SHEET_NAMES.FOTO);
    const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENT);

    // Validasi Like Enabled
    if (eventSheet && eventSheet.getLastRow() > 1) {
      const evRows = eventSheet.getRange(2, 1, eventSheet.getLastRow() - 1, 10).getDisplayValues();
      for (let eIdx = 0; eIdx < evRows.length; eIdx++) {
        if (evRows[eIdx][COL_EVENT.ID] === eventId || evRows[eIdx][COL_EVENT.SLUG] === eventId) {
          if (evRows[eIdx][COL_EVENT.LIKE_ENABLED] === "FALSE" || evRows[eIdx][COL_EVENT.LIKE_ENABLED] === "false") {
            return { status: "error", message: "Sesi voting untuk acara ini sedang ditutup." };
          }
          break;
        }
      }
    }

    // Enforce 1 vote per category
    if (voteSheet && voteSheet.getLastRow() > 1) {
      const vRows = voteSheet.getRange(2, 1, voteSheet.getLastRow() - 1, 6).getDisplayValues();
      for (let i = 0; i < vRows.length; i++) {
        const r = vRows[i];
        if ((r[COL_VOTE.ID_EVENT] === eventId) && (r[COL_VOTE.GUEST_ID] === guestId) && (r[COL_VOTE.ID_KAT] === kategoriId)) {
          return {
            status: "already_voted",
            message: "Anda sudah memberikan 1 suara untuk kategori ini (Maksimal 1 kali voting per kategori)!"
          };
        }
        if ((r[COL_VOTE.ID_EVENT] === eventId) && (r[COL_VOTE.GUEST_ID] === guestId) && (r[COL_VOTE.ID_FOTO] === fotoId)) {
          return {
            status: "already_voted",
            message: "Anda sudah menyukai foto ini!"
          };
        }
      }
    }

    // Update total like pada foto
    let updatedLikes = 1;
    let targetFotoRow = -1;
    if (fotoSheet && fotoSheet.getLastRow() > 1) {
      const fRows = fotoSheet.getRange(2, 1, fotoSheet.getLastRow() - 1, 10).getDisplayValues();
      for (let j = 0; j < fRows.length; j++) {
        if (fRows[j][COL_FOTO.ID] === fotoId) {
          targetFotoRow = j + 2;
          const curLikes = Number(fRows[j][COL_FOTO.TOTAL_LIKES]) || 0;
          updatedLikes = curLikes + 1;
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
      fotoId,
      kategoriId,
      guestId,
      guestNama,
      nowStr
    ]);

    SpreadsheetApp.flush();

    return {
      status: "success",
      message: "Voting berhasil dicatat! â¤ï¸",
      idVote: newIdVote,
      updatedLikes: updatedLikes
    };
  } finally {
    lock.releaseLock();
  }
}

function handleGetGuestQuota(params) {
  const eventId = params.eventId;
  const guestId = params.guestId;

  if (!eventId || !guestId) {
    return { status: "error", message: "Parameter eventId dan guestId diperlukan." };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENT);
  const fotoSheet = ss.getSheetByName(SHEET_NAMES.FOTO);
  const voteSheet = ss.getSheetByName(SHEET_NAMES.VOTING);

  let maxFoto = 10;
  let maxVote = 3;

  if (eventSheet && eventSheet.getLastRow() > 1) {
    const eRows = eventSheet.getRange(2, 1, eventSheet.getLastRow() - 1, 7).getDisplayValues();
    for (let i = 0; i < eRows.length; i++) {
      if (eRows[i][COL_EVENT.ID] === eventId || eRows[i][COL_EVENT.SLUG] === eventId) {
        maxFoto = Number(eRows[i][COL_EVENT.MAX_FOTO]) || 10;
        maxVote = Number(eRows[i][COL_EVENT.MAX_VOTE]) || 3;
        break;
      }
    }
  }

  let photoCount = 0;
  if (fotoSheet && fotoSheet.getLastRow() > 1) {
    const fRows = fotoSheet.getRange(2, 1, fotoSheet.getLastRow() - 1, 4).getDisplayValues();
    for (let j = 0; j < fRows.length; j++) {
      if ((fRows[j][COL_FOTO.ID_EVENT] === eventId) && (fRows[j][COL_FOTO.GUEST_ID] === guestId)) {
        photoCount++;
      }
    }
  }

  let voteCount = 0;
  const votedKategoriIds = [];
  if (voteSheet && voteSheet.getLastRow() > 1) {
    const vRows = voteSheet.getRange(2, 1, voteSheet.getLastRow() - 1, 5).getDisplayValues();
    for (let k = 0; k < vRows.length; k++) {
      if ((vRows[k][COL_VOTE.ID_EVENT] === eventId) && (vRows[k][COL_VOTE.GUEST_ID] === guestId)) {
        voteCount++;
        const catId = vRows[k][COL_VOTE.ID_KAT];
        if (catId && !votedKategoriIds.includes(catId)) {
          votedKategoriIds.push(catId);
        }
      }
    }
  }

  return {
    status: "success",
    photoQuotaRemaining: Math.max(0, maxFoto - photoCount),
    photoCount: photoCount,
    maxFoto: maxFoto,
    voteQuotaRemaining: Math.max(0, maxVote - voteCount),
    voteCount: voteCount,
    maxVote: maxVote,
    votedKategoriIds: votedKategoriIds
  };
}

function handleCleanDeletedPhotos(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const fotoSheet = ss.getSheetByName(SHEET_NAMES.FOTO);
  if (!fotoSheet || fotoSheet.getLastRow() <= 1) {
    return { status: "success", deletedCount: 0 };
  }

  const rows = fotoSheet.getRange(2, 1, fotoSheet.getLastRow() - 1, 10).getDisplayValues();
  const rowsToDelete = [];

  for (let i = 0; i < rows.length; i++) {
    const fileId = rows[i][COL_FOTO.GDRIVE_FILE_ID];
    if (fileId) {
      try {
        const file = DriveApp.getFileById(fileId);
        if (file.isTrashed()) {
          rowsToDelete.push(i + 2);
        }
      } catch (err) {
        rowsToDelete.push(i + 2);
      }
    }
  }

  for (let d = rowsToDelete.length - 1; d >= 0; d--) {
    fotoSheet.deleteRow(rowsToDelete[d]);
  }

  SpreadsheetApp.flush();
  return { status: "success", deletedCount: rowsToDelete.length };
}
/**
 * ================================================================================
 * SNAPEVENT BACKEND: ADMINSERVICE.GS
 * Event CRUD, Custom Titles, Admin Authentication & Global System Config
 * ================================================================================
 */

function handleAdminLogin(payload) {
  const username = String(payload.username || "").trim();
  const password = String(payload.password || "").trim();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName(SHEET_NAMES.PENGATURAN);

  let validUser = "admin";
  let validPass = "admin123";
  let userAccountsJson = "";

  if (configSheet && configSheet.getLastRow() > 1) {
    const rows = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 2).getDisplayValues();
    rows.forEach(function(r) {
      if (r[COL_CONFIG.KEY] === "admin_user") validUser = r[COL_CONFIG.VAL];
      if (r[COL_CONFIG.KEY] === "admin_pass") validPass = r[COL_CONFIG.VAL];
      if (r[COL_CONFIG.KEY] === "user_accounts") userAccountsJson = r[COL_CONFIG.VAL];
    });
  }

  // 1. Cek Admin Utama
  if (username === validUser && password === validPass) {
    return {
      status: "success",
      message: "Login admin utama berhasil!",
      user: { username: validUser, role: "admin", displayName: "Administrator" }
    };
  }

  // 2. Cek Akun Pengguna / Operator Tambahan
  if (userAccountsJson) {
    try {
      const accounts = JSON.parse(userAccountsJson);
      if (Array.isArray(accounts)) {
        for (let a = 0; a < accounts.length; a++) {
          const acc = accounts[a];
          if (acc && acc.username === username && acc.password === password) {
            return {
              status: "success",
              message: "Login berhasil sebagai " + (acc.role === "admin" ? "Admin" : "Operator Kru") + "!",
              user: { username: acc.username, role: acc.role || "operator", displayName: acc.displayName || acc.username }
            };
          }
        }
      }
    } catch (eAcc) {}
  }

  return { status: "error", message: "Username atau password yang Anda masukkan salah." };
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

    // Resolusi Google Drive Folder ID
    let folderId = String(payload.gdriveFolderId || "").trim();
    if (!folderId && oldRow) {
      folderId = String(oldRow[COL_EVENT.GDRIVE_FOLDER_ID] || "").trim();
    }

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

        let foundFolder = null;
        try {
          const subIter = masterFolder.getFoldersByName(safeFolderName);
          if (subIter.hasNext()) {
            foundFolder = subIter.next();
          }
        } catch (sfErr) {}

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
          } catch (cfErr) {}
        }
      } catch (dErr) {}
    }

    // Upload & Konversi Custom Frame Base64 ke File Drive jika ada
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
        customFrameUrl = (oldRow && oldRow[COL_EVENT.CUSTOM_FRAME_URL] && oldRow[COL_EVENT.CUSTOM_FRAME_URL].length <= 500 && oldRow[COL_EVENT.CUSTOM_FRAME_URL].indexOf("data:") !== 0) 
          ? oldRow[COL_EVENT.CUSTOM_FRAME_URL] 
          : "";
      }
    }

    // SANITISASI MUTLAK: Cegah Error Sheets 50.000 karakter
    if (customFrameUrl.indexOf("data:") === 0 || customFrameUrl.length > 500) {
      customFrameUrl = (oldRow && oldRow[COL_EVENT.CUSTOM_FRAME_URL] && oldRow[COL_EVENT.CUSTOM_FRAME_URL].length <= 500 && oldRow[COL_EVENT.CUSTOM_FRAME_URL].indexOf("data:") !== 0)
        ? oldRow[COL_EVENT.CUSTOM_FRAME_URL]
        : "";
    }

    // Struktur Kebijakan Bingkai & Gelar Juara Podium
    const podiumTitles = payload.podiumTitles || {
      p1: payload.podiumTitleP1 || "ðŸ‘‘ JUARA 1 EMAS",
      p2: payload.podiumTitleP2 || "â­ JUARA 2 PERAK",
      p3: payload.podiumTitleP3 || "ðŸ¥‰ JUARA 3 PERUNGGU"
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
      // UPDATE EVENT EKSISTING (17 Kolom)
      if (targetRow !== -1) {
        const curStatus = (oldRow && oldRow[COL_EVENT.STATUS]) || "INAKTIF";
        const curCreatedAt = (oldRow && oldRow[COL_EVENT.CREATED_AT]) || nowStr;

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
      if (katSheet.getLastRow() > 1) {
        const kRows = katSheet.getRange(2, 1, katSheet.getLastRow() - 1, 2).getDisplayValues();
        for (let k = kRows.length - 1; k >= 0; k--) {
          if (kRows[k][COL_KAT.ID_EVENT] === savedIdEvent || kRows[k][COL_KAT.ID_EVENT] === idEvent) {
            katSheet.deleteRow(k + 2);
          }
        }
      }

      categories.forEach(function(cat, idx) {
        const catId = "KAT-" + (idx + 1);
        katSheet.appendRow([
          catId,
          savedIdEvent,
          sanitizeCellValue(cat.namaKategori),
          sanitizeCellValue(cat.deskripsi || ""),
          idx + 1
        ]);
      });
    }

    SpreadsheetApp.flush();

    return {
      status: "success",
      message: "Pengaturan acara berhasil disimpan!",
      idEvent: savedIdEvent,
      customFrameUrl: customFrameUrl,
      folderId: folderId
    };
  } finally {
    lock.releaseLock();
  }
}

function handleAdminToggleReveal(payload) {
  const eventId = String(payload.eventId || "").trim();
  const isRevealed = payload.isRevealed === true || payload.isRevealed === "true";

  if (!eventId) {
    return { status: "error", message: "Parameter eventId wajib diisi." };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENT);
  if (!eventSheet || eventSheet.getLastRow() <= 1) {
    return { status: "error", message: "DataEvent belum ada." };
  }

  const rows = eventSheet.getRange(2, 1, eventSheet.getLastRow() - 1, 9).getDisplayValues();
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][COL_EVENT.ID] === eventId || rows[i][COL_EVENT.SLUG] === eventId) {
      eventSheet.getRange(i + 2, COL_EVENT.IS_REVEALED + 1).setValue(isRevealed);
      SpreadsheetApp.flush();
      return {
        status: "success",
        message: "Status reveal acara berhasil diubah menjadi: " + (isRevealed ? "DIBUKA" : "TERKUNCI"),
        isRevealed: isRevealed
      };
    }
  }

  return { status: "error", message: "Event ID tidak ditemukan." };
}

function handleAdminSetActiveEvent(payload) {
  const idEvent = String(payload.idEvent || "").trim();
  if (!idEvent) {
    return { status: "error", message: "Parameter idEvent wajib diisi." };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENT);
  if (!eventSheet || eventSheet.getLastRow() <= 1) {
    return { status: "error", message: "DataEvent kosong." };
  }

  const rows = eventSheet.getRange(2, 1, eventSheet.getLastRow() - 1, 15).getDisplayValues();
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

  if (found) {
    return { status: "success", message: "Event " + idEvent + " kini berstatus AKTIF!" };
  } else {
    return { status: "error", message: "Event dengan ID " + idEvent + " tidak ditemukan." };
  }
}

function handleAdminGetConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName(SHEET_NAMES.PENGATURAN);
  const config = {
    app_title: "SnapEvent Studio",
    app_logo_url: "",
    app_phone: "+62 812-3456-7890",
    app_instagram: "@snapevent",
    admin_user: "admin",
    admin_pass: "admin123",
    gas_webapp_url: ScriptApp.getService().getUrl() || "",
    master_drive_folder_id: "12LfLW50HIuMUPCGQiRJKy_aO4RhVICjw",
    user_accounts: "[]"
  };

  if (configSheet && configSheet.getLastRow() > 1) {
    const rows = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 2).getDisplayValues();
    rows.forEach(function(r) {
      const key = r[COL_CONFIG.KEY];
      const val = r[COL_CONFIG.VAL];
      if (key) config[key] = val;
    });
  }

  return { status: "success", config: config };
}

function handleAdminUpdateGlobalConfig(payload) {
  const updates = payload.updates || {};
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName(SHEET_NAMES.PENGATURAN);

  if (!configSheet) {
    return { status: "error", message: "Sheet Pengaturan tidak ditemukan." };
  }

  let rows = [];
  if (configSheet.getLastRow() > 1) {
    rows = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 2).getDisplayValues();
  }

  Object.keys(updates).forEach(function(key) {
    let found = false;
    const safeVal = sanitizeCellValue(updates[key], 45000);
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
  return { status: "success", message: "Pengaturan sistem berhasil diperbarui!" };
}
/**
 * ================================================================================
 * SNAPEVENT BACKEND: DRIVESERVICE.GS
 * Dedicated Custom Frame Uploader (Exact 1 File Deduplication)
 * ================================================================================
 */

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
    } catch (shareErr) {}

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
