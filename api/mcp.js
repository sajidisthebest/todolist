/**
 * TaskFlow Pro — Vercel Serverless MCP Function
 */
const netlifyHandler = require('../netlify/functions/mcp.js').handler;

module.exports = async (req, res) => {
  const event = {
    httpMethod: req.method,
    headers: req.headers,
    queryStringParameters: req.query || {},
    body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}),
    path: req.url
  };

  const result = await netlifyHandler(event, {});
  Object.keys(result.headers || {}).forEach(k => res.setHeader(k, result.headers[k]));
  res.status(result.statusCode).send(result.body);
};
