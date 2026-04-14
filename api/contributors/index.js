export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const repo = process.env.GITHUB_REPO || 'cxw745/runguide';
  const githubToken = process.env.GITHUB_TOKEN;

  const headers = {
    Accept: 'application/vnd.github.v3+json',
  };

  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  try {
    const contributorsRes = await fetch(
      `https://api.github.com/repos/${repo}/contributors?per_page=50`,
      { headers }
    );

    if (!contributorsRes.ok) {
      return res.status(contributorsRes.status).json({ error: 'Failed to fetch contributors' });
    }

    const contributors = await contributorsRes.json();

    const result = contributors
      .filter(c => c.type === 'User')
      .map(c => ({
        login: c.login,
        avatar_url: c.avatar_url,
        html_url: c.html_url,
        contributions: c.contributions,
      }));

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch contributors' });
  }
}
