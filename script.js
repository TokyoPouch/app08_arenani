document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('search-form');
    const input = document.getElementById('keywords-input');
    const searchBtn = document.getElementById('search-btn');
    const loadingIndicator = document.getElementById('loading-indicator');
    const errorMessage = document.getElementById('error-message');
    
    const resultSection = document.getElementById('result-section');
    const topResultText = document.getElementById('top-result');
    const otherResultsList = document.getElementById('other-results');

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

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const keywords = input.value.trim();
        if (!keywords) return;

        // Reset UI
        errorMessage.classList.add('hidden');
        resultSection.classList.add('hidden');
        otherResultsList.innerHTML = '';
        topResultText.textContent = '';
        
        // Loading state
        searchBtn.disabled = true;
        loadingIndicator.classList.remove('hidden');

        try {
            const response = await fetch('/api/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ keywords })
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 401 || response.status === 403 || (data.error && data.error.includes('API_KEY'))) {
                    throw new Error('APIキーが設定されていません');
                }
                throw new Error(data.error || '通信エラーが発生しました');
            }

            if (!data.results || data.results.length === 0) {
                throw new Error('候補が見つかりませんでした。ヒントを増やしてください');
            }

            displayResults(data.results);

        } catch (error) {
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

    function displayResults(results) {
        resultSection.classList.remove('hidden');

        setTimeout(() => {
            resultSection.scrollIntoView({ behavior: 'smooth' });
        }, 100);

        const topResult = results[0];
        topResultText.textContent = topResult.title;
        
        results.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = 'result-card';
            if (item.url) {
                card.style.cursor = 'pointer';
                card.addEventListener('click', () => {
                    window.open(item.url, '_blank', 'noopener,noreferrer');
                });
            }

            let label = index === 0 ? 'これだ！BINGO!' : 'もしかして…';

            card.innerHTML = `
                <div class="rank-badge rank-${index + 1}">${index + 1}</div>
                <div class="result-content">
                    <div style="font-size: 0.7rem; color: var(--pop-red); font-weight: bold; margin-bottom: 2px;">${label}</div>
                    <h3 class="result-title">${item.title}</h3>
                    <p class="result-desc">${stripMarkdown(item.content)}</p>
                </div>
            `;

            otherResultsList.appendChild(card);

            setTimeout(() => {
                card.classList.add('animate-in');
            }, index * 400);
        });
    }
});
