/**
 * Delayed reminder script.
 * Usage: tsx skills/remind.ts <delay> <webhook_url> <message>
 *
 * Delay format: number followed by s (seconds), m (minutes), or h (hours)
 * Examples: 30s, 5m, 2h
 */

const [,, delayArg, webhookUrl, ...messageParts] = process.argv;
const message = messageParts.join(' ');

if (!delayArg || !webhookUrl || !message) {
  console.error('Usage: tsx skills/remind.ts <delay> <webhook_url> <message>');
  console.error('Example: tsx skills/remind.ts 5m https://discord.com/api/webhooks/... "Check on urgent task"');
  process.exit(1);
}

function parseDelay(input: string): number {
  const match = input.match(/^(\d+)(s|m|h)$/);
  if (!match) {
    console.error(`Invalid delay format: "${input}". Use format like 30s, 5m, or 2h`);
    process.exit(1);
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000 };
  return value * multipliers[unit];
}

const delayMs = parseDelay(delayArg);
const delayHuman = delayArg.replace('s', ' seconds').replace('m', ' minutes').replace('h', ' hours');

console.log(`Reminder set: "${message}" in ${delayHuman}`);

setTimeout(async () => {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `⏰ **REMINDER, Boss:** ${message}`,
      }),
    });

    if (!response.ok) {
      console.error(`Webhook failed: ${response.status} ${response.statusText}`);
      process.exit(1);
    }

    console.log('Reminder sent successfully.');
  } catch (err: any) {
    console.error('Failed to send reminder:', err.message);
    process.exit(1);
  }
}, delayMs);
