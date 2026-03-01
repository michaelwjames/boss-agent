import { KairosEngine } from '../app/lib/engine/kairos.js';
import { NormalizedMessage } from '../app/index.js';

async function testKairos() {
  console.log("Starting Kairos Test...");
  
  const onTick = async (msg: NormalizedMessage) => {
    console.log("Tick received:", msg.content);
    console.log("Author:", msg.authorTag);
    return Promise.resolve();
  };

  const engine = new KairosEngine(onTick, 0.01); // 0.6 seconds
  engine.start();

  await new Promise(resolve => setTimeout(resolve, 2000));
  engine.stop();
  console.log("Kairos Test Complete.");
}

testKairos().catch(console.error);
