/**
 * Google Apps Script for A-dot Instructor Scheduling Dashboard
 * Handles writing interview schedules to Column F.
 */

function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName('지원자 DB');

        // Column Mapping (NEW): 
        // A: ID, B: 이름, C: 생년월일, D: 나이, E: 사진, F: 1지망, G: 2지망, H: 3지망, I: 면접 일정

        const rows = sheet.getDataRange().getValues();
        let rowIndex = -1;

        // Find the applicant by ID (Unique Identifier in Column A)
        for (let i = 1; i < rows.length; i++) {
            if (rows[i][0].toString() === data.id.toString()) { // Column A is index 0
                rowIndex = i + 1;
                break;
            }
        }

        if (rowIndex > 0) {
            // Update Column I (index 8) with interview schedule
            sheet.getRange(rowIndex, 9).setValue(data.interviewSchedule);
            return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: '면접 일정이 업데이트되었습니다.' }))
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
