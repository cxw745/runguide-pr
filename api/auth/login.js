export default function handler(req, res) {
  const clientId = process.env.OAUTH_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'OAuth client ID not configured' });
  }

  const redirectUri = `${process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:4321'}/api/auth/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
    response_type: 'code',
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
}
