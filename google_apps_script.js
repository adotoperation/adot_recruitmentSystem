/**
 * Google Apps Script for A-dot Instructor Scheduling Dashboard
 * Handles writing interview schedules to Column F.
 */

function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName('지원자 DB');

        // Column Mapping (FINAL): 
        // A: ID (index 0)
        // I: Phone (index 8)
        // S: Branch Name (index 18)
        // T: Interview Schedule (index 19)
        // U: Interview Result (index 20)
        // V: Group Training Start Date (index 21)

        const rows = sheet.getDataRange().getDisplayValues();
        let rowIndex = -1;

        // Find the applicant by ID (Unique Identifier in Column A)
        // Normalize the ID by removing all non-numeric characters to prevent formatting mismatches
        const normalizeId = (id) => id ? id.toString().replace(/[^0-9]/g, '') : '';
        const searchId = normalizeId(data.id);

        for (let i = 1; i < rows.length; i++) {
            if (rows[i][0] && normalizeId(rows[i][0]) === searchId) { // Column A is index 0
                rowIndex = i + 1;
                break;
            }
        }

        if (rowIndex > 0) {
            // Update Management Columns
            // S (column 19/index 18): Branch Name
            const branchName = (data.status && data.assignedBranch) ? data.assignedBranch : '';
            sheet.getRange(rowIndex, 19).setValue(branchName);

            // T (column 20/index 19): Interview Schedule
            sheet.getRange(rowIndex, 20).setValue(data.interviewSchedule || '');

            // U (column 21/index 20): Interview Result
            sheet.getRange(rowIndex, 21).setValue(data.interviewResult || '');

            // V (column 22/index 21): Group Training Start Date
            sheet.getRange(rowIndex, 22).setValue(data.trainingStart || '');

            // [추가 로직] 데이터 입력 직후 즉시 불합격자 정리 실행
            cleanUpApplicantData();

            return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: '정보가 업데이트되었습니다.' }))
                .setMimeType(ContentService.MimeType.JSON);
        } else {
            return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'ID를 찾을 수 없습니다: ' + data.id }))
                .setMimeType(ContentService.MimeType.JSON);
        }

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

/**
 * S, T, U열을 일괄 정리하는 최적화 함수
 * U열이 "불합"이고 T열이 비어있지 않을 때만 삭제
 */
function cleanUpApplicantData() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("지원자 DB");
    if (!sheet) return;

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    // S(19), T(20), U(21) 열을 메모리로 가져옴
    const range = sheet.getRange(2, 19, lastRow - 1, 3);
    const data = range.getValues();
    let isModified = false;

    for (let i = 0; i < data.length; i++) {
        const tValue = data[i][1];             // T열
        const uValue = String(data[i][2]).trim(); // U열

        // 조건: U열이 "불합"이고 T열이 비어있지 않을 때만 삭제
        if (uValue === "불합" && tValue !== "") {
            data[i][0] = ""; // S열 삭제 (지점명)
            data[i][1] = ""; // T열 삭제 (면접일정)
            data[i][2] = ""; // U열 삭제 (면접결과)
            isModified = true;
        }
    }

    // 변경사항이 있을 때만 단 한 번 시트에 덮어쓰기
    if (isModified) {
        range.setValues(data);
    }
}
