/**
 * Google Apps Script for A-dot Instructor Scheduling Dashboard
 * v6: Ultra-Robust Duplicate Deletion
 */

// --- Global Helper Functions ---
const normalizeSimple = (s) => {
  const digits = (s || "").toString().replace(/[^0-9]/g, "");
  return digits.length >= 6 ? digits.slice(-6) : digits;
};
const getNameId = (s) => (s || "").toString().replace(/\s/g, "");

const normalizeTimestamp = (s) => {
  if (!s) return "";
  let nums = s.toString().match(/\d+/g);
  if (!nums || nums.length < 3) return s.toString().replace(/[^0-9]/g, "");
  let y = nums[0]; if (y.length === 2) y = "20" + y;
  let m = ("0" + nums[1]).slice(-2);
  let d = ("0" + nums[2]).slice(-2);
  let hh = ("0" + (nums[3] || 0)).slice(-2);
  let mm = ("0" + (nums[4] || 0)).slice(-2);
  let ss_ = ("0" + (nums[5] || 0)).slice(-2);
  if (s.indexOf("오후") !== -1 || s.indexOf("PM") !== -1) {
    let h = parseInt(hh); if (h < 12) hh = ("0" + (h + 12)).slice(-2);
  } else if (s.indexOf("오전") !== -1 || s.indexOf("AM") !== -1) {
    if (hh === "12") hh = "00";
  }
  return y + m + d + hh + mm + ss_;
};

function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName('지원자 DB');

        if (!sheet) {
            return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: '시트를 찾을 수 없습니다.' }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        const rows = sheet.getDataRange().getValues();
        let rowIndex = -1;


        const targetName = getNameId(data.name);
        const targetBirth = normalizeSimple(data.birth);

        const displayRows = sheet.getDataRange().getDisplayValues();
        let matchingIndices = [];

        for (let i = 1; i < displayRows.length; i++) {
            const row = displayRows[i];
            const rowName = getNameId(row[1]);
            const rowBirth = normalizeSimple(row[2]);

            // Match ONLY by Name + Birth Date
            if (targetName && targetBirth && rowName === targetName && rowBirth === targetBirth) {
                matchingIndices.push(i + 1);
            }
        }

        if (matchingIndices.length > 0) {
            matchingIndices.forEach(idx => {
                // S: Status/Branch, T: Schedule, U: Result, V: Training
                sheet.getRange(idx, 19).setValue((data.status && data.assignedBranch) ? data.assignedBranch : ''); 
                sheet.getRange(idx, 20).setValue(data.interviewSchedule || ''); 
                sheet.getRange(idx, 21).setValue(data.interviewResult || '');   
                sheet.getRange(idx, 22).setValue(data.trainingStart || '');
            });

            cleanUpApplicantData();

            return ContentService.createTextOutput(JSON.stringify({ 
                status: 'success', 
                message: matchingIndices.length + '개의 동일 데이터가 모두 업데이트되었습니다.'
            })).setMimeType(ContentService.MimeType.JSON);
        } else {
            const sample = displayRows.length > 1 ? `[성함:${displayRows[1][1]}, 생일:${displayRows[1][2]}]` : '데이터 없음';
            return ContentService.createTextOutput(JSON.stringify({ 
                status: 'error', 
                message: '지원자를 찾을 수 없습니다.\n\n[진단]\n- 찾는 이름: ' + targetName + '\n- 찾는 생일(6자리): ' + targetBirth + '\n- 시트 샘플: ' + sample
            })).setMimeType(ContentService.MimeType.JSON);
        }

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: '실행 오류: ' + error.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

/** [디버깅] 스크립트 에디터에서 선택 후 실행 */
function testMatch() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('지원자 DB');
  const rows = sheet.getDataRange().getValues();
  
  const getUniversalId = (val) => {
    if (!val) return '';
    let d;
    if (val instanceof Date) { d = val; } 
    else {
      let s = val.toString().trim();
      let nums = s.match(/\d+/g);
      if (nums && nums.length >= 3) {
        let y = parseInt(nums[0]); if (y < 100) y += 2000;
        let m = parseInt(nums[1]) - 1, day = parseInt(nums[2]);
        let hh = parseInt(nums[3] || 0), mm = parseInt(nums[4] || 0), ss_ = parseInt(nums[5] || 0);
        if (s.indexOf('오후') !== -1 || s.indexOf('PM') !== -1) { if (hh < 12) hh += 12; }
        else if (s.indexOf('오전') !== -1 || s.indexOf('AM') !== -1) { if (hh === 12) hh = 0; }
        d = new Date(y, m, day, hh, mm, ss_);
      } else { d = new Date(s); }
    }
    if (d && !isNaN(d.getTime())) return Utilities.formatDate(d, ss.getSpreadsheetTimeZone(), "yyyyMMddHHmmss");
    return val.toString().replace(/[^0-9]/g, '');
  };

  if (rows.length > 1) {
    const sheetId = rows[1][0];
    const appIdFromUser = "2026. 3. 6. 오후 2:24:34"; 
    Logger.log('--- v6 테스트 ---');
    Logger.log('시트 원본: ' + sheetId);
    Logger.log('시트 변환: ' + normalizeTimestamp(sheetId));
    Logger.log('앱 전송 원본: ' + appIdFromUser);
    Logger.log('앱 전송 변환: ' + normalizeTimestamp(appIdFromUser));
    Logger.log('결과: ' + (normalizeTimestamp(sheetId) === normalizeTimestamp(appIdFromUser)));
  }
}

function cleanUpApplicantData() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("지원자 DB");
    if (!sheet) return;
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    const range = sheet.getRange(2, 19, lastRow - 1, 4);
    const data = range.getValues();
    let isModified = false;
    for (let i = 0; i < data.length; i++) {
        if (String(data[i][2]).trim() === "불합") {
            if (data[i][0] !== "" || data[i][1] !== "" || data[i][2] !== "" || data[i][3] !== "") {
                data[i][0] = ""; data[i][1] = ""; data[i][2] = ""; data[i][3] = "";
                isModified = true;
            }
        }
    }
    if (isModified) range.setValues(data);
}
