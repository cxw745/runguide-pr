export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.cookies?.gh_token || parseCookie(req.headers.cookie || '')['gh_token'];

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!userRes.ok) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = await userRes.json();

    let email = user.email;
    if (!email) {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });
      if (emailsRes.ok) {
        const emails = await emailsRes.json();
        const primary = emails.find(e => e.primary);
        email = primary ? primary.email : (emails[0] ? emails[0].email : '');
      }
    }

    res.status(200).json({
      login: user.login,
      name: user.name || user.login,
      avatar_url: user.avatar_url,
      email,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user info' });
  }
}

function parseCookie(str) {
  return str.split(';').reduce((acc, pair) => {
    const [key, ...val] = pair.trim().split('=');
    acc[key] = val.join('=');
    return acc;
  }, {});
}
