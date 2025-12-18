// Vercel serverless function to proxy Braintrust API calls
// This avoids CORS issues and keeps API keys secure

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get API key from environment variables
  const apiKey = process.env.VITE_BRAINTRUST_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    // Forward the request to Braintrust API
    const response = await fetch('https://api.braintrust.dev/btql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    // Get the response data
    const data = await response.json();

    // Forward the response back to the client
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Error proxying to Braintrust API:', error);
    res.status(500).json({ error: 'Failed to fetch data from Braintrust API' });
  }
}
