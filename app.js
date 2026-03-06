const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1oiPOeJBg9f0IADWTRJ1cLoi0yMAdlXb1FvugcvsiOI4/gviz/tq?tqx=out:csv&gid=44927970';
let GAS_URL = localStorage.getItem('adot_gas_url') || '';

const grid = document.getElementById('grid');
const loadingOverlay = document.getElementById('loading-overlay');
const errorMessage = document.getElementById('error-message');
const searchInput = document.getElementById('search-input');

// Modal Elements
const modal = document.getElementById('modal-overlay');
const closeModal = document.getElementById('close-modal');
const scheduleForm = document.getElementById('schedule-form');
const scheduleInput = document.getElementById('schedule-input');
const submitScheduleBtn = document.getElementById('submit-schedule');

let allApplicants = [];
let currentApplicant = null;

// Fetch and render data
async function init() {
    try {
        console.log('Fetching data from Google Sheets...');
        loadingOverlay.style.opacity = '1';
        loadingOverlay.style.display = 'flex';
        errorMessage.style.display = 'none';

        const response = await fetch(SHEET_URL);
        if (!response.ok) {
            console.error('Fetch failed:', response.status);
            throw new Error(`HTTP Error ${response.status}`);
        }

        const data = await response.text();
        allApplicants = parseCSV(data);
        console.log('Successfully fetched', allApplicants.length, 'applicants.');

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
    const lines = csv.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    const result = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const fields = [];
        let currentField = '';
        let inQuotes = false;

        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                fields.push(currentField.trim());
                currentField = '';
            } else {
                currentField += char;
            }
        }
        fields.push(currentField.trim());

        if (fields.length < 5) continue;

        // Mapping: A:ID(0), B:Name(1), C:Birth(2), D:Age(3), E:Photo(4), F:B1(5), G:B2(6), H:B3(7), I:Schedule(8), J:Degree(9), K:School(10), L:Address(11), M:Email(12), N:Military(13)
        const rawDate = fields[0] || '';
        const formattedDate = formatDate(rawDate);

        const obj = {
            id: rawDate, // Column A still used as ID for updates
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
            vision: '',
            schedule: fields[8] || '',
            degree: fields[9] || '',
            school: fields[10] || '',
            address: fields[11] || '-',
            email: fields[12] || '-',
            military: fields[13] || '-'
        };
        result.push(obj);
    }
    return result;
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

// Fixed Drive URL Converter (Using lh3.googleusercontent.com which is more stable for <img> tags)
function getDirectDriveUrl(url) {
    if (!url) return '';
    const idMatch = url.match(/id=([^&]+)/) || url.match(/\/d\/([^/]+)/);
    if (idMatch && idMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
    }
    return url;
}

function renderCards(applicants) {
    grid.innerHTML = '';
    applicants.forEach((applicant, index) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.animation = `cardAppear 0.8s cubic-bezier(0.23, 1, 0.32, 1) forwards ${index * 0.1}s`;
        card.style.opacity = '0';

        const branchTags = applicant.branches.map((b, i) => `<span class="tag branch-tag" style="background: rgba(0, 122, 255, 0.1); color: var(--primary); padding: 5px 12px; border-radius: 8px; font-size: 0.85rem; font-weight: 700;">${i + 1}지망: ${b}</span>`).join('');

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <span style="font-size: 0.75rem; font-weight: 800; color: #999; letter-spacing: 0.05em;">${applicant.date} 접수</span>
            </div>
            <div class="card-branches">
                ${branchTags}
            </div>
            <div class="card-photo-container">
                ${applicant.photo ? `<img src="${applicant.photo}" class="card-photo" alt="${applicant.name}">` : `<div class="card-photo-placeholder">${applicant.name.charAt(0)}</div>`}
            </div>
            <div class="card-info">
                <div>
                   <h3 class="card-name">${applicant.name}</h3>
                   <div class="card-sub-info">
                       <div style="margin-bottom: 4px;">
                           <span>${applicant.birth}</span>
                           ${applicant.age ? `<span class="card-age">(${applicant.age}세)</span>` : ''}
                       </div>
                       ${(applicant.degree || applicant.school) ? `
                       <div class="education-info" style="font-size: 0.85rem; color: var(--primary); opacity: 0.9; font-weight: 700;">
                           ${applicant.degree}${applicant.degree && applicant.school ? ' · ' : ''}${applicant.school}
                       </div>` : ''}
                   </div>
                </div>
                <div class="click-cue">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                </div>
            </div>
        `;

        card.onclick = () => openDetail(applicant);
        grid.appendChild(card);
    });
}

function openDetail(applicant) {
    currentApplicant = applicant;
    document.getElementById('modal-name').innerText = applicant.name;
    document.getElementById('modal-birth').innerText = `${applicant.birth} ${applicant.age ? `(${applicant.age}세)` : ''}`;

    // Sidebar Details
    const photoContainer = document.getElementById('modal-photo-container');
    photoContainer.innerHTML = applicant.photo
        ? `<img src="${applicant.photo}" class="card-photo" style="width: 100%; height: 100%; object-fit: cover;" alt="${applicant.name}">`
        : `<div class="card-photo-placeholder" style="font-size: 5rem; font-weight: 900; opacity: 0.1;">${applicant.name.charAt(0)}</div>`;

    document.getElementById('modal-email').innerText = applicant.email;
    document.getElementById('modal-address').innerText = applicant.address;
    document.getElementById('modal-military').innerText = applicant.military;

    const tagsContainer = document.getElementById('modal-tags');
    tagsContainer.innerHTML = applicant.branches.map((b, i) => `
        <span class="tag" style="background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); font-size: 0.85rem; padding: 8px 14px; border-radius: 10px; font-weight: 700;">${i + 1}지망: ${b}</span>
    `).join('');

    scheduleInput.value = applicant.schedule || '';

    modal.classList.add('active');
}

closeModal.onclick = () => {
    modal.classList.remove('active');
};

window.onclick = (event) => {
    if (event.target == modal) {
        modal.classList.remove('active');
    }
};

// Form Submission
scheduleForm.onsubmit = async (e) => {
    e.preventDefault();

    if (!GAS_URL) {
        const promptUrl = prompt('데이터 전송을 위해 Google Apps Script 배포 URL을 입력해주세요 (브라우저에 저장됩니다):');
        if (promptUrl) {
            GAS_URL = promptUrl;
            localStorage.setItem('adot_gas_url', GAS_URL);
        } else {
            return;
        }
    }

    const scheduleValue = scheduleInput.value.trim();
    if (!scheduleValue) return;

    submitScheduleBtn.innerText = '업데이트 중...';
    submitScheduleBtn.disabled = true;

    try {
        const payload = {
            id: currentApplicant.id, // Using ID now for update
            interviewSchedule: scheduleValue
        };

        await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            mode: 'no-cors'
        });

        alert('일정이 성공적으로 저장되었습니다!');
        modal.classList.remove('active');

        setTimeout(() => init(), 1500);

    } catch (error) {
        console.error('Schedule update error:', error);
        alert('일정 저장 중 오류가 발생했습니다.');
    } finally {
        submitScheduleBtn.innerText = '시트 업데이트 하기';
        submitScheduleBtn.disabled = false;
    }
};

// Search functionality (Focusing on Branch names)
searchInput.placeholder = "지망 지점명으로 검색 (예: 강남, 서초)...";
searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    if (!term) {
        renderCards(allApplicants);
        return;
    }
    const filtered = allApplicants.filter(app => {
        return app.branches.some(b => b.toLowerCase().includes(term));
    });
    renderCards(filtered);
});

init();
