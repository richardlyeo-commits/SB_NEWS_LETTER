const ADMIN_PASSWORD = "6666";
const GITHUB_OWNER = 'richardlyeo-commits';

let pendingAction = null; 
let targetEditItem = null;

function getRepoByDate(dateStr) {
    if (!dateStr) return 'SB_NEWS_LETTER';
    const year = parseInt(dateStr.substring(0, 4), 10);
    return year >= 2027 ? 'SB_NEWS_2027' : 'SB_NEWS_LETTER';
}

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

    // 🌟 로그인 성공 시 관리자 모드를 켜고 화면을 다시 그려 버튼(✏️, 🗑️) 표시
    isAdminMode = true;
    renderList(getCurrentData());
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
    openUploadModal(true, item); // 버튼이 보인다는 건 이미 인증되었다는 뜻이므로 바로 염
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

function openUploadModal(isEdit = false, item = null) {
    const modalTitle = document.getElementById('modalTitle');
    const fileNotice = document.getElementById('fileChangeNotice');
    const fileInput = document.getElementById('postFile');

    document.getElementById('uploadForm').reset();
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
    targetEditItem = null;
}

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
    const fileInput = document.getElementById('postFile');

    const targetRepo = getRepoByDate(date);

    submitBtn.disabled = true;
    submitBtn.innerText = "저장 중...";

    try {
        let filePath = targetEditItem ? targetEditItem.file_url : '';

        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const reverseTime = 9999999999999 - Date.now();
            const rawFilePath = `files/${reverseTime}_${file.name}`;
            
            const base64Content = await readFileAsBase64(file);
            await uploadToGitHub(targetRepo, rawFilePath, base64Content, `Upload file: ${file.name}`, null, token);
            filePath = `./${rawFilePath}`;
        }

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

        // 🌟 [핵심 수정] 깃허브에서 방금 불러온 과거 원본 데이터에도 임시 ID를 부여하여, 업데이트 대상을 찾을 수 있게 함
        currentData.forEach((item, idx) => {
            if (item.id === undefined) {
                item.id = category === 'newsletters' ? `news_${idx}` : `notice_${idx}`;
            } else {
                item.id = String(item.id);
            }
        });

        const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];

        if (editId) {
            const idx = currentData.findIndex(i => String(i.id) === String(editId));
            if (idx !== -1) {
                currentData[idx] = {
                    ...currentData[idx],
                    date: date,
                    title: title,
                    summary: summary,
                    tags: tags,
                    file_url: filePath
                };
            } else {
                alert("수정 대상을 깃허브 원본에서 찾지 못했습니다. 새로고침 후 다시 시도해주세요.");
                throw new Error("Match Failed");
            }
        } else {
            const newItem = {
                id: Date.now().toString(),
                date: date,
                title: title,
                summary: summary,
                tags: tags,
                file_url: filePath
            };
            currentData.push(newItem);
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

        // 삭제 시에도 ID 매칭 보강
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

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
