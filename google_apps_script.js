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
