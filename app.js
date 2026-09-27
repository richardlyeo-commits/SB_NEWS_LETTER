let newslettersData = [];
let noticesData = [];
let currentTab = 'newsletters';
// 🌟 기본 상태는 일반 사용자 모드 (수정/삭제 버튼 숨김)
let isAdminMode = false; 

window.addEventListener('DOMContentLoaded', loadData);

async function loadData() {
    const listContainer = document.getElementById('contentList');

    try {
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

        newslettersData.forEach((item, idx) => { item.id = item.id !== undefined ? String(item.id) : `news_${idx}`; });
        noticesData.forEach((item, idx) => { item.id = item.id !== undefined ? String(item.id) : `notice_${idx}`; });

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

function getCurrentData() {
    return currentTab === 'newsletters' ? newslettersData : noticesData;
}

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

    const newIds = currentTab === 'newsletters' 
        ? new Set(newslettersData.slice(0, 2).map(item => item.date))
        : new Set();

    listContainer.innerHTML = data.map((item) => {
        const isNew = newIds.has(item.date);
        const formattedDate = formatDate(item.date);
        const btnText = currentTab === 'newsletters' ? '📖 원본 보기' : '📄 공지문 보기';

        // 🌟 관리자 인증이 완료되었을 때만 수정/삭제 버튼을 렌더링
        const adminButtons = isAdminMode ? `
            <button data-action="edit" data-id="${escapeHtml(item.id)}" class="action-btn text-slate-400 hover:text-[#01794c] p-1.5 text-xs font-medium rounded hover:bg-slate-100" title="수정">✏️</button>
            <button data-action="delete" data-id="${escapeHtml(item.id)}" class="action-btn text-slate-400 hover:text-red-500 p-1.5 text-xs font-medium rounded hover:bg-slate-100" title="삭제">🗑️</button>
        ` : '';

        return `
            <div class="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-[#01794c]/30 transition-all duration-200 flex flex-col">
                <div class="p-5 flex-1">
                    <div class="flex items-start justify-between gap-2 mb-3">
                        <span class="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">
                            ${formattedDate}
                        </span>
                        <div class="flex items-center gap-1">
                            ${isNew ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold mr-1">NEW</span>' : ''}
                            ${adminButtons}
                        </div>
                    </div>
                    <h2 class="font-bold text-slate-900 text-lg mb-2 leading-tight">${escapeHtml(item.title)}</h2>
                    <p class="text-slate-600 text-sm leading-relaxed mb-4">${escapeHtml(item.summary || '')}</p>
                    ${renderTags(item.tags)}
                </div>
                <div class="px-5 pb-5 pt-0">
                    <a href="${item.file_url}" target="_blank" class="block w-full text-center bg-[#01794c] hover:bg-[#015c3b] text-white font-semibold py-2.5 rounded-lg transition-colors">
                        ${btnText}
                    </a>
                </div>
            </div>
        `;
    }).join('');

    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
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
        <div class="flex flex-wrap gap-1.5 mt-auto">
            ${tags.map(tag => `<span class="px-2 py-0.5 bg-[#f0f9f4] text-[#01794c] text-xs font-medium rounded">#${escapeHtml(tag)}</span>`).join('')}
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

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
