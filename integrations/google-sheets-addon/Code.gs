/** @OnlyCurrentDoc */
/* Standalone Editor add-on. Publish this project; do not bind it to a customer's file. */
var TIDEPATH_ORIGIN_ = 'https://tidepath.muntasersyed.com';
var TIDEPATH_SELECTION_PREFIX_ = 'tidepath.public.selection.v1.';
var TIDEPATH_CONNECTED_PREFIX_ = 'tidepath.public.connected.v1.';

/** Must remain safe in AuthMode.NONE: no properties, identity, cells or network calls. */
function onOpen(e) {
  SpreadsheetApp.getUi().createAddonMenu().addItem('Open Tidepath', 'openTidepath').addToUi();
}
function onInstall(e) { onOpen(e); }
function openTidepath() {
  SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutputFromFile('Sidebar').setTitle('Tidepath'));
}

function tidepathContext() {
  var workbook = SpreadsheetApp.getActiveSpreadsheet();
  var source = tidepathStoredSource_();
  return {
    configured: true, backendUrl: TIDEPATH_ORIGIN_, workbookId: workbook.getId(), workbookName: workbook.getName(),
    selection: source, connectedAt: PropertiesService.getUserProperties().getProperty(TIDEPATH_CONNECTED_PREFIX_ + workbook.getId())
  };
}

function tidepathOpenPicker() {
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutputFromFile('Picker').setWidth(800).setHeight(600), 'Connect this spreadsheet to Tidepath');
}

/** The only browser token handoff: a short-lived Google token for Google's Picker. */
function tidepathPickerConfiguration() {
  var properties = PropertiesService.getScriptProperties();
  var key = properties.getProperty('TIDEPATH_PICKER_API_KEY');
  var projectNumber = properties.getProperty('TIDEPATH_CLOUD_PROJECT_NUMBER');
  if (!key || !/^\d+$/.test(projectNumber || '')) throw new Error('Tidepath’s file picker is not ready yet. Please use the support link; you do not need to configure anything.');
  var workbook = SpreadsheetApp.getActiveSpreadsheet();
  return { developerKey: key, appId: projectNumber, oauthToken: ScriptApp.getOAuthToken(), workbookId: workbook.getId(), workbookName: workbook.getName() };
}

function tidepathConfirmWorkbook(workbookId) {
  var workbook = SpreadsheetApp.getActiveSpreadsheet();
  if (typeof workbookId !== 'string' || workbookId !== workbook.getId()) throw new Error('Choose the spreadsheet currently open: ' + workbook.getName() + '.');
  // Picker output is a hint, not authorization. The backend verifies the signed
  // subject, access-token subject and fresh Google Drive canEdit permission.
  var result = tidepathRequest_({ action: 'status', workbookId: workbook.getId() });
  PropertiesService.getUserProperties().setProperty(TIDEPATH_CONNECTED_PREFIX_ + workbook.getId(), String(Date.now()));
  return { email: result.identity && result.identity.email, workbookName: workbook.getName() };
}

function tidepathReadSelection() {
  var workbook = SpreadsheetApp.getActiveSpreadsheet();
  var ranges = workbook.getActiveRangeList();
  if (ranges && ranges.getRanges().length !== 1) throw new Error('Select one contiguous table, including its header row.');
  var range = workbook.getActiveRange();
  if (!range) throw new Error('Select your donation table including its headers.');
  var selection = tidepathSnapshot_(workbook, range);
  var summary = { workbookId: selection.workbookId, sheetId: selection.sheetId, sheetName: selection.sheetName, a1: selection.a1,
    startRow: selection.startRow, startColumn: selection.startColumn, rowCount: selection.values.length - 1,
    columnCount: selection.values[0].length, hash: tidepathHash_(selection) };
  PropertiesService.getUserProperties().setProperty(TIDEPATH_SELECTION_PREFIX_ + workbook.getId(), JSON.stringify(summary));
  return { selection: selection, summary: summary };
}

function tidepathCommand(command) {
  if (!command || typeof command !== 'object' || Array.isArray(command)) throw new Error('Choose a Tidepath action.');
  var allowed = ['status', 'preview', 'import', 'merge', 'generate', 'edit', 'approve', 'export', 'write', 'delete'];
  if (allowed.indexOf(command.action) < 0) throw new Error('Unknown Tidepath action.');
  var input = {};
  Object.keys(command).forEach(function (key) {
    if (['selection', 'workbookId', 'tenantId', 'userId', 'email', 'identity', 'accessToken'].indexOf(key) < 0) input[key] = command[key];
  });
  input.workbookId = SpreadsheetApp.getActiveSpreadsheet().getId();
  if (command.action !== 'status' && command.action !== 'delete') input.selection = tidepathPinnedSelection_();
  var result = tidepathRequest_(input);
  if (input.selection) tidepathAssertUnchanged_(input.selection);
  if (command.action === 'delete') PropertiesService.getUserProperties().deleteProperty(TIDEPATH_SELECTION_PREFIX_ + input.workbookId);
  return result;
}

function tidepathStoredSource_() {
  var workbookId = SpreadsheetApp.getActiveSpreadsheet().getId();
  var raw = PropertiesService.getUserProperties().getProperty(TIDEPATH_SELECTION_PREFIX_ + workbookId);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}
function tidepathSnapshot_(workbook, range) {
  if (range.getNumRows() < 2 || range.getNumRows() > 1001 || range.getNumColumns() > 32) throw new Error('Select a header plus 1–1,000 donation rows, with at most 32 columns.');
  var values = range.getValues().map(function (row) { return row.map(function (value) {
    if (Object.prototype.toString.call(value) === '[object Date]') return Utilities.formatDate(value, workbook.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
    if (value === null || typeof value === 'boolean' || (typeof value === 'number' && isFinite(value))) return value;
    if (typeof value === 'string' && value.length <= 2000) return value;
    throw new Error('A selected cell is unsupported or exceeds 2,000 characters.');
  }); });
  return { workbookId: workbook.getId(), sheetId: range.getSheet().getSheetId(), sheetName: range.getSheet().getName(), a1: range.getA1Notation(),
    startRow: range.getRow(), startColumn: range.getColumn(), values: values, formulas: range.getFormulas() };
}
function tidepathReadPinnedRange_(source) {
  var workbook = SpreadsheetApp.getActiveSpreadsheet();
  if (source.workbookId !== workbook.getId()) throw new Error('This source belongs to another spreadsheet. Read selected rows again.');
  var sheet = workbook.getSheetById(source.sheetId);
  if (!sheet) throw new Error('The source tab was removed. Read selected rows again.');
  return tidepathSnapshot_(workbook, sheet.getRange(source.a1));
}
function tidepathPinnedSelection_() {
  var source = tidepathStoredSource_();
  if (!source) throw new Error('Select your table and choose Read selected rows first.');
  var current = tidepathReadPinnedRange_(source);
  if (tidepathHash_(current) !== source.hash) throw new Error('Your source changed. Read selected rows again, preview the corrections and reimport before creating a fresh report.');
  return current;
}
function tidepathAssertUnchanged_(selection) {
  if (tidepathHash_(tidepathReadPinnedRange_(selection)) !== tidepathHash_(selection)) throw new Error('Source cells changed during this action. Read the table again and review a new report.');
}
function tidepathRequest_(input) {
  var identityToken = ScriptApp.getIdentityToken();
  if (!identityToken) throw new Error('Authorize Tidepath with your Google account, then reopen the sidebar.');
  var response;
  // The backend fetches authoritative values from Google. Send only the locator,
  // keeping the local snapshot solely for the post-action source check.
  var payload = {};
  Object.keys(input).forEach(function (key) { payload[key] = input[key]; });
  if (input.selection) payload.selection = { workbookId: input.selection.workbookId, sheetId: input.selection.sheetId, a1: input.selection.a1 };
  try {
    response = UrlFetchApp.fetch(TIDEPATH_ORIGIN_ + '/api/public/command', {
      method: 'post', contentType: 'application/json', payload: JSON.stringify(payload),
      headers: { Authorization: 'Bearer ' + identityToken, 'X-Tidepath-Google-Access-Token': ScriptApp.getOAuthToken() },
      muteHttpExceptions: true, followRedirects: false, validateHttpsCertificates: true
    });
  } catch (_) { throw new Error('Tidepath could not be reached. Your source cells are safe. Retry this action shortly.'); }
  var status = response.getResponseCode();
  if (status >= 300 && status < 400) throw new Error('Tidepath’s connection changed. Please reopen the add-on or contact support.');
  var result;
  try { result = JSON.parse(response.getContentText()); } catch (_) { throw new Error('Tidepath returned an unexpected response. Please retry shortly.'); }
  if (status < 200 || status >= 300) {
    var message = result && typeof result.error === 'string' ? result.error.slice(0, 1500) : 'Tidepath could not complete this action.';
    if (status === 401) message += ' Reopen the add-on with the Google account you want to use.';
    if (status === 403 || status === 404) message += ' Connect this spreadsheet using Choose spreadsheet, and confirm that your account can edit it.';
    if (status === 429) message += ' Wait for the limit to reset; retrying repeatedly will not help.';
    if (result && Array.isArray(result.issues)) message += ' ' + result.issues.slice(0, 6).map(function (issue) { return typeof issue.message === 'string' ? issue.message.slice(0, 500) : ''; }).join(' ');
    throw new Error(message);
  }
  return result;
}
function tidepathStableJson_(value) {
  if (Array.isArray(value)) return '[' + value.map(tidepathStableJson_).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.keys(value).filter(function (key) { return value[key] !== undefined; }).sort(function (a, b) { return a.localeCompare(b); }).map(function (key) { return JSON.stringify(key) + ':' + tidepathStableJson_(value[key]); }).join(',') + '}';
  return JSON.stringify(value) || 'null';
}
function tidepathHash_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, tidepathStableJson_(value), Utilities.Charset.UTF_8).map(function (byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); }).join('');
}
