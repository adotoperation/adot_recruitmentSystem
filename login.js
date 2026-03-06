const PASS_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1oiPOeJBg9f0IADWTRJ1cLoi0yMAdlXb1FvugcvsiOI4/gviz/tq?tqx=out:csv&gid=485806929';

const loginForm = document.getElementById('login-form');
const branchInput = document.getElementById('login-branch');
const passwordInput = document.getElementById('login-password');
const rememberCheckbox = document.getElementById('remember-me');
const loginError = document.getElementById('login-error');
const loginBtn = document.getElementById('login-btn');

// Load saved login info if exists
document.addEventListener('DOMContentLoaded', () => {
    const savedBranch = localStorage.getItem('remembered_branch');
    if (savedBranch) {
        branchInput.value = savedBranch;
        rememberCheckbox.checked = true;
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.style.display = 'none';
    loginBtn.innerText = '인증 중...';
    loginBtn.disabled = true;

    const inputBranch = branchInput.value.trim();
    const inputPass = passwordInput.value.trim();

    try {
        const response = await fetch(PASS_SHEET_URL);
        if (!response.ok) throw new Error('데이터를 가져올 수 없습니다.');
        
        const csvText = await response.text();
        const isValid = validateCredentials(csvText, inputBranch, inputPass);

        if (isValid) {
            // Save login info if requested
            if (rememberCheckbox.checked) {
                localStorage.setItem('remembered_branch', inputBranch);
            } else {
                localStorage.removeItem('remembered_branch');
            }

            // Store session
            localStorage.setItem('recruit_session', JSON.stringify({
                branch: inputBranch,
                timestamp: new Date().getTime()
            }));
            window.location.href = 'index.html';
        } else {
            loginError.style.display = 'block';
            loginBtn.innerText = '로그인';
            loginBtn.disabled = false;
        }
    } catch (error) {
        console.error('Login error:', error);
        loginError.innerText = '서버 연결 오류가 발생했습니다.';
        loginError.style.display = 'block';
        loginBtn.innerText = '로그인';
        loginBtn.disabled = false;
    }
});

function validateCredentials(csv, branch, pass) {
    // Split by any newline character and filter out empty lines
    const rows = csv.split(/\r?\n/).filter(line => line.trim() !== '');
    
    // Process all rows since there is no header
    for (let i = 0; i < rows.length; i++) {
        const cols = rows[i].split(',').map(c => c.replace(/"/g, '').trim());
        if (cols.length >= 2) {
            const dbBranch = cols[0];
            const dbPass = cols[1];
            
            console.log(`Checking: ${dbBranch} vs ${branch}`); // Debug info
            
            if (dbBranch === branch && dbPass === pass) {
                return true;
            }
        }
    }
    return false;
}

// Anti-flicker: If already logged in, redirect to index
if (localStorage.getItem('recruit_session')) {
    window.location.href = 'index.html';
}
