import Groq from 'groq-sdk';

export class GroqProvider {
  constructor(apiKey, model = 'llama3-70b-8192') {
    this.client = new Groq({ apiKey });
    this.model = model;
  }

  async getChatCompletion(messages, tools = []) {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined,
    });

    return response.choices[0].message;
  }

  getToolsDefinition() {
    return [
      {
        type: 'function',
        function: {
          name: 'run_terminal',
          description: 'Execute a local shell command. Use this to run scripts, queries, or other terminal operations.',
          parameters: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'The shell command to execute.',
              },
            },
            required: ['command'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'write_note',
          description: 'Save a new note to the memory directory as a Markdown file.',
          parameters: {
            type: 'object',
            properties: {
              filename: {
                type: 'string',
                description: 'The name of the file (e.g., report.md).',
              },
              content: {
                type: 'string',
                description: 'The content of the note in Markdown format.',
              },
            },
            required: ['filename', 'content'],
          },
        },
      },
    ];
  }
}
