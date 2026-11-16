// Islamic Companion — login log -> Google Sheet sync
// Paste this whole file into script.google.com (bound to nothing is fine),
// save, then run setup() once and approve the permissions it asks for.
// After that it runs itself every 15 minutes.

var SHEET_ID = '17003oypTHUpyCU9qdEnnyi6EHKLqBB-9lmAdGhaZoUo';
var TAB = 'Login Log';
var ENDPOINT = 'https://solene-11f8ed2a.base44.app/functions/icLoginExport';
var SHARED_KEY = 'iqvGmsaBBy8mOXHTcPJqOaoe5J13N2a9';

function syncLoginLog() {
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TAB);
  if (!sh) throw new Error('tab "' + TAB + '" not found');

  var res = UrlFetchApp.fetch(ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-ic-key': SHARED_KEY },
    payload: JSON.stringify({}),
    muteHttpExceptions: true
  });
  var data = JSON.parse(res.getContentText());
  if (!data.ok) throw new Error('export failed: ' + res.getContentText().slice(0, 200));

  var last = sh.getLastRow();
  var seen = {};
  if (last > 1) {
    sh.getRange(2, 1, last - 1, 2).getValues().forEach(function (r) {
      seen[String(r[0]) + '|' + String(r[1])] = true;
    });
  }

  var add = data.rows.filter(function (r) {
    return !seen[r.when + '|' + r.email];
  }).map(function (r) {
    return [r.when, r.email, r.event, r.device, r.password];
  });

  if (!add.length) return 'nothing new';
  sh.getRange(sh.getLastRow() + 1, 1, add.length, 5).setValues(add);
  return 'added ' + add.length;
}

function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncLoginLog') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncLoginLog').timeBased().everyMinutes(15).create();
  return 'trigger installed: syncLoginLog every 15 min';
}


// ---------------------------------------------------------------------------
// ONE-OFF: clear the password column of every row already in the sheet.
// The app no longer exports passwords (icLoginExport hardcodes ''), so no new
// row can carry one; this removes the historical ones. Run once, then ignore.
// In the Apps Script editor: paste this, save, pick scrubPasswords, Run.
function scrubPasswords() {
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TAB);
  var last = sh.getLastRow();
  if (last < 2) return 'nothing to scrub';
  var rows = last - 1;
  sh.getRange(2, 5, rows, 1).setValue('');
  return 'cleared password column on ' + rows + ' rows';
}
