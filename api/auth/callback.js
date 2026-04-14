export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.redirect('/submit?error=no_code');
  }

  const clientId = process.env.OAUTH_CLIENT_ID;
  const clientSecret = process.env.OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.redirect('/submit?error=oauth_not_configured');
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
      return res.redirect(`/submit?error=${encodeURIComponent(data.error_description || data.error)}`);
    }

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:4321';

    res.setHeader('Set-Cookie', [
      `gh_token=${data.access_token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`,
    ]);

    res.redirect(`${baseUrl}/submit?auth=success`);
  } catch (error) {
    res.redirect('/submit?error=auth_failed');
  }
}
