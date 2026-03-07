/**
 * Google Apps Script for A-dot Instructor Scheduling Dashboard
 * v5: Ultra-Robust Matching (Timestamp + Phone/Name Fallback)
 */

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

        // --- Standardized Normalization (v5) ---
        const getUniversalId = (val) => {
          if (!val) return '';
          let d;
          if (val instanceof Date) {
            d = val;
          } else {
            let s = val.toString().trim();
            // Handle Korean dates: "2026. 3. 6. 오후 2:24:34"
            let nums = s.match(/\d+/g);
            if (nums && nums.length >= 3) {
              let y = parseInt(nums[0]);
              if (y < 100) y += 2000;
              let m = parseInt(nums[1]) - 1;
              let day = parseInt(nums[2]);
              let hh = parseInt(nums[3] || 0);
              let mm = parseInt(nums[4] || 0);
              let ss_ = parseInt(nums[5] || 0);
              
              if (s.indexOf('오후') !== -1 || s.indexOf('PM') !== -1) {
                if (hh < 12) hh += 12;
              } else if (s.indexOf('오전') !== -1 || s.indexOf('AM') !== -1) {
                if (hh === 12) hh = 0;
              }
              d = new Date(y, m, day, hh, mm, ss_);
            } else {
              d = new Date(s);
            }
          }
          
          if (d && !isNaN(d.getTime())) {
            return Utilities.formatDate(d, ss.getSpreadsheetTimeZone(), "yyyyMMddHHmmss");
          }
          return val.toString().replace(/[^0-9]/g, '');
        };

        const getNumericPhone = (p) => p ? p.toString().replace(/[^0-9]/g, '') : '';

        const targetId = getUniversalId(data.id);
        const targetPhone = getNumericPhone(data.phone);
        const targetName = (data.name || '').toString().trim();

        for (let i = 1; i < rows.length; i++) {
            const rowArr = rows[i];
            const rowId = getUniversalId(rowArr[0]);
            const rowName = (rowArr[1] || '').toString().trim();
            const rowPhone = getNumericPhone(rowArr[8]);

            // Attempt 1: ID Match
            if (rowId === targetId && targetId !== '') {
                rowIndex = i + 1;
                break;
            }

            // Attempt 2: Phone + Name Match (Fallback)
            if (targetPhone !== '' && rowPhone === targetPhone) {
                if (targetName === '' || rowName.indexOf(targetName) !== -1) {
                    rowIndex = i + 1;
                    break;
                }
            }
        }

        if (rowIndex > 0) {
            sheet.getRange(rowIndex, 19).setValue((data.status && data.assignedBranch) ? data.assignedBranch : ''); 
            sheet.getRange(rowIndex, 20).setValue(data.interviewSchedule || ''); 
            sheet.getRange(rowIndex, 21).setValue(data.interviewResult || '');   
            sheet.getRange(rowIndex, 22).setValue(data.trainingStart || '');      

            cleanUpApplicantData();

            return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: '정보가 저장되었습니다.' }))
                .setMimeType(ContentService.MimeType.JSON);
        } else {
            const sample = rows.length > 1 ? `[성함:${rows[1][1]}, 연락처:${rows[1][8]}, 변환ID:${getUniversalId(rows[1][0])}]` : '데이터 없음';
            return ContentService.createTextOutput(JSON.stringify({ 
                status: 'error', 
                message: '지원자를 찾을 수 없습니다.\n\n[진단]\n- 앱 이름: ' + targetName + '\n- 앱 전화: ' + targetPhone + '\n- 앱 변환 ID: ' + targetId + '\n- 시트 샘플: ' + sample
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
    Logger.log('--- v5 테스트 ---');
    Logger.log('시트 원본: ' + sheetId);
    Logger.log('시트 변환: ' + getUniversalId(sheetId));
    Logger.log('앱 전송 원본: ' + appIdFromUser);
    Logger.log('앱 전송 변환: ' + getUniversalId(appIdFromUser));
    Logger.log('결과: ' + (getUniversalId(sheetId) === getUniversalId(appIdFromUser)));
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
