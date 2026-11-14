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
        p1: "👑 JUARA 1 EMAS",
        p2: "⭐ JUARA 2 PERAK",
        p3: "🥉 JUARA 3 PERUNGGU"
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
      message: "Voting berhasil dicatat! ❤️",
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
