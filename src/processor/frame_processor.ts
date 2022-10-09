import { AllSettings } from "camera-interface";
import StreamProcessor from "node-stream-processor";


let settings: AllSettings;
let processor: StreamProcessor;

let process_queue: Array<{ frame: Buffer, timestamp: number }> = [];

function ProcessFrame() {
  if (process_queue.length === 0) return;
  const frame = process_queue.shift();
  try {
    const processed = processor.ProcessFrame(frame.frame, frame.timestamp);
    const header = Buffer.alloc(9);
    header.writeUInt8((processed.motion) ? 1 : 0);
    header.writeBigUint64BE(BigInt(frame.timestamp), 1);
    process.send(Buffer.concat([header, processed.compressed]));
  }
  catch (error) {
    console.warn(error);
  }
  ProcessFrame();
}


process.once("message", (message: string) => {
  settings = JSON.parse(message);
  processor = CreateStreamProcessor(settings);

  process.on("message", (message: Buffer) => {
    message = Buffer.from(message);
    const timestamp = Number(message.readBigUInt64BE(0));
    process_queue.push({ frame: message.subarray(8), timestamp });
    if (process_queue.length > 30) {
      const new_queue = [];
      for (let i = 0; i < process_queue.length; i++) {
        new_queue.push(process_queue.shift());
        process_queue.shift();
      }
      console.warn("Process queue has grown about 30 frames, dropping half");
      process_queue = new_queue;
    }
    if (process_queue.length === 1) ProcessFrame();
  });
});

function CreateStreamProcessor(settings: AllSettings): StreamProcessor {
  if (settings.text && settings.motion && settings.device) {
    return StreamProcessor.FullProcessor(settings.camera, settings.text, settings.motion, settings.device);
  }
  if (settings.text) {
    return StreamProcessor.TextOverlay(settings.camera, settings.text);
  }
  if (settings.motion && settings.device) {
    return StreamProcessor.MotionDetection(settings.camera, settings.motion, settings.device);
  }
  return StreamProcessor.SimpleProcessor(settings.camera);
}