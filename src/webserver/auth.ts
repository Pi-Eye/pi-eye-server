import fs from "fs";
import argon2 from "argon2";
import crypto from "crypto";

const INACTIVE_AUTH_CLEAR = parseFloat(process.env.INACTIVE_AUTH_CLEAR) || 1; // 1 hour default
const INACTIVE_AUTH_CLEAR_MS = INACTIVE_AUTH_CLEAR * 60 * 60 * 1000;

// Possible privilages
export enum Privilages {
  kView = 0,
  kEditCameraSettings = 1,
  kEditServerSettings = 2
}

type AuthConfig = {
  users: Array<{
    user: string,
    privilage: Privilages,
    hash: string
  }>
}

export default class Auth {
  private config_: AuthConfig;
  private config_file_loc_: string;

  private auth_table: {
    [key: string]: {
      user: string,
      privilage: Privilages,
      last_login: number,
      expires: number
    }
  } = {};

  constructor(config_file_loc: string) {
    this.ReadConfigFile(config_file_loc);

  }

  /**
   * AddUser() - Add a new user
   * @param user username of user to add
   * @param pwd pwd of user to add
   * @param privilage privilages of username to add
   * @returns true if add successfully, false if not
   */
  async AddUser(user: string, pwd: string, privilage: Privilages): Promise<boolean> {
    for (let i = 0; i < this.config_.users.length; i++) { // Check that username doesn't already exist
      if (this.config_.users[i].user === user) return false;
    }

    try {
      const hash = await argon2.hash(pwd);
      this.config_.users.push({
        user,
        privilage,
        hash
      });

      fs.writeFileSync(this.config_file_loc_, JSON.stringify(this.config_));
    } catch (error) {
      console.warn(`Error while adding new user: ${error}`);
    }
    return true;
  }

  /**
   * ChangePwd() - Changes password of a user
   * @param user username of user to change password
   * @param pwd old password
   * @param new_pwd new password
   * @returns true of successful, false if not
   */
  async ChangePwd(user: string, pwd: string, new_pwd: string): Promise<boolean> {
    for (let i = 0; i < this.config_.users.length; i++) {
      const possible_user = this.config_.users[i];
      if (possible_user.user === user) {
        try {
          if (!(await argon2.verify(possible_user.hash, pwd))) return false;
        } catch (error) {
          console.warn(`Error verifying hash: ${error}`);
          return false;
        }

        try {
          possible_user.hash = await argon2.hash(new_pwd);

          fs.writeFileSync(this.config_file_loc_, JSON.stringify(this.config_));
        } catch (error) {
          console.warn(`Error while adding new user: ${error}`);
        }
        return true;

      }
    }
    return false;
  }

  /**
   * AuthUser() - Authenticate a user at a given privilage level
   * @param user username of user to authenticate
   * @param pwd password of user to authenticate
   * @param privilage privilage of user to authenticate
   * @returns 
   */
  async AuthUser(user: string, pwd: string, privilage: Privilages): Promise<string | undefined> {
    for (let i = 0; i < this.config_.users.length; i++) {
      const possible_user = this.config_.users[i];

      if (possible_user.user === user) { // find username
        if (!(possible_user.privilage >= privilage)) return undefined;      // ignore if privilages are not valid

        try {
          if (!(await argon2.verify(possible_user.hash, pwd))) return undefined; // ignore if pwd does not match
        } catch (error) {
          console.warn(`Error verifying hash: ${error}`);
          return undefined;
        }

        const cookie = crypto.randomBytes(64).toString("hex");    // getting here means success, generate cookie

        const time = Date.now();
        this.auth_table[cookie] = { // add auth table entry
          user: possible_user.user,
          privilage: possible_user.privilage,
          last_login: time,
          expires: time + INACTIVE_AUTH_CLEAR_MS
        };
        return cookie;
      }
    }
    return undefined;
  }

  /**
   * AuthUser() - Authenticate a user at a given privilage level using cookies
   * @param cookie cookie of user to authenticate
   * @param privilage privilage of user to authenticate
   * @returns 
   */
  async AuthCookie(cookie: string, privilage: Privilages): Promise<boolean> {
    const auth_entry = this.auth_table[cookie];
    if (!auth_entry) return false;

    if (!(auth_entry.expires > Date.now())) return false;
    if (!(auth_entry.privilage >= privilage)) return false;

    auth_entry.last_login = Date.now();
    auth_entry.expires = auth_entry.last_login + INACTIVE_AUTH_CLEAR_MS;
    return true;
  }

  /**
   * ReadConfigFile()
   * @param config_file_loc location of config file
   */
  private ReadConfigFile(config_file_loc: string) {
    this.config_file_loc_ = config_file_loc;
    const config = fs.readFileSync(config_file_loc).toString();
    this.config_ = JSON.parse(config);
  }
}