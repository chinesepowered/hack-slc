// All runtime configuration comes from the environment. Secrets (the
// Elasticsearch password, the OpenAI key, the Dash0 token) arrive from the
// capykube-secrets Secret in the cluster and are never committed.
function num(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export const config = {
  port: num('PORT', 8080),
  version: process.env.APP_VERSION ?? 'dev',
  team: process.env.TEAM_NAME ?? 'local',
  dataDir: process.env.DATA_DIR ?? 'data',
  webDir: process.env.WEB_DIR ?? 'dist/web',
  es: {
    url: process.env.ES_URL ?? 'http://localhost:9200',
    username: process.env.ES_USERNAME ?? 'elastic',
    password: process.env.ELASTIC_PASSWORD,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    // "Latest luna" for Capy's notes; switch to gpt-6.1-sol with LLM_MODEL.
    model: process.env.LLM_MODEL ?? 'gpt-6-luna',
    embeddingModel: process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small',
    embeddingDimensions: num('EMBEDDING_DIMENSIONS', 512),
  },
  dash0: {
    token: process.env.DASH0_AUTH_TOKEN,
    otlpEndpoint: process.env.DASH0_OTLP_ENDPOINT ?? 'https://ingress.europe-west4.gcp.dash0.com',
    apiEndpoint: process.env.DASH0_API_ENDPOINT ?? 'https://api.europe-west4.gcp.dash0.com',
    dataset: process.env.DASH0_DATASET ?? 'default',
  },
};
