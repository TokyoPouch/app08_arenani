export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { keywords } = req.body;

    if (!keywords) {
        return res.status(400).json({ error: 'Keywords are required' });
    }

    const apiKey = process.env.TAVILY_API_KEY;

    if (!apiKey) {
        console.error('TAVILY_API_KEY is not set');
        return res.status(500).json({ error: 'API_KEY_MISSING' });
    }

    try {
        console.log(`Searching for: ${keywords}`);
        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                api_key: apiKey,
                query: keywords,
                search_depth: "basic",
                include_answer: false,
                max_results: 3
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Tavily API Error: ${response.status} ${errorText}`);
            return res.status(response.status).json({ error: 'Tavily API returned an error' });
        }

        const data = await response.json();

        // Process results
        const results = (data.results || []).map(r => ({
            title: r.title || 'タイトルなし',
            content: r.content || '',
            url: r.url || ''
        }));

        res.status(200).json({ results });

    } catch (error) {
        console.error('Error during search:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
