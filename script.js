document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('search-form');
    const input = document.getElementById('keywords-input');
    const searchBtn = document.getElementById('search-btn');
    const loadingIndicator = document.getElementById('loading-indicator');
    const errorMessage = document.getElementById('error-message');
    const resultSection = document.getElementById('result-section');
    const topResultText = document.getElementById('top-result');
    const otherResultsList = document.getElementById('other-results');
    const recentSearchesEl = document.getElementById('recent-searches');
    const illustrationWrapper = document.querySelector('#input-section .illustration-wrapper');

    let currentAbortController = null;
    let allResults = [];
    let shownCount = 0;
    const BATCH_SIZE = 3;

    // 第6回: 初期表示時に最近の検索を読み込む
    renderRecentTags(loadRecentSearches());

    // ---- 第6回: 最近の検索ヒント ----

    function loadRecentSearches() {
        return JSON.parse(localStorage.getItem('recentSearches') || '[]');
    }

    function saveRecentSearch(keyword) {
        let recent = loadRecentSearches();
        recent = [keyword, ...recent.filter(k => k !== keyword)].slice(0, 5);
        localStorage.setItem('recentSearches', JSON.stringify(recent));
        renderRecentTags(recent);
    }

    function renderRecentTags(recent) {
        if (recent.length === 0) {
            recentSearchesEl.classList.add('hidden');
            return;
        }
        recentSearchesEl.classList.remove('hidden');
        recentSearchesEl.innerHTML =
            '<span class="recent-label">最近の検索:</span>' +
            recent.map(k =>
                `<button class="recent-tag" data-keyword="${escapeHtml(k)}">${escapeHtml(k)}</button>`
            ).join('');
        recentSearchesEl.querySelectorAll('.recent-tag').forEach(tag => {
            tag.addEventListener('click', () => {
                input.value = tag.dataset.keyword;
                form.dispatchEvent(new Event('submit'));
            });
        });
    }

    function escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ---- 第4回: イラスト折り畳み ----

    // 入力欄が空になったらイラストを戻す
    input.addEventListener('input', () => {
        if (input.value === '') {
            illustrationWrapper.classList.remove('illustration-collapsed');
        }
    });

    // ---- Markdown 除去 ----

    function stripMarkdown(text) {
        return text
            .replace(/#{1,6}\s?/g, '')
            .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, '$2')
            .replace(/~~(.*?)~~/g, '$1')
            .replace(/`{1,3}[^`]*`{1,3}/g, '')
            .replace(/^\s*[-*+|>]\s?/gm, '')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/[|]/g, '')
            .trim();
    }

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            form.dispatchEvent(new Event('submit'));
        }
    });

    // ---- 検索処理 ----

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const keywords = input.value.trim();
        if (!keywords) return;

        // 前のリクエストをキャンセル
        if (currentAbortController) {
            currentAbortController.abort();
        }
        currentAbortController = new AbortController();

        // UI リセット
        errorMessage.classList.add('hidden');
        resultSection.classList.add('hidden');
        otherResultsList.innerHTML = '';
        topResultText.textContent = '';
        allResults = [];
        shownCount = 0;

        searchBtn.disabled = true;
        loadingIndicator.classList.remove('hidden');

        try {
            const response = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keywords }),
                signal: currentAbortController.signal
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 401 || response.status === 403 ||
                    (data.error && data.error.includes('API_KEY'))) {
                    throw new Error('APIキーが設定されていません');
                }
                throw new Error(data.error || '通信エラーが発生しました');
            }

            if (!data.results || data.results.length === 0) {
                throw new Error('候補が見つかりませんでした。ヒントを増やしてください');
            }

            // 第6回: 検索ヒントを保存
            saveRecentSearch(keywords);

            // 第4回: イラストを折り畳む
            illustrationWrapper.classList.add('illustration-collapsed');

            allResults = data.results;
            displayNextBatch(true);

        } catch (error) {
            if (error.name === 'AbortError') return;
            console.error('Search error:', error);
            showError(error.message || '通信エラーが発生しました');
        } finally {
            searchBtn.disabled = false;
            loadingIndicator.classList.add('hidden');
        }
    });

    function showError(msg) {
        errorMessage.textContent = msg;
        errorMessage.classList.remove('hidden');
    }

    // ---- 第5回: バッチ表示 ----

    function displayNextBatch(isFirst) {
        // 既存の「もっと見る」ボタンを除去
        const existing = document.getElementById('more-btn');
        if (existing) existing.remove();

        if (isFirst) {
            resultSection.classList.remove('hidden');
            setTimeout(() => {
                resultSection.scrollIntoView({ behavior: 'smooth' });
            }, 100);
            topResultText.textContent = allResults[0].title;
        }

        const end = Math.min(shownCount + BATCH_SIZE, allResults.length);

        for (let i = shownCount; i < end; i++) {
            const item = allResults[i];
            const card = document.createElement('div');
            card.className = 'result-card';
            if (item.url) {
                card.style.cursor = 'pointer';
                card.addEventListener('click', () => {
                    window.open(item.url, '_blank', 'noopener,noreferrer');
                });
            }

            const label = i === 0 ? 'これだ！BINGO!' : 'もしかして…';

            card.innerHTML = `
                <div class="rank-badge rank-${i + 1}">${i + 1}</div>
                <div class="result-content">
                    <div style="font-size:0.7rem;color:var(--pop-red);font-weight:bold;margin-bottom:2px;">${label}</div>
                    <h3 class="result-title">${escapeHtml(item.title)}</h3>
                    <p class="result-desc">${escapeHtml(stripMarkdown(item.content))}</p>
                </div>
            `;

            otherResultsList.appendChild(card);

            const delay = (i - shownCount) * 400;
            setTimeout(() => card.classList.add('animate-in'), delay);
        }

        shownCount = end;

        // まだ表示していない結果があれば「もっと見る」ボタンを追加
        if (shownCount < allResults.length) {
            const moreBtn = document.createElement('button');
            moreBtn.id = 'more-btn';
            moreBtn.className = 'more-btn';
            moreBtn.textContent = 'もっと見る';
            moreBtn.addEventListener('click', () => displayNextBatch(false));
            otherResultsList.appendChild(moreBtn);
        }
    }
});
