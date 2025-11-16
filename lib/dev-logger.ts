/**
 * Development-only logging utility
 * Provides detailed visibility into app processes
 */

const isDev = process.env.NODE_ENV === 'development';

type LogLevel = 'info' | 'success' | 'warning' | 'error' | 'debug';

const colors = {
  info: '#3B82F6',     // Blue
  success: '#10B981',  // Green
  warning: '#F59E0B',  // Yellow
  error: '#EF4444',    // Red
  debug: '#8B5CF6',    // Purple
};

const emojis = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '❌',
  debug: '🔍',
};

export const devLog = {
  /**
   * Log search process
   */
  search: (stage: string, data?: any) => {
    if (!isDev) return;
    console.log(
      `%c🔎 SEARCH [${stage}]`,
      `color: ${colors.info}; font-weight: bold;`,
      data || ''
    );
  },

  /**
   * Log keyword extraction
   */
  keywords: (source: string, keywords: string[] | string[][]) => {
    if (!isDev) return;
    console.log(
      `%c🏷️  KEYWORDS [${source}]`,
      `color: ${colors.debug}; font-weight: bold;`,
      keywords
    );
  },

  /**
   * Log LLM API calls
   */
  llm: (action: string, data: { prompt?: string; response?: string; model?: string; tokens?: number; duration?: string }) => {
    if (!isDev) return;
    console.group(`%c🤖 LLM [${action}]`, `color: ${colors.info}; font-weight: bold;`);
    if (data.model) console.log('Model:', data.model);
    if (data.prompt) console.log('Prompt:', data.prompt);
    if (data.response) console.log('Response:', data.response);
    if (data.tokens) console.log('Tokens:', data.tokens);
    if (data.duration) console.log('Duration:', data.duration);
    console.groupEnd();
  },

  /**
   * Log Google Maps API calls
   */
  maps: (action: string, data?: any) => {
    if (!isDev) return;
    console.log(
      `%c🗺️  MAPS [${action}]`,
      `color: ${colors.success}; font-weight: bold;`,
      data || ''
    );
  },

  /**
   * Log scoring algorithm
   */
  scoring: (cafeName: string, score: number, breakdown?: any) => {
    if (!isDev) return;
    console.group(`%c📊 SCORING [${cafeName}] = ${score.toFixed(2)}`, `color: ${colors.debug}; font-weight: bold;`);
    if (breakdown) {
      Object.entries(breakdown).forEach(([key, value]) => {
        console.log(`  ${key}:`, value);
      });
    }
    console.groupEnd();
  },

  /**
   * Log database operations
   */
  db: (operation: string, table: string, data?: any) => {
    if (!isDev) return;
    console.log(
      `%c💾 DB [${operation}] ${table}`,
      `color: ${colors.info}; font-weight: bold;`,
      data || ''
    );
  },

  /**
   * Log Reddit API
   */
  reddit: (action: string, data?: any) => {
    if (!isDev) return;
    console.log(
      `%c🔗 REDDIT [${action}]`,
      `color: ${colors.warning}; font-weight: bold;`,
      data || ''
    );
  },

  /**
   * Log image analysis
   */
  image: (action: string, data?: any) => {
    if (!isDev) return;
    console.log(
      `%c🖼️  IMAGE [${action}]`,
      `color: ${colors.debug}; font-weight: bold;`,
      data || ''
    );
  },

  /**
   * Generic log with level
   */
  log: (level: LogLevel, message: string, data?: any) => {
    if (!isDev) return;
    const emoji = emojis[level];
    const color = colors[level];
    console.log(
      `%c${emoji} ${message}`,
      `color: ${color}; font-weight: bold;`,
      data || ''
    );
  },

  /**
   * Log performance timing
   */
  time: (label: string) => {
    if (!isDev) return;
    console.time(`⏱️  ${label}`);
  },

  timeEnd: (label: string) => {
    if (!isDev) return;
    console.timeEnd(`⏱️  ${label}`);
  },

  /**
   * Log API request/response
   */
  api: (method: string, url: string, data?: { request?: any; response?: any; status?: number; duration?: number }) => {
    if (!isDev) return;
    console.group(`%c📡 API [${method}] ${url}`, `color: ${colors.info}; font-weight: bold;`);
    if (data?.request) console.log('Request:', data.request);
    if (data?.status) console.log('Status:', data.status);
    if (data?.duration) console.log('Duration:', `${data.duration}ms`);
    if (data?.response) console.log('Response:', data.response);
    console.groupEnd();
  },
};
