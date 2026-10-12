export const config = {
  port: Number(process.env.PORT ?? 3333),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://twin:twin@localhost:5433/twin',
  extractor: process.env.EXTRACTOR ?? 'stub',
  githubToken: process.env.GITHUB_TOKEN || undefined,
  braveSearchApiKey: process.env.BRAVE_SEARCH_API_KEY || undefined,
  sessionDays: 30,
  secureCookies: process.env.NODE_ENV === 'production',
  userAgent: 'GenDigitalTwinBot/0.1 (+coleta autorizada pela pessoa)',
};
