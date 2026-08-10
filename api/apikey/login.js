export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  try {
    const response = await fetch('https://www.braintrust.dev/api/apikey/login', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
    });
    const body = await response.text();

    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
    return res.status(response.status).send(body);
  } catch (error) {
    console.error('Error loading Braintrust organizations:', error);
    return res.status(500).json({ error: 'Failed to load organizations from Braintrust' });
  }
}
