/**
 * Optional Google Apps Script backend for BHH Cross Allergy Checker.
 *
 * Use this only if you want GitHub Pages to read live data from Google Sheets
 * and/or save search logs. Static JSON mode does not require this file.
 *
 * Script Properties required:
 * - SHEET_ID: target Google Sheet ID
 */

const APP = {
  DATA_SHEET_NAME: 'Data',
  LOGS_SHEET_NAME: 'Logs',
  HEADERS: ['drug_a', 'drug_b', 'result', 'result_code', 'description'],
};

function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = String(params.action || 'health');

  try {
    setupDatabase_();

    if (action === 'getData') {
      return jsonResponse_({
        status: 'success',
        data: getCrossAllergyData_(),
        generated_at: new Date().toISOString(),
      }, params.callback);
    }

    if (action === 'log') {
      saveLog_(params.keyword || '');
      return jsonResponse_({ status: 'logged' }, params.callback);
    }

    return jsonResponse_({
      status: 'ok',
      app: 'BHH Cross Allergy Checker API',
      actions: ['getData', 'log', 'health'],
    }, params.callback);
  } catch (err) {
    return jsonResponse_({
      status: 'error',
      message: err && err.message ? err.message : String(err),
    }, params.callback);
  }
}

function getCrossAllergyData_() {
  const sheet = getSpreadsheet_().getSheetByName(APP.DATA_SHEET_NAME);
  const values = sheet.getDataRange().getDisplayValues();

  if (values.length < 2) return [];

  const headers = values[0].map(function (h) {
    return String(h || '').trim();
  });

  return values.slice(1)
    .filter(function (row) {
      return row[0] && row[1];
    })
    .map(function (row, index) {
      const item = { id: 'rel-' + String(index + 1).padStart(3, '0') };
      headers.forEach(function (header, columnIndex) {
        item[header] = String(row[columnIndex] || '').trim();
      });
      return item;
    });
}

function saveLog_(keyword) {
  keyword = String(keyword || '').trim();
  if (!keyword) return;

  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(APP.LOGS_SHEET_NAME);
  sheet.appendRow([
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
    keyword,
    'github-pages',
  ]);
}

function setupDatabase_() {
  const ss = getSpreadsheet_();

  let dataSheet = ss.getSheetByName(APP.DATA_SHEET_NAME);
  if (!dataSheet) {
    dataSheet = ss.insertSheet(APP.DATA_SHEET_NAME);
    dataSheet.getRange(1, 1, 1, APP.HEADERS.length).setValues([APP.HEADERS]);
    dataSheet.getRange(1, 1, 1, APP.HEADERS.length).setFontWeight('bold').setBackground('#eef6ff');
    dataSheet.setFrozenRows(1);
  }

  let logsSheet = ss.getSheetByName(APP.LOGS_SHEET_NAME);
  if (!logsSheet) {
    logsSheet = ss.insertSheet(APP.LOGS_SHEET_NAME);
    logsSheet.getRange(1, 1, 1, 3).setValues([['timestamp', 'search_keyword', 'source']]);
    logsSheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#eef6ff');
    logsSheet.setFrozenRows(1);
  }
}

function getSpreadsheet_() {
  const sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!sheetId) {
    throw new Error('Missing Script Property: SHEET_ID');
  }
  return SpreadsheetApp.openById(sheetId);
}

function jsonResponse_(payload, callback) {
  const json = JSON.stringify(payload);
  const safeCallback = sanitizeCallback_(callback);

  if (safeCallback) {
    return ContentService
      .createTextOutput(safeCallback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function sanitizeCallback_(callback) {
  callback = String(callback || '').trim();
  if (!callback) return '';

  // Accept common JSONP callback names such as __bhh_getData_123 or app.handleData.
  const isSafe = /^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)?$/.test(callback);
  return isSafe ? callback : '';
}
