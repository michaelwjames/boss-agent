import { NormalizedMessage } from '../../index.js';

export type TickCallback = (message: NormalizedMessage) => Promise<void>;

export class KairosEngine {
  private intervalMs: number;
  private onTick: TickCallback;
  private timer: NodeJS.Timeout | null = null;

  constructor(onTick: TickCallback, intervalMinutes: number = 30) {
    this.onTick = onTick;
    this.intervalMs = intervalMinutes * 60 * 1000;
  }

  /**
   * Start the Kairos Heartbeat Engine
   */
  start(): void {
    if (this.timer) return;
    
    console.log(`[KAIROS] Starting engine with ${this.intervalMs / 60000}m interval.`);
    
    this.timer = setInterval(async () => {
      console.log(`[KAIROS] Heartbeat tick firing...`);
      const syntheticMessage: NormalizedMessage = {
        sessionId: 'AUTO_BROADCAST', // Placeholder, will be mapped to active sessions in integration
        authorId: 'system-kairos',
        authorTag: 'KairosEngine',
        content: '[SYSTEM: KAIROS_TICK] Time to check your tasks, evaluate in-progress work, and decide if you need to proactively contact the Boss.',
        reply: async (content: string) => console.log(`[KAIROS] Reply: ${content}`),
        send: async (content: string) => console.log(`[KAIROS] Send: ${content}`),
        sendTyping: async () => {}
      };
      
      try {
        await this.onTick(syntheticMessage);
      } catch (err) {
        console.error(`[KAIROS] Error during tick callback:`, err);
      }
    }, this.intervalMs);
  }

  /**
   * Stop the Kairos Heartbeat Engine
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log(`[KAIROS] Engine stopped.`);
    }
  }
}
