import Groq from 'groq-sdk';
import fs from 'fs';
import { LLMProvider } from './provider.js';

export class GroqProvider extends LLMProvider {
  private client: Groq;
  private models: string[];
  private whisperModel: string;

  constructor(apiKey: string, models: string | string[] = ['meta-llama/llama-4-scout-17b-16e-instruct'], whisperModel = 'whisper-large-v3') {
    super();
    this.client = new Groq({ apiKey });
    this.models = Array.isArray(models) ? models : [models];
    this.whisperModel = whisperModel;
  }

  async chat(messages: any[], tools: any[] = []): Promise<any> {
    let lastError: any;

    for (const currentModel of this.models) {
      let currentTools = tools;
      let currentMessages = [...messages];
      let retryRequest = false;

      do {
        retryRequest = false;
        
        // Strip out unsupported fields like 'reasoning' from previous responses
        const safeMessages = currentMessages.map(msg => {
          if (msg && typeof msg === 'object') {
            const { reasoning, ...rest } = msg;
            return rest;
          }
          return msg;
        });

        try {
          const response = await this.client.chat.completions.create({
            model: currentModel,
            messages: safeMessages as any,
            tools: currentTools.length > 0 ? (currentTools as any) : undefined,
            tool_choice: currentTools.length > 0 ? 'auto' : undefined,
          });

          return response.choices[0].message;
        } catch (error: any) {
          if (error?.status === 429) {
            console.warn(`[WARN] Groq model ${currentModel} rate limited (429). Trying fallback if available...`);
            lastError = error;
            break; // Move to the next model in the outer loop
          }

          if (error?.status === 400 && (error?.error?.error?.message?.includes('tool calling') || error?.error?.error?.message?.includes('tools'))) {
            console.warn(`[WARN] Groq model ${currentModel} does not support tool calling. Retrying without tools...`);
            currentTools = [];
            retryRequest = true;
            lastError = error;
            continue; // Retry current model without tools
          }

          if (error?.status === 400 && error?.error?.error?.message?.includes('reduce the length of the messages')) {
            console.warn(`[WARN] Groq model ${currentModel} context limit exceeded. Reducing message history...`);
            if (currentMessages.length > 2) {
              // Keep system prompt (index 0) and the most recent messages
              const keepCount = Math.max(1, Math.floor((currentMessages.length - 1) / 2));
              currentMessages = [currentMessages[0], ...currentMessages.slice(-keepCount)];
              retryRequest = true;
              lastError = error;
              continue;
            } else {
              console.warn(`[WARN] Cannot reduce messages further for ${currentModel}. Trying fallback if available...`);
              lastError = error;
              break; // Move to the next model
            }
          }

          throw error;
        }
      } while (retryRequest);
    }

    throw lastError;
  }

  async transcribe(filePath: string): Promise<string> {
    const transcription = await this.client.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: this.whisperModel,
    });
    return transcription.text;
  }
}
