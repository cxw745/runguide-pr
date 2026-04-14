export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.cookies?.gh_token || parseCookie(req.headers.cookie || '')['gh_token'];

  if (!token) {
    return res.status(401).json({ error: '请先登录 GitHub' });
  }

  const githubToken = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || 'cxw745/runguide';

  if (!githubToken) {
    return res.status(500).json({ error: '服务端 GitHub Token 未配置' });
  }

  let user;
  try {
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (!userRes.ok) {
      return res.status(401).json({ error: '登录已过期，请重新登录' });
    }
    user = await userRes.json();
  } catch {
    return res.status(401).json({ error: '获取用户信息失败' });
  }

  const { title, author, category, tags, excerpt, body } = req.body || {};

  if (!title || !author || !category || !excerpt || !body) {
    return res.status(400).json({ error: '请填写所有必填字段（标题、作者、分类、摘要、正文）' });
  }

  const validCategories = ['转专业', '保研', '考研', '出国留学', '就业', '其他'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: '分类无效' });
  }

  const slugBase = title
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);

  const shortId = Math.random().toString(36).substring(2, 8);
  const slug = `${slugBase}-${shortId}`;
  const timestamp = Date.now();
  const branchName = `article/${slugBase}-${timestamp}`;

  const today = new Date().toISOString().split('T')[0];
  const tagsYaml = (tags && tags.length > 0)
    ? `\ntags:\n${tags.map(t => `  - "${t}"`).join('\n')}`
    : '\ntags: []';

  const frontmatter = [
    '---',
    `title: "${title.replace(/"/g, '\\"')}"`,
    `author: "${author.replace(/"/g, '\\"')}"`,
    `date: "${today}"`,
    `category: "${category}"`,
    tagsYaml,
    `excerpt: "${excerpt.replace(/"/g, '\\"')}"`,
    '---',
    '',
  ].join('\n');

  const fullContent = frontmatter + body;
  const encodedContent = Buffer.from(fullContent).toString('base64');

  const ghApi = 'https://api.github.com';
  const headers = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  try {
    const mainRef = await fetch(`${ghApi}/repos/${repo}/git/ref/heads/main`, { headers });
    if (!mainRef.ok) {
      return res.status(500).json({ error: '无法获取主分支信息' });
    }
    const mainData = await mainRef.json();
    const sha = mainData.object.sha;

    const createBranch = await fetch(`${ghApi}/repos/${repo}/git/refs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha,
      }),
    });

    if (!createBranch.ok) {
      const errData = await createBranch.json();
      return res.status(500).json({ error: `创建分支失败: ${errData.message}` });
    }

    const filePath = `src/content/articles/${slug}.md`;
    const createFile = await fetch(`${ghApi}/repos/${repo}/contents/${filePath}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `投稿: ${title} (by @${user.login})`,
        content: encodedContent,
        branch: branchName,
      }),
    });

    if (!createFile.ok) {
      const errData = await createFile.json();
      return res.status(500).json({ error: `创建文件失败: ${errData.message}` });
    }

    const createPR = await fetch(`${ghApi}/repos/${repo}/pulls`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: `投稿: ${title}`,
        head: branchName,
        base: 'main',
        body: [
          `## 投稿信息`,
          '',
          `| 字段 | 内容 |`,
          `|------|------|`,
          `| 标题 | ${title} |`,
          `| 作者 | ${author} |`,
          `| 分类 | ${category} |`,
          `| 投稿人 | @${user.login} |`,
          `| 日期 | ${today} |`,
          '',
          tags && tags.length > 0 ? `**标签**: ${tags.join(', ')}` : '',
          '',
          `> 本投稿由 [@${user.login}](https://github.com/${user.login}) 通过在线投稿系统提交。`,
        ].filter(Boolean).join('\n'),
      }),
    });

    if (!createPR.ok) {
      const errData = await createPR.json();
      return res.status(500).json({ error: `创建 PR 失败: ${errData.message}` });
    }

    const prData = await createPR.json();

    res.status(200).json({
      success: true,
      prUrl: prData.html_url,
      prNumber: prData.number,
      message: '投稿成功！已创建 Pull Request，等待管理员审核。',
    });
  } catch (error) {
    res.status(500).json({ error: '提交失败，请稍后重试' });
  }
}

function parseCookie(str) {
  return str.split(';').reduce((acc, pair) => {
    const [key, ...val] = pair.trim().split('=');
    acc[key] = val.join('=');
    return acc;
  }, {});
}
