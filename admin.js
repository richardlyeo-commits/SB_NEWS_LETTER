// ============================================================
// admin.js   (버전: 20261004-02)
// 관리자가 로그인해서 글을 올리고(작성) / 고치고(수정) / 지우는(삭제) 기능을 담당합니다.
// 파일을 PDF나 사진으로 선택하면, 자동으로 "작은 미리보기 사진(썸네일)"과
// "화면에서 크게 볼 수 있는 사진들"을 만들어서 GitHub 저장소에 올려줍니다.
// (PDF 파일을 그대로 올리지 않기 때문에, 보는 사람은 PDF 프로그램 없이도
//  소식지를 바로 화면에서 볼 수 있습니다.)
//
// [2026-10-04 수정] 관리자로 로그인하는 순간 검색/연도/월 필터가 풀리고
// 전체 목록이 다시 보이던 문제를 고쳤습니다. (handleAuthSubmit 함수 참고)
// ============================================================

const ADMIN_PASSWORD = "6666";           // 관리자 비밀번호
const GITHUB_OWNER = 'richardlyeo-commits'; // GitHub 저장소 소유자 이름

let pendingAction = null;
let targetEditItem = null;

// 이번에 선택한 파일로 새로 만든 썸네일/페이지 이미지를 잠깐 담아두는 곳
// (저장 버튼을 눌러야 실제로 GitHub에 업로드됩니다)
let generatedThumbDataUrl = null;   // 작은 미리보기 이미지 1장 (data:image/jpeg;base64,...)
let generatedPageDataUrls = [];     // 크게 볼 때 쓰는 이미지들(PDF면 여러 장일 수 있음)

// 날짜(YYYY년도 기준)에 따라 어느 저장소(SB_NEWS_LETTER / SB_NEWS_2027)에 저장할지 정합니다.
function getRepoByDate(dateStr) {
    if (!dateStr) return 'SB_NEWS_LETTER';
    const year = parseInt(dateStr.substring(0, 4), 10);
    return year >= 2027 ? 'SB_NEWS_2027' : 'SB_NEWS_LETTER';
}

// ---------------- 로그인(인증) 모달 ----------------

function openAuthModal(action, item = null) {
    pendingAction = action;
    targetEditItem = item;
    document.getElementById('authModal').classList.remove('hidden');
    document.getElementById('authModal').classList.add('flex');
    document.getElementById('adminPasswordInput').value = '';
    document.getElementById('githubTokenInput').value = localStorage.getItem('sb_gh_token') || '';
    document.getElementById('adminPasswordInput').focus();
}

function closeAuthModal() {
    document.getElementById('authModal').classList.add('hidden');
    document.getElementById('authModal').classList.remove('flex');
}

function handleAuthSubmit(e) {
    e.preventDefault();
    const password = document.getElementById('adminPasswordInput').value;
    const token = document.getElementById('githubTokenInput').value.trim();

    if (password !== ADMIN_PASSWORD) {
        alert("비밀번호가 올바르지 않습니다.");
        return;
    }

    if (token) {
        localStorage.setItem('sb_gh_token', token);
    }

    isAdminMode = true;
    // (버그 수정 2026-10-04) 전체 목록으로 되돌리지 않고, 지금 검색/연도/월로
    // 걸러둔 상태를 그대로 유지한 채 수정/삭제 버튼만 추가로 보이게 합니다.
    applyFilters();
    closeAuthModal();

    if (pendingAction === 'create') {
        openUploadModal(false, null);
    } else if (pendingAction === 'edit' && targetEditItem) {
        openUploadModal(true, targetEditItem);
    } else if (pendingAction === 'delete' && targetEditItem) {
        executeDelete(targetEditItem);
    }
}

function handleEditClick(id) {
    const data = getCurrentData();
    const item = data.find(i => String(i.id) === String(id));
    if (!item) {
        alert("선택한 항목의 정보를 찾을 수 없습니다.");
        return;
    }
    targetEditItem = item;
    openUploadModal(true, item);
}

function handleDeleteClick(id) {
    const data = getCurrentData();
    const item = data.find(i => String(i.id) === String(id));
    if (!item) return;

    targetEditItem = item;
    if (confirm(`'${item.title}' 항목을 정말 삭제하시겠습니까?`)) {
        executeDelete(item);
    }
}

// ---------------- 작성/수정 모달 ----------------

function openUploadModal(isEdit = false, item = null) {
    const modalTitle = document.getElementById('modalTitle');
    const fileNotice = document.getElementById('fileChangeNotice');
    const fileInput = document.getElementById('postFile');

    document.getElementById('uploadForm').reset();
    resetThumbPreview();
    targetEditItem = item;

    document.getElementById('uploadModal').classList.remove('hidden');
    document.getElementById('uploadModal').classList.add('flex');

    if (isEdit && item) {
        modalTitle.innerText = "소식지/공지 수정";
        document.getElementById('editItemId').value = String(item.id);
        document.getElementById('postCategory').value = currentTab;
        document.getElementById('postDate').value = item.date || new Date().toISOString().substring(0, 10);
        document.getElementById('postTitle').value = item.title || '';
        document.getElementById('postSummary').value = item.summary || '';
        document.getElementById('postTags').value = Array.isArray(item.tags) ? item.tags.join(', ') : '';
        fileInput.required = false;
        fileNotice.classList.remove('hidden');
    } else {
        modalTitle.innerText = "새 글 업로드";
        document.getElementById('editItemId').value = '';
        document.getElementById('postCategory').value = currentTab;
        document.getElementById('postDate').value = new Date().toISOString().substring(0, 10);
        fileInput.required = true;
        fileNotice.classList.add('hidden');
    }
}

function closeUploadModal() {
    document.getElementById('uploadModal').classList.add('hidden');
    document.getElementById('uploadModal').classList.remove('flex');
    document.getElementById('uploadForm').reset();
    resetThumbPreview();
    targetEditItem = null;
}

function resetThumbPreview() {
    generatedThumbDataUrl = null;
    generatedPageDataUrls = [];
    document.getElementById('thumbPreviewWrap').classList.add('hidden');
}

// ---------------- ① 파일을 고르면 자동으로 썸네일 + 날짜/제목 추정 ----------------

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('postFile');
    if (fileInput) fileInput.addEventListener('change', handleFileSelected);
});

async function handleFileSelected(e) {
    const file = e.target.files[0];
    resetThumbPreview();
    if (!file) return;

    const wrap = document.getElementById('thumbPreviewWrap');
    const statusEl = document.getElementById('thumbPreviewStatus');
    const previewImg = document.getElementById('thumbPreviewImg');
    wrap.classList.remove('hidden');
    statusEl.innerText = '썸네일을 만드는 중입니다...';
    previewImg.src = '';

    // 파일 이름으로 날짜/제목을 추측해서 자동으로 입력해둡니다. (틀리면 고치면 됩니다)
    autoFillDateAndTitle(file.name);

    try {
        if (file.type === 'application/pdf') {
            // PDF -> 각 쪽을 이미지로 변환
            const { thumbDataUrl, pageDataUrls } = await renderPdfToImages(file);
            generatedThumbDataUrl = thumbDataUrl;
            generatedPageDataUrls = pageDataUrls;
        } else {
            // 사진(JPG/PNG 등) -> 크기만 줄여서 썸네일로 사용, 원본은 그대로 1쪽으로 사용
            generatedThumbDataUrl = await resizeImageFile(file, 480, 0.78);
            generatedPageDataUrls = [await resizeImageFile(file, 1400, 0.85)];
        }
        previewImg.src = generatedThumbDataUrl;
        statusEl.innerText = `썸네일 생성 완료! (${generatedPageDataUrls.length}쪽)`;
    } catch (err) {
        console.error(err);
        statusEl.innerText = '썸네일 생성에 실패했습니다. 그래도 저장은 진행할 수 있어요.';
    }
}

// 파일명에서 날짜를 추측합니다. 예: 20260923_소식지.pdf / 260921_소식지.pdf / (26.09.02) 승무원 복장.pdf
function autoFillDateAndTitle(filename) {
    let y, m, d;

    // 8자리(20260923) 패턴
    let match = filename.match(/(20\d{2})[.\-_]?(\d{2})[.\-_]?(\d{2})/);
    if (match) {
        y = match[1]; m = match[2]; d = match[3];
    } else {
        // 6자리(260921) 또는 (26.09.02) 같은 2자리 연도 패턴
        match = filename.match(/(\d{2})[.\-_]?(\d{2})[.\-_]?(\d{2})/);
        if (match) { y = '20' + match[1]; m = match[2]; d = match[3]; }
    }

    if (y && m && d) {
        const mm = String(Math.min(Math.max(parseInt(m, 10), 1), 12)).padStart(2, '0');
        const dd = String(Math.min(Math.max(parseInt(d, 10), 1), 31)).padStart(2, '0');
        const guessedDate = `${y}-${mm}-${dd}`;

        const dateInput = document.getElementById('postDate');
        dateInput.value = guessedDate;

        const titleInput = document.getElementById('postTitle');
        if (!titleInput.value) {
            const category = document.getElementById('postCategory').value;
            const label = category === 'notices' ? '공지' : '주간 소식지';
            titleInput.value = `${y}년 ${parseInt(mm, 10)}월 ${parseInt(dd, 10)}일자 ${label}`;
        }
    }
}

// 이미지 파일을 정해진 너비로 줄여서 JPEG data URL로 돌려주는 함수
function resizeImageFile(file, maxWidth, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, maxWidth / img.width);
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
            img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// PDF 파일을 브라우저 안에서 페이지별 이미지로 바꿔주는 함수 (pdf.js 라이브러리 사용)
async function renderPdfToImages(file) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const pageDataUrls = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.8 }); // 화질(선명함) 조절값
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        pageDataUrls.push(canvas.toDataURL('image/jpeg', 0.85));
    }

    // 1쪽을 작게 줄여서 썸네일로 사용
    const thumbDataUrl = await shrinkDataUrl(pageDataUrls[0], 480, 0.78);
    return { thumbDataUrl, pageDataUrls };
}

// 이미 만들어진 data URL 이미지를 더 작게 줄여주는 보조 함수(썸네일용)
function shrinkDataUrl(dataUrl, maxWidth, quality) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(1, maxWidth / img.width);
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
}

// ---------------- ② 저장(GitHub 업로드) ----------------

async function handleFormSubmit(e) {
    e.preventDefault();

    const token = localStorage.getItem('sb_gh_token');
    if (!token) {
        alert("GitHub 토큰이 설정되지 않았습니다. 관리자 인증 시 토큰을 입력해 주세요.");
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    const editId = document.getElementById('editItemId').value;
    const category = document.getElementById('postCategory').value;
    const date = document.getElementById('postDate').value;
    const title = document.getElementById('postTitle').value;
    const summary = document.getElementById('postSummary').value;
    const tagsInput = document.getElementById('postTags').value;

    const targetRepo = getRepoByDate(date);

    submitBtn.disabled = true;

    try {
        // 수정 시 새 파일을 올리지 않으면 기존 썸네일/이미지를 그대로 사용합니다.
        let thumbnailPath = targetEditItem ? targetEditItem.thumbnail : '';
        let pagesPaths = targetEditItem ? (targetEditItem.pages_images || []) : [];

        if (generatedThumbDataUrl && generatedPageDataUrls.length > 0) {
            const stamp = Date.now();

            submitBtn.innerText = "썸네일 올리는 중...";
            const thumbRawPath = `thumbs/${stamp}.jpg`;
            await uploadToGitHub(targetRepo, thumbRawPath, dataUrlToBase64(generatedThumbDataUrl), `Upload thumbnail for: ${title}`, null, token);
            thumbnailPath = `./${thumbRawPath}`;

            pagesPaths = [];
            for (let i = 0; i < generatedPageDataUrls.length; i++) {
                submitBtn.innerText = `이미지 올리는 중... (${i + 1}/${generatedPageDataUrls.length})`;
                const pageRawPath = `pages/${stamp}_${i + 1}.jpg`;
                await uploadToGitHub(targetRepo, pageRawPath, dataUrlToBase64(generatedPageDataUrls[i]), `Upload page image ${i + 1} for: ${title}`, null, token);
                pagesPaths.push(`./${pageRawPath}`);
            }
        }

        submitBtn.innerText = "목록 저장 중...";

        const targetJson = category === 'newsletters' ? 'newsletters.json' : 'notices.json';
        let currentData = [];
        let jsonSha = null;

        try {
            const jsonRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${targetRepo}/contents/${targetJson}`, {
                headers: { 'Authorization': `token ${token}` }
            });
            if (jsonRes.ok) {
                const jsonInfo = await jsonRes.json();
                jsonSha = jsonInfo.sha;
                const decodedStr = decodeURIComponent(escape(atob(jsonInfo.content)));
                currentData = JSON.parse(decodedStr);
            }
        } catch (err) {
            console.log("기존 JSON 조회 실패, 신규 추가합니다.");
        }

        currentData.forEach((item, idx) => {
            if (item.id === undefined) {
                item.id = category === 'newsletters' ? `news_${idx}` : `notice_${idx}`;
            } else {
                item.id = String(item.id);
            }
        });

        const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];

        const newFields = {
            date: date,
            title: title,
            summary: summary,
            tags: tags,
            thumbnail: thumbnailPath,
            pages_images: pagesPaths
        };

        if (editId) {
            const idx = currentData.findIndex(i => String(i.id) === String(editId));
            if (idx !== -1) {
                currentData[idx] = { ...currentData[idx], ...newFields };
            } else {
                alert("수정 대상을 깃허브 원본에서 찾지 못했습니다. 새로고침 후 다시 시도해주세요.");
                throw new Error("Match Failed");
            }
        } else {
            currentData.push({ id: Date.now().toString(), ...newFields });
        }

        const updatedJsonBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(currentData, null, 2))));
        await uploadToGitHub(targetRepo, targetJson, updatedJsonBase64, `Update ${targetJson} for ${title}`, jsonSha, token);

        alert(editId ? "수정되었습니다!" : `성공적으로 등록되었습니다! (${targetRepo} 저장소로 저장됨)`);
        closeUploadModal();
        loadData();

    } catch (error) {
        console.error("저장 실패:", error);
        alert("저장 실패: 토큰 권한을 확인해 주세요. (" + error.message + ")");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "저장하기";
    }
}

async function executeDelete(item) {
    const token = localStorage.getItem('sb_gh_token');
    if (!token) return;

    const targetRepo = getRepoByDate(item.date);

    try {
        const targetJson = currentTab === 'newsletters' ? 'newsletters.json' : 'notices.json';
        const jsonRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${targetRepo}/contents/${targetJson}`, {
            headers: { 'Authorization': `token ${token}` }
        });

        if (!jsonRes.ok) throw new Error("JSON 파일을 읽어올 수 없습니다.");

        const jsonInfo = await jsonRes.json();
        const jsonSha = jsonInfo.sha;
        const decodedStr = decodeURIComponent(escape(atob(jsonInfo.content)));
        let currentData = JSON.parse(decodedStr);

        currentData.forEach((i, idx) => {
            if (i.id === undefined) {
                i.id = currentTab === 'newsletters' ? `news_${idx}` : `notice_${idx}`;
            } else {
                i.id = String(i.id);
            }
        });

        currentData = currentData.filter(i => String(i.id) !== String(item.id));

        const updatedJsonBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(currentData, null, 2))));
        await uploadToGitHub(targetRepo, targetJson, updatedJsonBase64, `Delete item: ${item.title}`, jsonSha, token);

        alert("삭제되었습니다!");
        loadData();
    } catch (error) {
        console.error("삭제 실패:", error);
        alert("삭제 중 오류가 발생했습니다: " + error.message);
    }
}

// GitHub API를 통해 파일 하나를 저장소에 올리는(또는 덮어쓰는) 함수
async function uploadToGitHub(repo, path, contentBase64, commitMessage, sha = null, token) {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${repo}/contents/${path}`;
    const body = { message: commitMessage, content: contentBase64 };
    if (sha) body.sha = sha;

    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "GitHub API 오류");
    }
}

// "data:image/jpeg;base64,AAAA..." 형태에서 base64 부분만 잘라내는 함수
function dataUrlToBase64(dataUrl) {
    return dataUrl.split(',')[1];
}
