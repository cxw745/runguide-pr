export default async function handler(req, res) {
  const clientId = process.env.OAUTH_CLIENT_ID;
  const clientSecret = process.env.OAUTH_CLIENT_SECRET;

  if (req.method === 'GET') {
    const { code } = req.query;

    if (!code) {
      if (!clientId) {
        return res.status(500).send('OAuth client ID not configured');
      }
      const redirectUri = `${process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:4321'}/api/auth`;
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: 'repo,read:user,user:email',
        response_type: 'code',
      });
      return res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
    }

    if (!clientId || !clientSecret) {
      return res.status(500).send('OAuth not configured');
    }

    try {
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      });

      const data = await response.json();

      if (data.error) {
        return res.status(400).send(data.error_description || data.error);
      }

      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:4321';

      res.setHeader('Set-Cookie', [
        `gh_token=${data.access_token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`,
      ]);

      return res.redirect(`${baseUrl}/admin/#access_token=${data.access_token}&token_type=bearer`);
    } catch (error) {
      return res.status(500).send('OAuth exchange failed');
    }
  }

  if (req.method === 'POST') {
    const { code, client_id, redirect_uri } = req.body || {};

    if (!code) {
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    const cId = client_id || clientId;
    if (!cId || !clientSecret) {
      return res.status(500).json({ error: 'OAuth not configured' });
    }

    try {
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          client_id: cId,
          client_secret: clientSecret,
          code,
          redirect_uri,
        }),
      });

      const data = await response.json();

      if (data.error) {
        return res.status(400).json({ error: data.error_description || data.error });
      }

      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json({ error: 'OAuth exchange failed' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
