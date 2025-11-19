import OpenAI from 'openai';
import { logger } from './logger';

// Lazy initialization of OpenAI client
let openai: OpenAI | null = null;
let initializationError: Error | null = null;

function getOpenAIKey(): string {
  const apiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
  
  logger.debug('[OpenAI] Checking API key', {
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    hasLLMKey: !!process.env.LLM_API_KEY,
    hasKey: !!apiKey,
    keyPrefix: apiKey ? apiKey.substring(0, 7) + '...' : 'MISSING',
  });

  if (!apiKey) {
    const availableVars = Object.keys(process.env).filter(k => k.includes('OPENAI') || k.includes('LLM'));
    const error = new Error(
      'OpenAI API key not configured. Set OPENAI_API_KEY or LLM_API_KEY environment variable. ' +
      'In AWS Amplify: Go to Environment Variables → Add as Secrets → Redeploy. ' +
      `Found ${availableVars.length} OPENAI/LLM vars: ${availableVars.join(', ') || 'none'}`
    );
    logger.error('[OpenAI] API key check failed', {
      availableEnvVars: availableVars,
      allEnvVarCount: Object.keys(process.env).length,
    });
    throw error;
  }

  return apiKey;
}

export function getOpenAIClient(): OpenAI {
  // If we have a previous error but key is now available, clear error and retry
  if (initializationError) {
    const currentKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
    if (currentKey) {
      logger.debug('[OpenAI] API key now available, clearing error state and retrying');
      initializationError = null;
      openai = null;
    } else {
      throw initializationError;
    }
  }

  if (!openai) {
    try {
      const apiKey = getOpenAIKey();
      
      openai = new OpenAI({
        apiKey,
        baseURL: process.env.LLM_API_URL,
      });
      
      initializationError = null;
      logger.debug('[OpenAI] Client initialized successfully');
    } catch (error: any) {
      logger.error('[OpenAI] Failed to initialize client:', error);
      initializationError = error;
      throw error;
    }
  }

  return openai;
}

