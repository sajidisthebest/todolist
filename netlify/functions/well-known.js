/**
 * RFC 8414 OAuth 2.0 Authorization Server Metadata & OpenID Configuration
 * Enables Google Gemini and connected apps to auto-discover OAuth endpoints.
 */

exports.handler = async function (event, context) {
  const host = event.headers.host || "sajidxtodo.netlify.app";
  const protocol = host.includes("localhost") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-session-id",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const oauthMetadata = {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    userinfo_endpoint: `${baseUrl}/oauth/userinfo`,
    jwks_uri: `${baseUrl}/oauth/jwks`,
    scopes_supported: ["read", "write", "tasks", "openid", "profile", "email"],
    response_types_supported: ["code", "token"],
    response_modes_supported: ["query", "fragment"],
    grant_types_supported: ["authorization_code", "client_credentials", "refresh_token"],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],
    code_challenge_methods_supported: ["S256", "plain"],
    service_documentation: `${baseUrl}`
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(oauthMetadata, null, 2)
  };
};
