const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1oiPOeJBg9f0IADWTRJ1cLoi0yMAdlXb1FvugcvsiOI4/gviz/tq?tqx=out:csv&gid=44927970';
const BRANCH_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1oiPOeJBg9f0IADWTRJ1cLoi0yMAdlXb1FvugcvsiOI4/gviz/tq?tqx=out:csv&gid=836080731';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwL8xT-LzNROnOymPK9jrDPYFwQ7Fry_fAUrimfkLi0bQzl-b36fqLapDh4_R2C2M6jKw/exec';

const gridPass = document.getElementById('grid-pass');
const gridFinalized = document.getElementById('grid-finalized');
const gridAll = document.getElementById('grid-all');
const countPass = document.getElementById('count-pass');
const countFinalized = document.getElementById('count-finalized');
const countAll = document.getElementById('count-all');
const loadingOverlay = document.getElementById('loading-overlay');
const errorMessage = document.getElementById('error-message');
const searchInput = document.getElementById('search-input');

// Modal Elements
const modal = document.getElementById('modal-overlay');
const closeModal = document.getElementById('close-modal');
const scheduleForm = document.getElementById('schedule-form');
const submitScheduleBtn = document.getElementById('submit-schedule');

let allApplicants = [];
let currentApplicant = null;
let uniqueBranches = [];

/**
 * Premium Cool-Toned Toast Notification
 */
function showToast(title, message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'warning') icon = '⚠️';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

// Fetch and render data
async function init() {
    try {
        console.log('Fetching data from Google Sheets...');
        loadingOverlay.style.opacity = '1';
        loadingOverlay.style.display = 'flex';
        errorMessage.style.display = 'none';

        const sessionData = JSON.parse(localStorage.getItem('recruit_session') || '{}');
        const userDisplay = document.getElementById('user-branch-display');
        if (userDisplay) {
            userDisplay.innerText = sessionData.branch ? `${sessionData.branch} 계정` : '알 수 없는 사용자';
        }

        const response = await fetch(SHEET_URL);
        if (!response.ok) {
            console.error('Fetch failed:', response.status);
            throw new Error(`HTTP Error ${response.status}`);
        }

        const data = await response.text();
        allApplicants = parseCSV(data);

        // Sorting: newest (descending) based on normalized ID/Date
        allApplicants.sort((a, b) => {
            return getSortableId(b.id).localeCompare(getSortableId(a.id));
        });

        // Filtering & Deduplication
        const seen = new Map();
        const deduplicated = [];
        allApplicants.forEach(app => {
            const cleanName = app.name.replace(/\s/g, '');
            const cleanBirth = app.birth.replace(/[^0-9]/g, '').slice(-6);

            // Filter: Name must not contain English and must be 4 chars or less
            const hasEnglish = /[a-zA-Z]/.test(cleanName);
            const isTooLong = cleanName.length > 4;
            
            if (hasEnglish || isTooLong) {
                return; // Skip this applicant
            }

            const key = `${cleanName}_${cleanBirth}`;
            if (!seen.has(key)) {
                seen.set(key, true);
                deduplicated.push(app);
            }
        });
        allApplicants = deduplicated;

        console.log('Successfully fetched, sorted, and deduplicated', allApplicants.length, 'applicants.');

        // Fetch master branch list
        await fetchBranches();

        renderCards(allApplicants);

        loadingOverlay.style.opacity = '0';
        setTimeout(() => loadingOverlay.style.display = 'none', 500);

        if (allApplicants.length === 0) {
            errorMessage.style.display = 'block';
            errorMessage.innerHTML = `
                <h2 style="color: var(--primary-color);">표시할 내용이 없습니다</h2>
                <p>구글 시트에 데이터가 있는지, 혹은 첫 행(헤더) 외에 데이터가 입력되었는지 확인해 주세요.</p>
            `;
        }

    } catch (error) {
        console.error('Connection issue:', error);
        loadingOverlay.style.display = 'none';
        errorMessage.style.display = 'block';
        errorMessage.innerHTML = `
            <h2 style="color: var(--accent-color);">구글 시트 연결 실패</h2>
            <p>1. 구글 시트에서 <b>[파일] > [공유] > [웹에 게시]</b>를 완료했는지 확인해 주세요.</p>
            <p>2. 시트의 공유 권한이 '링크가 있는 모든 사용자'로 되어 있는지 확인해 주세요.</p>
            <p style="font-size: 0.8rem; margin-top:20px; color: #999;">Error: ${error.message}</p>
        `;
    }
}

// Robust CSV Parser (Handles quoted fields, commas, and multi-line content correctly)
function parseCSV(csv) {
    const result = [];
    let currentField = '';
    let inQuotes = false;
    let fields = [];

    // Iterate through every character to handle quotes and newlines within fields
    for (let i = 0; i < csv.length; i++) {
        const char = csv[i];
        const nextChar = csv[i + 1];

        if (char === '"') {
            // Handle escaped quotes (double quotes "")
            if (inQuotes && nextChar === '"') {
                currentField += '"';
                i++; // Skip next quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            fields.push(currentField.trim());
            currentField = '';
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
            // End of line
            if (currentField || fields.length > 0) {
                fields.push(currentField.trim());
                if (fields.length >= 5) {
                    result.push(processFields(fields));
                }
                fields = [];
                currentField = '';
            }
            // Skip \n if we just handled \r
            if (char === '\r' && nextChar === '\n') i++;
        } else {
            currentField += char;
        }
    }

    // Push last field/row if exists
    if (fields.length > 0 || currentField) {
        fields.push(currentField.trim());
        if (fields.length >= 5) result.push(processFields(fields));
    }

    // Skip header row
    return result.slice(1);
}

// Helper to get a sortable string from timestamp (Column A)
function getSortableId(s) {
    if (!s) return "";
    let nums = s.match(/\d+/g);
    // If not a standard-looking date string, return digits only
    if (!nums || nums.length < 3) return s.replace(/[^0-9]/g, "");
    
    let y = nums[0]; 
    if (y.length === 2) y = "20" + y;
    
    let m = nums[1].padStart(2, '0');
    let d = nums[2].padStart(2, '0');
    let hh = (nums[3] || "0").padStart(2, '0');
    let mm = (nums[4] || "0").padStart(2, '0');
    let ss = (nums[5] || "0").padStart(2, '0');
    
    // Handle Korean 오전/오후 (AM/PM)
    if (s.includes("오후") || s.includes("PM")) {
        let h = parseInt(hh);
        if (h < 12) hh = String(h + 12).padStart(2, '0');
    } else if (s.includes("오전") || s.includes("AM")) {
        if (hh === "12") hh = "00";
    }
    
    return y + m + d + hh + mm + ss;
}

// Helper to map fields to object (extracted for cleaner parseCSV)
function processFields(fields) {
    const rawDate = fields[0] || '';
    const formattedDate = formatDate(rawDate);

    return {
        id: rawDate,
        date: formattedDate,
        name: fields[1] || '이름 없음',
        birth: fields[2] || '정보 없음',
        age: fields[3] || '',
        photo: getDirectDriveUrl(fields[4] || ''),
        branches: [
            fields[5], // 1지망
            fields[6], // 2지망
            fields[7]  // 3지망
        ].filter(b => b),
        schedule: fields[19] || '', // Column T
        interviewResult: fields[20] || '', // Column U
        trainingStart: fields[21] || '', // Column V
        degree: fields[9] || '',
        school: fields[10] || '',
        address: fields[11] || '-',
        email: fields[12] || '-',
        military: fields[13] || '-',
        experience: fields[14] || '',
        introduction: fields[15] || '',
        strengths: fields[16] || '',
        vision: fields[17] || '',
        phone: fields[8] || '', // Column I
        assignedBranch: (fields[18] || '').replace(/"/g, '').trim(), // Column S (Branch Name)
        status: ((fields[18] || '').trim().length > 0) // Column S (If branch exists, status is true)
    };
}

// Function to fetch authoritative branch names from the '지점명' sheet
async function fetchBranches() {
    try {
        const response = await fetch(BRANCH_SHEET_URL);
        if (!response.ok) throw new Error(`Branch fetch failed: ${response.status}`);

        const csvText = await response.text();
        const lines = csvText.split('\n');
        const branches = new Set();

        // Skip header lines - assume data starts around line 2 or where we find names
        for (let i = 1; i < lines.length; i++) {
            // Some CSV parsers leave trailing commas. Split by comma but respect quotes if needed, 
            // though branch names usually don't have commas.
            const fields = lines[i].split(',');
            if (fields.length > 0) {
                const name = fields[0].replace(/"/g, '').trim();
                // Filter out empty rows or obvious headers
                if (name && name !== '지점명' && name !== '원/분원') {
                    branches.add(name);
                }
            }
        }

        uniqueBranches = Array.from(branches);
        console.log('Successfully fetched', uniqueBranches.length, 'branches.');

        const select = document.getElementById('branch-select');
        if (select) {
            select.innerHTML = '<option value="">지점 선택 안함</option>' +
                uniqueBranches.map(b => `<option value="${b}">${b}</option>`).join('');
        }
    } catch (error) {
        console.error('Error fetching branches:', error);
        // Fallback: If fetch fails, keep the dropdown empty or just with the default option
        const select = document.getElementById('branch-select');
        if (select) {
            select.innerHTML = '<option value="">지점 선택 안함 (데이터 로드 실패)</option>';
        }
    }
}

// Helper to format date string to YYYY.MM.DD
function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        // Simple regex to extract numbers
        const numbers = dateStr.match(/\d+/g);
        if (numbers && numbers.length >= 3) {
            const y = numbers[0];
            const m = numbers[1].padStart(2, '0');
            const d = numbers[2].padStart(2, '0');
            return `${y}.${m}.${d}`;
        }
    } catch (e) { }
    return dateStr;
}

// Helper to format date string for input fields (datetime-local and date)
function formatForInput(dateStr, type) {
    if (!dateStr) return '';
    try {
        const numbers = dateStr.match(/\d+/g);
        if (numbers && numbers.length >= 3) {
            const y = numbers[0];
            const m = numbers[1].padStart(2, '0');
            const d = numbers[2].padStart(2, '0');
            if (type === 'datetime-local' && numbers.length >= 5) {
                const hh = numbers[3].padStart(2, '0');
                const mm = numbers[4].padStart(2, '0');
                return `${y}-${m}-${d}T${hh}:${mm}`;
            }
            return `${y}-${m}-${d}`;
        }
    } catch (e) { }
    return dateStr.replace(' ', 'T'); // Fallback: replace space with T for datetime-local
}

// Fixed Drive URL Converter (Returns the Drive ID or original URL)
function getDirectDriveUrl(url) {
    if (!url || typeof url !== 'string') return '';

    const trimmedUrl = url.trim();
    // Handle Google Drive Link patterns
    const idMatch = trimmedUrl.match(/id=([^&]+)/) ||
        trimmedUrl.match(/\/d\/([^/]+)/) ||
        trimmedUrl.match(/\/file\/d\/([^/]+)/);

    if (idMatch && idMatch[1]) {
        return idMatch[1].replace('/view', '').split(/[?#]/)[0];
    }

    return trimmedUrl;
}

function renderCards(applicants) {
    const sessionData = JSON.parse(localStorage.getItem('recruit_session') || '{}');
    const myBranch = sessionData.branch || '';
    const isMaster = (myBranch === 'master');

    gridPass.innerHTML = '';
    gridFinalized.innerHTML = '';
    gridAll.innerHTML = '';

    const categories = {
        pass: [],
        finalized: [],
        others: []
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    applicants.forEach(app => {
        // Find correct birth string (checking C column and H column)
        let birthStr = app.birth;
        if (app.branches && app.branches[2] && /\d/.test(app.branches[2])) {
            birthStr = app.branches[2]; // fallback if user moved birth to H column
        }

        // Birth year filter: Only show if birth year is 1986 or later
        if (birthStr && birthStr.length >= 2) {
            let birthYear = 0;
            const match4 = birthStr.match(/^(\d{4})/);
            if (match4) {
                birthYear = parseInt(match4[1], 10);
            } else {
                const match2 = birthStr.match(/^(\d{2})/);
                if (match2) {
                    let y2 = parseInt(match2[1], 10);
                    // assuming 00-24 is 2000s, 25-99 is 1900s
                    birthYear = y2 <= 24 ? 2000 + y2 : 1900 + y2;
                }
            }

            // Filter OUT if birthYear is valid and <= 1985
            if (birthYear > 0 && birthYear <= 1985) {
                return;
            }
        }

        const isAssignedToMe = isMaster ? !!app.assignedBranch : (app.assignedBranch === myBranch);

        if (isAssignedToMe) {
            if (app.trainingStart) {
                // Hide if training date is in the past
                const trainingDate = new Date(app.trainingStart);
                if (trainingDate >= today) {
                    categories.finalized.push(app);
                }
            } else {
                categories.pass.push(app);
            }
        } else if (!app.assignedBranch) {
            // ONLY candidates without an assigned branch yet appear in the general pool
            categories.others.push(app);
        }
    });

    countPass.innerText = categories.pass.length;
    countFinalized.innerText = categories.finalized.length;
    countAll.innerText = categories.others.length;

    const createCard = (applicant, targetGrid, index) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.animation = `cardAppear 0.8s cubic-bezier(0.23, 1, 0.32, 1) forwards ${index * 0.1}s`;

        let statusBadge = '';
        if (applicant.trainingStart) {
            statusBadge = `<div class="status-badge" style="background:#f0fff4; color:#276749; border: 1px solid #c6f6d5; padding: 4px 10px; border-radius: 8px; font-size: 0.75rem; position: absolute; top: 15px; right: 15px; z-index: 10;">집체교육 대기${isMaster && applicant.assignedBranch ? ` (${applicant.assignedBranch})` : ''}</div>`;
        } else if (applicant.assignedBranch) {
            const isMyAssigned = (applicant.assignedBranch === myBranch);
            const badgeLabel = isMaster ? `서류 합격 (${applicant.assignedBranch})` : '서류 합격';
            statusBadge = `<div class="status-badge" style="background:#ebf8ff; color:#2b6cb0; border: 1px solid #bee3f8; padding: 4px 10px; border-radius: 8px; font-size: 0.75rem; position: absolute; top: 15px; right: 15px; z-index: 10;">${badgeLabel}</div>`;
        }

        const row1Raw = applicant.branches.slice(0, 2);
        const row2Raw = applicant.branches.slice(2, 3);

        const branchTagsRow1 = row1Raw.map((b, i) => `<span class="tag branch-tag">${i + 1}지망: ${b}</span>`).join('');
        const branchTagsRow2 = row2Raw.map((b, i) => `<span class="tag branch-tag">3지망: ${b}</span>`).join('');

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                <div class="card-date-top" style="font-size: 0.75rem; font-weight: 800; color: #999;">
                    접수: ${applicant.date}
                </div>
                ${statusBadge.replace('position: absolute; top: 15px; right: 15px;', 'position: relative; top: 0; right: 0;')}
            </div>
            <div class="card-branches" style="margin-bottom: 12px; display: flex; flex-direction: column; gap: 6px;">
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">${branchTagsRow1}</div>
                ${branchTagsRow2 ? `<div style="display: flex; gap: 6px; flex-wrap: wrap;">${branchTagsRow2}</div>` : ''}
            </div>
            <div class="card-photo-container">
                ${(function () {
                if (!applicant.photo) return `<div class="card-photo-placeholder" style="font-size: 3.5rem;">${applicant.name.charAt(0)}</div>`;
                const id = applicant.photo;
                if (id.length < 100) {
                    return `<img src="https://lh3.googleusercontent.com/d/${id}" class="card-photo" style="object-fit: cover; object-position: center 15%;" alt="${applicant.name}" loading="lazy"
                            onerror="if(!this.dataset.retry){ this.dataset.retry='1'; this.src='https://docs.google.com/uc?export=view&id=${id}'; } else { this.onerror=null; this.parentElement.innerHTML='<div class=\'card-photo-placeholder\'>권한 없음</div>'; }">`;
                }
                return `<img src="${applicant.photo}" class="card-photo" style="object-fit: cover; object-position: center 15%;" alt="${applicant.name}" loading="lazy" onerror="this.onerror=null; this.src='https://via.placeholder.com/300?text=Error';">`;
            })()}
            </div>
            <div class="card-info">
                <div>
                   <h3 class="card-name">${applicant.name}</h3>
                   <div class="card-sub-info">
                       <div style="margin-bottom: 4px;">
                           <span>${applicant.birth}</span>
                           ${applicant.age ? `<span class="card-age">(${applicant.age}세)</span>` : ''}
                       </div>
                       <div style="font-size: 0.85rem; color: #666; font-weight: 500; margin-top: 8px; line-height: 1.4;">
                           <div style="margin-bottom: 2px;">📍 ${applicant.address}</div>
                           <div>🎓 ${applicant.degree || '-'} / ${applicant.school || '-'}</div>
                       </div>
                   </div>
                </div>
                <div class="click-cue">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                </div>
            </div>
        `;

        card.onclick = () => openDetail(applicant);
        targetGrid.appendChild(card);
    };

    categories.pass.forEach((app, i) => createCard(app, gridPass, i));
    categories.finalized.forEach((app, i) => createCard(app, gridFinalized, i));
    categories.others.forEach((app, i) => createCard(app, gridAll, i));

    // Show/hide section headers if empty for better UX
    document.getElementById('section-pass').style.display = categories.pass.length ? 'block' : 'none';
    document.getElementById('section-finalized').style.display = categories.finalized.length ? 'block' : 'none';
}

function openDetail(applicant) {
    try {
        currentApplicant = applicant;
        document.getElementById('modal-name').innerText = applicant.name;
        document.getElementById('modal-birth').innerText = `${applicant.birth} ${applicant.age ? `(${applicant.age}세)` : ''}`;

        // Sidebar Details
        const photoContainer = document.getElementById('modal-photo-container');
        if (applicant.photo && applicant.photo.length < 100) {
            const id = applicant.photo;
            photoContainer.innerHTML = `<img src="https://lh3.googleusercontent.com/d/${id}" class="card-photo" style="width: 100%; height: 100%; object-fit: cover; object-position: top;" alt="${applicant.name}" 
                onerror="if(!this.dataset.retry){ this.dataset.retry='1'; this.src='https://docs.google.com/uc?export=view&id=${id}'; } else { this.onerror=null; this.parentElement.innerHTML='<div class=\'card-photo-placeholder\' style=\'padding:20px; font-size:1rem; color:#e53e3e; font-weight:700;\'>사진 권한이 없습니다.<br>공유 설정을 확인하세요.</div>'; }">`;
        } else if (applicant.photo) {
            photoContainer.innerHTML = `<img src="${applicant.photo}" class="card-photo" style="width: 100%; height: 100%; object-fit: cover; object-position: top;" alt="${applicant.name}" onerror="this.onerror=null; this.src='https://via.placeholder.com/300?text=Error';">`;
        } else {
            photoContainer.innerHTML = `<div class="card-photo-placeholder" style="font-size: 5rem; font-weight: 900; opacity: 0.1;">${applicant.name.charAt(0)}</div>`;
        }

        document.getElementById('modal-email').innerText = applicant.email;
        document.getElementById('modal-address').innerText = applicant.address;
        document.getElementById('modal-military').innerText = applicant.military;

        const tagsContainer = document.getElementById('modal-tags');
        tagsContainer.innerHTML = applicant.branches.map((b, i) => `
            <span class="tag" style="background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); font-size: 0.85rem; padding: 8px 14px; border-radius: 10px; font-weight: 700;">${i + 1}지망: ${b}</span>
        `).join('');

        // Main Details
        document.getElementById('modal-degree-detail').innerText = applicant.degree || '-';
        document.getElementById('modal-school-detail').innerText = applicant.school || '-';
        document.getElementById('modal-experience').innerText = applicant.experience || '-';
        document.getElementById('modal-introduction').innerText = applicant.introduction || '-';
        document.getElementById('modal-strengths').innerText = applicant.strengths || '-';
        document.getElementById('modal-vision').innerText = applicant.vision || '-';
        document.getElementById('modal-phone').innerText = applicant.phone || '-';
        
        const callBtn = document.getElementById('modal-phone-call');
        if (callBtn) {
            if (applicant.phone) {
                const purePhone = applicant.phone.replace(/[^0-9]/g, '');
                callBtn.href = `tel:${purePhone}`;
                callBtn.style.display = 'flex';
            } else {
                callBtn.style.display = 'none';
            }
        }

        // Management states
        const passCheckbox = document.getElementById('pass-checkbox');
        passCheckbox.checked = applicant.status;

        const interviewInput = document.getElementById('interview-date');
        const trainingInput = document.getElementById('training-date');
        const resultRadios = document.getElementsByName('interview-result');

        if (interviewInput) interviewInput.value = formatForInput(applicant.schedule, 'datetime-local') || '';
        if (trainingInput) trainingInput.value = formatForInput(applicant.trainingStart, 'date') || '';

        resultRadios.forEach(radio => {
            radio.checked = (radio.value === applicant.interviewResult);
        });

        // Initialize disabled states (don't clear existing data during initial open)
        toggleInterviewFields(applicant.status, false);

        modal.classList.add('active');
        document.body.classList.add('modal-open');
    } catch (err) {
        console.error('Error in openDetail:', err);
    }
}

// Helper to enable/disable fields based on Document Pass status
function toggleInterviewFields(isPassed, shouldClear = true) {
    const interviewInput = document.getElementById('interview-date');
    const trainingInput = document.getElementById('training-date');
    const resultRadios = document.getElementsByName('interview-result');
    const sections = [interviewInput, trainingInput, ...resultRadios];

    sections.forEach(el => {
        if (el) {
            el.disabled = !isPassed;
            el.style.opacity = isPassed ? '1' : '0.5';
            el.style.cursor = isPassed ? 'pointer' : 'not-allowed';
            if (!isPassed && shouldClear) {
                if (el.type !== 'radio') el.value = '';
                if (el.type === 'radio') el.checked = false;
            }
        }
    });

    const trainingSection = document.getElementById('training-section');
    if (trainingSection) {
        trainingSection.style.opacity = isPassed ? '1' : '0.5';
    }
}

// Add event listener for checkbox
document.getElementById('pass-checkbox').addEventListener('change', (e) => {
    toggleInterviewFields(e.target.checked);
});

closeModal.onclick = () => {
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
};

window.onclick = (event) => {
    if (event.target == modal) {
        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
    }
};

// Form Submission
scheduleForm.onsubmit = async (e) => {
    e.preventDefault();

    const interviewValue = document.getElementById('interview-date').value;
    const trainingValue = document.getElementById('training-date').value;
    const passStatus = document.getElementById('pass-checkbox').checked;

    const resultRadio = document.querySelector('input[name="interview-result"]:checked');
    const interviewResult = resultRadio ? resultRadio.value : '';

    // Validation 1: Interview schedule is REQUIRED if Document Passed
    if (passStatus && !interviewValue) {
        showToast('입력 확인', '서류 전형 합격 결정 시, 면접 일정을 반드시 입력해야 합니다.', 'warning');
        return;
    }

    // Validation 2: Training date is REQUIRED if Interview Passed
    if (interviewResult === '합합' && !trainingValue) {
        showToast('입력 확인', '면접 합격 시, 집체 교육 시작일을 반드시 입력해야 합니다.', 'warning');
        return;
    }

    // Get branch from session
    const sessionData = JSON.parse(localStorage.getItem('recruit_session') || '{}');
    const assignedBranch = passStatus ? (sessionData.branch || '') : '';

    if (!currentApplicant || !currentApplicant.id) {
        showToast('오류', '지원자 정보가 올바르지 않습니다. 다시 시도해 주세요.', 'error');
        return;
    }

    submitScheduleBtn.innerText = '저장 중...';
    submitScheduleBtn.disabled = true;

    try {
        const payload = {
            id: currentApplicant.id,
            name: currentApplicant.name,
            birth: currentApplicant.birth,
            phone: currentApplicant.phone,
            interviewSchedule: interviewValue,
            trainingStart: trainingValue,
            interviewResult: interviewResult,
            status: passStatus,
            assignedBranch: assignedBranch
        };

        // GAS sometimes needs mode: 'cors' or a specific header to avoid preflight if JSON
        // Using text/plain for the body prevents preflight OPTIONS request
        const response = await fetch(GAS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        // Capture raw text first to handle cases where GAS returns non-JSON
        const responseText = await response.text();
        console.log('Raw Response from GAS:', responseText);

        let result;
        try {
            result = JSON.parse(responseText);
        } catch (parseError) {
            console.error('JSON Parse Error:', parseError);
            throw new Error(`서버 응답이 올바른 형식이 아닙니다. (내용: ${responseText.substring(0, 50)}...)`);
        }

        if (result.status === 'success') {
            showToast('저장 완료', '정보가 성공적으로 저장되었습니다!', 'success');
            modal.classList.remove('active');
            document.body.classList.remove('modal-open');
            // Increased delay to 3 seconds for better Google Sheets propagation
            setTimeout(() => init(), 3000);
        } else {
            showToast('저장 실패', result.message, 'error');
        }

    } catch (error) {
        console.error('Update error:', error);
        showToast('네트워크 오류', `저장 중 오류가 발생했습니다. (${error.message})`, 'error');
    } finally {
        submitScheduleBtn.innerText = '저장하기';
        submitScheduleBtn.disabled = false;
    }
};

// Search functionality
searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    if (!term) {
        renderCards(allApplicants);
        return;
    }
    const filtered = allApplicants.filter(app => {
        const branchMatch = app.branches.some(b => b.toLowerCase().includes(term)) ||
            (app.assignedBranch && app.assignedBranch.toLowerCase().includes(term));
        return app.name.toLowerCase().includes(term) ||
            app.phone.includes(term) ||
            app.address.toLowerCase().includes(term) ||
            branchMatch;
    });
    renderCards(filtered);
});

init();

// Pull to Refresh Implementation
(function() {
    let startY = 0;
    let currentY = 0;
    let isPulling = false;
    const threshold = 80;
    const indicator = document.getElementById('pull-to-refresh-indicator');

    window.addEventListener('touchstart', (e) => {
        if (window.scrollY === 0) {
            startY = e.touches[0].pageY;
            isPulling = true;
        }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (!isPulling) return;
        currentY = e.touches[0].pageY;
        let diff = currentY - startY;

        if (diff > 0 && window.scrollY === 0) {
            // Prevent browser's default pull-to-refresh if possible
            if (diff > 10) {
                // e.preventDefault(); // can't prevent if passive
            }
            let pullDistance = Math.min(diff * 0.4, threshold + 20);
            indicator.style.transform = `translateY(${pullDistance}px)`;
            indicator.style.opacity = Math.min(pullDistance / threshold, 1);
        } else {
            isPulling = false;
        }
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
        if (!isPulling) return;
        isPulling = false;
        let diff = currentY - startY;
        
        if (diff >= threshold) {
            // Trigger refresh
            indicator.style.transform = `translateY(${threshold}px)`;
            indicator.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            
            // Show toast and refresh
            showToast('새로고침', '최신 데이터를 불러오는 중입니다...', 'info');
            init().then(() => {
                setTimeout(() => {
                    indicator.style.transform = 'translateY(0px)';
                    indicator.style.opacity = '0';
                }, 500);
            });
        } else {
            // Cancel
            indicator.style.transform = 'translateY(0px)';
            indicator.style.opacity = '0';
        }
        
        // Reset transition after animation
        setTimeout(() => {
            indicator.style.transition = 'transform 0.2s ease';
        }, 500);
    });
})();
