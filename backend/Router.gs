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
