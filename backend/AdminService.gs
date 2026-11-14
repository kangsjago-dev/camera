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
