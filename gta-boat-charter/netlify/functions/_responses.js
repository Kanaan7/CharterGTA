function withCors(headers = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Stripe-Signature",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    ...headers,
  };
}

function json(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: withCors({
      "Content-Type": "application/json",
      ...headers,
    }),
    body: JSON.stringify(body),
  };
}

function handleOptions(event) {
  if (event.httpMethod !== "OPTIONS") return null;
  return {
    statusCode: 200,
    headers: withCors(),
    body: "",
  };
}

module.exports = {
  json,
  handleOptions,
  withCors,
};
