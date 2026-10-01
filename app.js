// ============================================================
// app.js
// 화면에 소식지/공지사항 목록을 불러와 카드로 보여주고,
// 카드를 누르면 큰 이미지로 전체 내용을 볼 수 있게 해주는 파일입니다.
// (컴퓨터를 잘 모르는 분도 이해할 수 있도록 각 부분에 설명을 달아두었습니다)
// ============================================================

let newslettersData = [];   // 주간 소식지 목록을 저장해 둘 배열
let noticesData = [];       // 공지사항 목록을 저장해 둘 배열
let currentTab = 'newsletters'; // 지금 보고 있는 탭(소식지/공지)
let isAdminMode = false;    // 관리자 로그인 여부(기본은 꺼짐 = 일반 방문자 모드)

// 라이트박스(큰 화면 보기)용 상태값
let viewerList = [];   // 현재 보고 있는 소식지의 이미지 경로들(여러 쪽일 수 있음)
let viewerIndex = 0;   // 지금 몇 번째 쪽을 보고 있는지

// 페이지가 열리자마자 데이터를 불러옵니다.
window.addEventListener('DOMContentLoaded', loadData);

// newsletters.json / notices.json 파일을 읽어와 화면에 뿌려주는 함수
async function loadData() {
    const listContainer = document.getElementById('contentList');

    try {
        // 캐시(이전 버전이 저장되어 안 바뀌어 보이는 현상)를 막기 위해 시간을 덧붙여 요청합니다.
        const [newsRes, noticeRes] = await Promise.all([
            fetch(`./newsletters.json?t=${new Date().getTime()}`),
            fetch(`./notices.json?t=${new Date().getTime()}`)
        ]);

        if (!newsRes.ok) throw new Error(`newsletters.json 불러오기 실패 (${newsRes.status})`);
        if (!noticeRes.ok) throw new Error(`notices.json 불러오기 실패 (${noticeRes.status})`);

        newslettersData = await newsRes.json();
        noticesData = await noticeRes.json();

        if (!Array.isArray(newslettersData)) newslettersData = [];
        if (!Array.isArray(noticesData)) noticesData = [];

        // id가 없는 옛날 데이터에도 고유 번호를 붙여줍니다.
        newslettersData.forEach((item, idx) => { item.id = item.id !== undefined ? String(item.id) : `news_${idx}`; });
        noticesData.forEach((item, idx) => { item.id = item.id !== undefined ? String(item.id) : `notice_${idx}`; });

        // 최신 날짜가 맨 위로 오도록 정렬
        newslettersData.sort((a, b) => new Date(b.date) - new Date(a.date));
        noticesData.sort((a, b) => {
            if (!a.date && !b.date) return 0;
            if (!a.date) return 1;
            if (!b.date) return -1;
            return new Date(b.date) - new Date(a.date);
        });

        document.getElementById('searchInput').addEventListener('input', handleSearch);
        switchTab(currentTab);

    } catch (error) {
        console.error(error);
        listContainer.innerHTML = `
            <div class="col-span-full bg-red-50 border border-red-100 p-6 rounded-2xl text-center">
                <p class="text-red-600 font-bold mb-1">⚠️ 데이터 불러오기 실패</p>
                <p class="text-red-500 text-sm">${error.message}</p>
            </div>
        `;
    }
}

// '주간 소식지' / '공지사항' 탭 전환
function switchTab(tab) {
    currentTab = tab;
    const newsTab = document.getElementById('tab-newsletters');
    const noticeTab = document.getElementById('tab-notices');

    if (tab === 'newsletters') {
        newsTab.className = 'tab-active flex-1 md:flex-none px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors';
        noticeTab.className = 'tab-inactive flex-1 md:flex-none px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors';
    } else {
        newsTab.className = 'tab-inactive flex-1 md:flex-none px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors';
        noticeTab.className = 'tab-active flex-1 md:flex-none px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors';
    }

    document.getElementById('searchInput').value = '';
    renderList(getCurrentData());
}

// 지금 선택된 탭의 데이터 배열을 돌려줍니다.
function getCurrentData() {
    return currentTab === 'newsletters' ? newslettersData : noticesData;
}

// 소식지 하나에서 '큰 화면 보기'용 이미지 목록을 뽑아내는 함수.
// pages_images(새 방식으로 저장된 여러 쪽 이미지)가 있으면 그것을 쓰고,
// 없으면 thumbnail 하나라도, 그것도 없으면 원본 파일(file_url)을 그대로 보여줍니다.
function getViewableImages(item) {
    if (Array.isArray(item.pages_images) && item.pages_images.length > 0) return item.pages_images;
    if (item.thumbnail) return [item.thumbnail];
    if (item.file_url) return [item.file_url];
    return [];
}

// 카드 목록을 화면에 그려주는 함수
function renderList(data) {
    const listContainer = document.getElementById('contentList');
    const noResult = document.getElementById('noResult');
    const totalCount = document.getElementById('total-count');

    totalCount.innerText = data.length;

    if (data.length === 0) {
        listContainer.innerHTML = '';
        noResult.classList.remove('hidden');
        return;
    }

    noResult.classList.add('hidden');

    listContainer.innerHTML = data.map((item, dataIdx) => {
        const formattedDate = formatDate(item.date);
        const images = getViewableImages(item);
        const thumbSrc = item.thumbnail || images[0] || '';
        const hasFile = images.length > 0;

        // 관리자로 로그인했을 때만 수정/삭제 버튼을 보여줍니다.
        const adminButtons = isAdminMode ? `
            <button data-action="edit" data-id="${escapeHtml(item.id)}" class="action-btn text-slate-400 hover:text-[#01794c] p-1.5 text-xs font-medium rounded hover:bg-slate-100" title="수정">✏️</button>
            <button data-action="delete" data-id="${escapeHtml(item.id)}" class="action-btn text-slate-400 hover:text-red-500 p-1.5 text-xs font-medium rounded hover:bg-slate-100" title="삭제">🗑️</button>
        ` : '';

        return `
            <div class="news-card bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div class="thumb-box relative cursor-pointer group" ${hasFile ? `data-action="view" data-id="${escapeHtml(item.id)}"` : ''}>
                    ${thumbSrc
                        ? `<img src="${thumbSrc}" alt="${escapeHtml(item.title)} 미리보기" loading="lazy" class="skeleton" onload="this.classList.remove('skeleton')">`
                        : `<div class="w-full h-full flex items-center justify-center text-slate-300 text-4xl">📄</div>`
                    }
                    ${hasFile ? `<div class="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                        <span class="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-[#01794c] text-xs font-bold px-3 py-1.5 rounded-full">🔍 크게 보기</span>
                    </div>` : ''}
                </div>
                <div class="p-3.5 flex-1 flex flex-col">
                    <div class="flex items-center justify-between gap-1 mb-1.5">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-semibold">
                            ${formattedDate}
                        </span>
                        <div class="flex items-center gap-0.5">${adminButtons}</div>
                    </div>
                    <h2 class="font-bold text-slate-900 text-sm mb-1.5 leading-snug clamp-2">${escapeHtml(item.title)}</h2>
                    <p class="text-slate-500 text-xs leading-relaxed mb-2 clamp-2">${escapeHtml(item.summary || '')}</p>
                    ${renderTags(item.tags)}
                </div>
            </div>
        `;
    }).join('');

    // 썸네일(카드 이미지) 클릭 -> 큰 화면으로 보기
    document.querySelectorAll('[data-action="view"]').forEach(el => {
        el.addEventListener('click', () => openViewer(String(el.getAttribute('data-id'))));
    });

    // 수정/삭제 버튼 동작 연결 (admin.js에서 구현되어 있습니다)
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
            const action = this.getAttribute('data-action');
            const id = String(this.getAttribute('data-id'));
            if (action === 'edit') {
                if (typeof handleEditClick === 'function') handleEditClick(id);
            } else if (action === 'delete') {
                if (typeof handleDeleteClick === 'function') handleDeleteClick(id);
            }
        });
    });
}

// ---------------- 큰 화면(라이트박스) 보기 ----------------

// 카드를 눌렀을 때 실행: 해당 소식지의 이미지들을 크게 보여줍니다.
function openViewer(id) {
    const item = getCurrentData().find(i => String(i.id) === id);
    if (!item) return;

    viewerList = getViewableImages(item);
    viewerIndex = 0;

    document.getElementById('viewerTitle').innerText = `${formatDate(item.date)} · ${item.title}`;
    document.getElementById('viewerModal').classList.remove('hidden');
    document.getElementById('viewerModal').classList.add('flex');
    updateViewerImage();
}

function updateViewerImage() {
    const img = document.getElementById('viewerImage');
    const indicator = document.getElementById('viewerPageIndicator');
    img.src = viewerList[viewerIndex] || '';
    indicator.innerText = viewerList.length > 1 ? `${viewerIndex + 1} / ${viewerList.length} 쪽` : '';

    // 쪽이 1개뿐이면 화살표 버튼은 숨깁니다.
    const showArrows = viewerList.length > 1;
    document.getElementById('viewerPrevBtn').classList.toggle('hidden', !showArrows);
    document.getElementById('viewerNextBtn').classList.toggle('hidden', !showArrows);
}

// 이전/다음 쪽으로 이동 (direction: -1 이전, 1 다음)
function viewerStep(direction) {
    if (viewerList.length === 0) return;
    viewerIndex = (viewerIndex + direction + viewerList.length) % viewerList.length;
    updateViewerImage();
}

function closeViewer() {
    document.getElementById('viewerModal').classList.add('hidden');
    document.getElementById('viewerModal').classList.remove('flex');
}

// 바깥쪽 어두운 배경을 누르면 닫히게, 키보드 화살표로도 넘길 수 있게 합니다.
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('viewerModal');
    modal.addEventListener('click', (e) => { if (e.target === modal) closeViewer(); });
    document.addEventListener('keydown', (e) => {
        if (modal.classList.contains('hidden')) return;
        if (e.key === 'Escape') closeViewer();
        if (e.key === 'ArrowLeft') viewerStep(-1);
        if (e.key === 'ArrowRight') viewerStep(1);
    });
});

// ---------------- 날짜/태그/검색 관련 보조 함수 ----------------

function formatDate(dateStr) {
    if (!dateStr) return '날짜 미상';
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const date = new Date(dateStr + 'T00:00:00');
    if (isNaN(date.getTime())) return dateStr;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const dayName = days[date.getDay()];
    return `${y}.${m}.${d}(${dayName})`;
}

function renderTags(tags) {
    if (!Array.isArray(tags) || tags.length === 0) return '';
    return `
        <div class="flex flex-wrap gap-1 mt-auto pt-1">
            ${tags.map(tag => `<span class="px-1.5 py-0.5 bg-[#f0f9f4] text-[#01794c] text-[10px] font-medium rounded">#${escapeHtml(tag)}</span>`).join('')}
        </div>
    `;
}

function handleSearch(e) {
    const keyword = e.target.value.trim().toLowerCase();
    const data = getCurrentData();

    if (!keyword) { renderList(data); return; }

    const filtered = data.filter(item => {
        const title = (item.title || '').toLowerCase();
        const summary = (item.summary || '').toLowerCase();
        const date = (item.date || '').toLowerCase();
        const tags = Array.isArray(item.tags) ? item.tags.join(' ').toLowerCase() : '';
        return title.includes(keyword) || summary.includes(keyword) || date.includes(keyword) || tags.includes(keyword);
    });

    renderList(filtered);
}

// 화면에 글자를 넣을 때 혹시 모를 특수문자(HTML 태그 등)가 깨져 보이지 않도록 안전하게 변환합니다.
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
