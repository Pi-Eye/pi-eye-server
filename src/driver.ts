import dotenv from "dotenv";
dotenv.config();
import path from "path";

console.log(process.env);
import Server from "./server";

const CONFIG_DIR = process.env.CONFIG_DIR || path.join(__dirname, "..", "..", "config");


function StartServer() {
  const server = new Server(CONFIG_DIR);
}

StartServer();