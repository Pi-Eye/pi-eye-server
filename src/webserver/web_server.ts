import express from "express";
import { static_path, index } from "pi-eye-client";
import Server from "../server";

import Auth, { Privilages } from "./auth";

const WEB_PORT = parseInt(process.env.WEB_PORT) || 8080;
const SOCKET_ADDRESS = process.env.SOCKET_ADDRESS;

export default function StartWebserver(auth: Auth, server: Server) {
  const app = express();
  app.use(express.static(static_path));
  app.use(express.json());


  app.use((req, res, next) => {  ///////// temp ///////// temp ///////// temp ///////// temp
    try {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type");
    } catch { /* */ }
    console.log(req.body);
    next();
  });

  app.get("/", (req, res) => {
    res.send(index);
  });

  app.post("/login", async (req, res) => {
    try {
      const cookie = await auth.AuthUser(req.body.user, req.body.pwd, Privilages.kView);
      res.send({
        success: (cookie) ? true : false,
        cookie
      });
      return;
    } catch (error) {
      console.warn(error);
    }
    res.send({ success: false });
  });

  app.post("/cookie", async (req, res) => {
    try {
      const valid = await auth.AuthCookie(req.body.auth_cookie, Privilages.kView);
      res.send({ success: valid });
      return;
    } catch (error) {
      console.warn(error);
    }
    res.send({ success: false });

  });

  app.get("/socket_address", (req, res) => {
    res.send({ socket_address: SOCKET_ADDRESS });
  });

  app.post("/list_cameras", async (req, res) => {
    try {
      const valid = await auth.AuthCookie(req.body.auth_cookie, Privilages.kView);
      if (valid) {
        const all_cameras = server.GetCombinedSettings();
        const addresses = all_cameras.map((camera) => camera.address);
        res.send({
          success: valid,
          addresses: JSON.stringify(addresses)
        });
        return;
      }
    } catch (error) {
      console.warn(error);
    }
    res.send({ success: false });
  });

  app.post("/camera_settings", async (req, res) => {
    try {
      const valid = await auth.AuthCookie(req.body.auth_cookie, Privilages.kView);
      if (valid) {
        res.send({
          success: valid,
          settings: JSON.stringify(server.GetCamera(req.body.address).client.GetCombinedSettings())
        });
        return;
      }
    } catch (error) {
      console.warn(error);
    }
    res.send({ success: false });
  });

  app.post("/delete_camera", async (req, res) => {
    try {
      const valid = await auth.AuthCookie(req.body.auth_cookie, Privilages.kEditServerSettings);
      if (valid) {
        server.RemoveCamera(req.body.address);
        res.send({ success: true });
        return;
      }
    } catch (error) {
      console.warn(error);
    }
    res.send({ success: false });
  });


  app.post("/new_camera_settings", async (req, res) => {
    try {
      const valid = await auth.AuthCookie(req.body.auth_cookie, Privilages.kEditCameraSettings);
      if (valid) {
        server.GetCamera(req.body.address).client.SetCombinedSettings(JSON.parse(req.body.settings));
        res.send({ success: true });
        return;
      }
    } catch (error) {
      console.warn(error);
    }
    res.send({ success: false });
  });

  app.listen(WEB_PORT, () => {
    console.log(`Web server listening on port: ${WEB_PORT}`);
  });
}