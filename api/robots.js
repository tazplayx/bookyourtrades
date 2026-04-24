module.exports = (req, res) => {
  const content = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /dashboard
Disallow: /api/

# AI crawlers — explicitly welcome
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Googlebot-Extended
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: CCBot
Allow: /

Sitemap: https://bookyourtrades.com/sitemap.xml
`;

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Cache-Control', 's-maxage=86400');
  res.status(200).send(content);
};
