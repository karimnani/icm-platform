export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key, Authorization',
};

export const json = (o, s = 200) => new Response(JSON.stringify(o), {
  status: s,
  headers: { ...cors, 'Content-Type': 'application/json' }
});
