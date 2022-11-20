import http from "http";
import https from "https";
import express from "express";
import { static_path, index } from "pi-eye-client";

import Server from "../server";

import Auth, { Privilages } from "./auth";

const SOCKET_ADDRESS = process.env.SOCKET_ADDRESS;

export default function StartWebserver(auth: Auth, https_server: https.Server | http.Server, server: Server) {
  const app = express();
  app.use(express.static(static_path));
  app.use(express.json());

  app.get("/", (req, res) => {
    res.sendFile(index);
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

  app.post("/camera_name", async (req, res) => {
    try {
      const valid = await auth.AuthCookie(req.body.auth_cookie, Privilages.kView);
      if (valid) {
        res.send({
          success: valid,
          name: server.GetCamera(req.body.address).client.GetCombinedSettings().text.cam_name,
          fps: server.GetCamera(req.body.address).client.GetCombinedSettings().camera.fps
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
      const valid = await auth.AuthCookie(req.body.auth_cookie, Privilages.kEditCameraSettings);
      if (valid) {
        res.send({
          success: valid,
          settings: JSON.stringify(server.GetCamera(req.body.address).settings)
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

  app.post("/new_camera_password", async (req, res) => {
    try {
      const valid = await auth.AuthCookie(req.body.auth_cookie, Privilages.kEditCameraSettings);
      if (valid) {
        server.GetCamera(req.body.address).client.SetPassword(req.body.password);
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

  app.post("/server_settings", async (req, res) => {
    try {
      const valid = await auth.AuthCookie(req.body.auth_cookie, Privilages.kEditServerSettings);
      if (valid) {
        const accounts = auth.GetUsers();
        res.send({
          success: true,
          accounts
        });
        return;
      }
    } catch (error) {
      console.warn(error);
    }
    res.send({ success: false });
  });

  app.post("/add_camera", async (req, res) => {
    try {
      const valid = await auth.AuthCookie(req.body.auth_cookie, Privilages.kEditServerSettings);
      if (valid) {
        server.AddCamera(req.body.address, req.body.password);
        res.send({ success: true, });
        return;
      }
    } catch (error) {
      console.warn(error);
    }
    res.send({ success: false });
  });

  app.post("/add_user", async (req, res) => {
    try {
      const valid = await auth.AuthCookie(req.body.auth_cookie, Privilages.kEditServerSettings);
      if (valid) {
        auth.AddUser(req.body.user, req.body.pwd, req.body.privilage);
        res.send({ success: true });
        return;
      }
    } catch (error) {
      console.warn(error);
    }
    res.send({ success: false });
  });

  app.post("/remove_user", async (req, res) => {
    try {
      const valid = await auth.AuthCookie(req.body.auth_cookie, Privilages.kEditServerSettings);
      if (valid) {
        auth.DeleteUser(req.body.user);
        res.send({ success: true });
        return;
      }
    } catch (error) {
      console.warn(error);
    }
    res.send({ success: false });
  });

  https_server.on("request", app);
}