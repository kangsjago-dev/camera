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
