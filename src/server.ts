import fs from "fs";
import path from "path";
import { EventEmitter } from "events";
import TypedEmitter from "typed-emitter";

import { CameraClient } from "camera-connection";
import ServerSide from "client-connection-server";
import { AllSettings } from "camera-interface";
import Processor from "./processor/frame_processor_driver";
import Auth, { Privilages } from "./webserver/auth";

import StartWebserver from "./webserver/web_server";

const SOCKET_PORT = parseInt(process.env.SOCKET_PORT) || 8081;
const CONFIG_DIR = process.env.CONFIG_DIR || path.join(__dirname, "..", "..", "config");

type ServerConfig = {
  next_id: number;
  camera_configs: Array<string>;
};

type ProcessedCameraEvents = {
  frame: (frame: Buffer, timestamp: number, motion: boolean) => void;
  motion: (frmae: Buffer, timestamp: number) => void;
}

type ConnectedCamera = {
  address: string;
  config_loc: string;
  client: CameraClient;
  processor: Processor | undefined;
  settings: AllSettings,
  events: TypedEmitter<ProcessedCameraEvents>
};

export default class Server {
  private websocket_: ServerSide;

  private config_files_dir_: string;

  private cameras_: Array<ConnectedCamera> = [];
  private config_: ServerConfig;

  constructor(config_files_dir: string) {
    this.ReadConfigFile(config_files_dir);
    const auth = new Auth(path.join(CONFIG_DIR, "auth.json"));

    this.websocket_ = new ServerSide(SOCKET_PORT, async (cookie: string) => {
      return await auth.AuthCookie(cookie, Privilages.kView);
    });

    for (let i = 0; i < this.config_.camera_configs.length; i++) {
      this.InitCamera(this.config_.camera_configs[i]);
    }

    StartWebserver(auth, this);
  }

  GetCombinedSettings(): Array<{ address: string, settings: AllSettings }> {
    const combined_settings = [];
    for (let i = 0; i < this.cameras_.length; i++) {
      combined_settings.push({
        address: this.cameras_[i].address,
        settings: this.cameras_[i].settings
      });
    }
    return combined_settings;
  }

  AddCamera(address: string, pwd: string): ConnectedCamera {
    const filename = this.config_.next_id + ".json";
    this.config_.next_id++;
    fs.writeFileSync(path.join(this.config_files_dir_, "server_config.json"), JSON.stringify(this.config_));
    fs.writeFileSync(path.join(this.config_files_dir_), filename), JSON.stringify({ address, pwd });
    return this.InitCamera(filename);
  }

  GetCamera(address: string): ConnectedCamera | undefined {
    for (let i = 0; i < this.cameras_.length; i++) {
      if (this.cameras_[i].address == address) {
        return this.cameras_[i];
      }
    }
    return undefined;
  }

  GetCameraList() {
    const list = [];
    for (let i = 0; i < this.config_.camera_configs.length; i++) {
      list.push(this.config_.camera_configs[i]);
    }
    return list;
  }

  RemoveCamera(address: string) {
    console.log(`Removing camera with address: ${address}`);
    for (let i = 0; i < this.cameras_.length; i++) {
      if (this.cameras_[i].address == address) {
        const config_file = path.basename(this.cameras_[i].config_loc);
        const index = this.config_.camera_configs.indexOf(config_file);
        if (index === -1) {
          console.error(`Camera with address: ${address} not found`);
          return;
        }
        this.config_.camera_configs.splice(index, 1);
        fs.writeFileSync(path.join(this.config_files_dir_, "server_config.json"), JSON.stringify(this.config_));

        const camera = this.cameras_[i].client;
        camera.events.removeAllListeners();
        camera.Stop();
        try {
          fs.unlinkSync(this.cameras_[i].config_loc);
        } catch (error) {
          console.warn(`Failed to remove camera configuration at: ${this.cameras_[i].config_loc}`);
        }
        this.cameras_.splice(i, 1);
        return;
      }
    }

    try {
      fs.writeFileSync(path.join(this.config_files_dir_, "server_config.json"), JSON.stringify(this.config_));
    } catch (error) {
      console.error(`Error while writing to server config file. Error: ${error}`);
    }
  }

  private InitCamera(filename: string): ConnectedCamera {
    const config_loc = path.join(this.config_files_dir_, filename);
    const camera = new CameraClient(config_loc);
    const address = JSON.parse(fs.readFileSync(config_loc).toString()).address;

    const connected_camera: ConnectedCamera = {
      address,
      config_loc,
      client: camera,
      processor: undefined,
      settings: undefined,
      events: new EventEmitter() as TypedEmitter<ProcessedCameraEvents>
    };
    this.cameras_.push(connected_camera);

    camera.events.on("disconnect", () => {
      console.warn(`Camera at address: ${connected_camera.address} disconnected`);
      try {
        connected_camera.processor.Stop();
      } catch { /* */ }
    });

    camera.events.on("error", () => {
      console.error(`Error on camera client at address: ${connected_camera.address}`);
    });

    camera.events.on("ready", (settings) => {
      connected_camera.settings = settings;
      connected_camera.processor = new Processor(settings);
    });

    camera.events.on("frame", async (frame, timestamp) => {
      if (connected_camera.processor) {
        const processed = await connected_camera.processor.ProcessFrame(frame, timestamp);
        this.websocket_.QueueFrame(processed.frame, timestamp, processed.motion, connected_camera.address);

        connected_camera.events.emit("frame", processed.frame, timestamp, processed.motion);
      }
    });

    return connected_camera;
  }

  private ReadConfigFile(config_files_dir: string) {
    this.config_files_dir_ = config_files_dir;
    const data = fs.readFileSync(path.join(config_files_dir, "server_config.json"));
    this.config_ = JSON.parse(data.toString());
  }
}