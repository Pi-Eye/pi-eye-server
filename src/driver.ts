import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "..", ".env") });

import Server from "./server";

const CONFIG_DIR = process.env.CONFIG_DIR || path.join(__dirname, "..", "..", "config");


function StartServer() {
  const server = new Server(CONFIG_DIR);
}

StartServer();