import Groq from 'groq-sdk';
import fs from 'fs';
import { LLMProvider } from './provider.js';

export class GroqProvider extends LLMProvider {
  constructor(apiKey, model = 'meta-llama/llama-4-scout-17b-16e-instruct', whisperModel = 'whisper-large-v3') {
    super();
    this.client = new Groq({ apiKey });
    this.model = model;
    this.whisperModel = whisperModel;
  }

  async chat(messages, tools = []) {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined,
    });

    return response.choices[0].message;
  }

  async transcribe(filePath) {
    const transcription = await this.client.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: this.whisperModel,
    });
    return transcription.text;
  }
}
