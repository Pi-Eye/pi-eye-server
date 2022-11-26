import path from "path";
import EventEmitter from "events";
import TypedEventEmitter from "typed-emitter";
import { AllSettings } from "camera-interface";
import { ChildProcess, fork } from "child_process";

type FrameEvent = {
  [key: string]: (frame: Buffer, timestamp: number, motion: boolean) => void;
}

export default class Processor {
  private frames_ = new EventEmitter() as TypedEventEmitter<FrameEvent>;
  private ready_ = false;
  private child_: ChildProcess;
  private timestamps_: Array<number> = [];

  constructor(settings: AllSettings) {
    this.child_ = fork(path.join(__dirname, "frame_processor.js"));

    this.child_.on("spawn", () => {
      this.child_.send(JSON.stringify(settings));
    });

    this.child_.on("message", (processed: Buffer) => {
      processed = Buffer.from(processed);
      const motion = processed.readUInt8(0) === 1;
      const timestamp = Number(processed.readBigUInt64BE(1));
      const frame = processed.subarray(9);
      this.frames_.emit(timestamp.toString(), frame, timestamp, motion);
    });

    this.child_.on("error", (error) => {
      console.warn(error);
    });

    this.child_.on("close", (code) => {
      console.warn(`Processor closed with code: ${code}`);
    });
  }

  Stop() {
    this.child_.send(Buffer.from([0xff, 0x00, 0xff]));
    this.frames_.removeAllListeners();
  }

  async ProcessFrame(frame: Buffer, timestamp: number): Promise<{ frame: Buffer, timestamp: number, motion: boolean }> {
    return new Promise((resolve) => {
      const header = Buffer.alloc(8);
      header.writeBigUInt64BE(BigInt(timestamp));
      try {
        this.child_.send(Buffer.concat([header, frame]));

        setTimeout(() => this.frames_.removeAllListeners(timestamp.toString()), 60000);
        this.frames_.once(timestamp.toString(), (frame, timestamp, motion) => {
          resolve({ frame, timestamp, motion });
        });
      }
      catch (error) {
        console.warn(error);
      }
    });
  }
}