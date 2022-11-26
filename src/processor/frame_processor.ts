import { AllSettings } from "camera-interface";
import StreamProcessor from "node-stream-processor";
import { Notifications } from "notification-handler";
import { FileWriter } from "file-writer";


let settings: AllSettings;
let processor: StreamProcessor;
let notif: Notifications;
const file_writers: Array<FileWriter> = [];

let frame_cache: Array<Buffer> = [];
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

    frame_cache.push(processed.compressed);
    if (frame_cache.length > settings.motion.start_trigger_length) { frame_cache.shift(); }
    notif.Frame(processed.compressed, frame.timestamp, processed.motion);
    for (let i = 0; i < file_writers.length; i++) { file_writers[i].WriteFrame(processed.compressed); }
  }
  catch (error) {
    console.warn(error);
  }
  ProcessFrame();
}

function InitProcessorss(settings: AllSettings) {
  processor = CreateStreamProcessor(settings);
  notif = new Notifications(settings.text.cam_name, settings.motion, settings.notifications);
  for (let i = 0; i < settings.files.length; i++) {
    file_writers.push(new FileWriter(settings.text.cam_name, settings.camera.fps, settings.files[i]));
  }

  notif.events.on("start", () => {
    console.log(`Motion started on ${settings.text.cam_name}`);
    for (let i = 0; i < file_writers.length; i++) { file_writers[i].MotionStart(frame_cache); }
    frame_cache = [];
  });

  notif.events.on("stop", () => {
    console.log(`Motion stopped on ${settings.text.cam_name}`);
    for (let i = 0; i < file_writers.length; i++) { file_writers[i].MotionStop(); }
  });


}

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

const stop_sig = Buffer.from([0xff, 0x00, 0xff]);
process.once("message", (message: string) => {
  settings = JSON.parse(message);
  InitProcessorss(settings);

  process.on("message", (message: Buffer) => {
    if (Buffer.compare(message, stop_sig)) {
      Stop();
      return;
    }
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

function Stop() {
  for (let i = 0; i < file_writers.length; i++) {
    file_writers[i].Stop();
  }
  setTimeout(() => {
    process.exit();
  }, 5000);
}