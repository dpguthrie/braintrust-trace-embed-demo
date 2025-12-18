// Vercel serverless function to proxy Braintrust project API calls

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get API key from environment variables
  const apiKey = process.env.VITE_BRAINTRUST_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    // Build URL with query parameters
    const url = new URL('https://api.braintrust.dev/v1/project');

    // Forward query parameters
    const { project_name, org_name } = req.query;
    if (project_name) url.searchParams.set('project_name', project_name);
    if (org_name) url.searchParams.set('org_name', org_name);

    // Forward the request to Braintrust API
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    // Get the response data
    const data = await response.json();

    // Forward the response back to the client
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Error proxying to Braintrust API:', error);
    res.status(500).json({ error: 'Failed to fetch project from Braintrust API' });
  }
}
