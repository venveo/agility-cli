import axios, { AxiosInstance } from "axios";
import { cliToken } from "./types/cliToken";
import { fileOperations } from "./fileOperations";
import { serverUser } from "./types/serverUser";
import { WebsiteUser } from "./types/websiteUser";
import { forceDevMode, forceLocalMode } from ".";
const open = require("open");
const FormData = require("form-data");

import keytar from "keytar";
import { exit } from "process";
import ansiColors from "ansi-colors";

const SERVICE_NAME = "agility-cli";

let lastLength = 0;

function logReplace(text) {
  const clear = " ".repeat(lastLength);
  process.stdout.write("\r" + clear + "\r" + text);
  lastLength = text.length;
}

export class Auth {
  getEnv(): "dev" | "local" | "prod" {
    return forceDevMode ? "dev" : forceLocalMode ? "local" : "prod";
  }

  getEnvKey(env: string): string {
    return `cli-auth-token:${env}`;
  }

  async logout() {
    const env = this.getEnv();
    const key = this.getEnvKey(env);
    try {
      const removed = await keytar.deletePassword(SERVICE_NAME, key);
      if (removed) {
        console.log(`Logged out from ${env} environment.`);
      } else {
        console.log(`No token found in ${env} environment.`);
      }
    } catch (err) {
      console.error(`❌ Failed to delete token:`, err);
    }
    exit();
  }

  async generateCode() {
    let firstPart = (Math.random() * 46656) | 0;
    let secondPart = (Math.random() * 46656) | 0;
    let firstString = ("000" + firstPart.toString(36)).slice(-3);
    let secondString = ("000" + secondPart.toString(36)).slice(-3);
    return firstString + secondString;
  }

  determineBaseUrl(guid?: string, userBaseUrl: string = null): string {
    if (userBaseUrl) {
      return userBaseUrl;
    }
    if (forceLocalMode) {
      return "https://localhost:5050";
    }
    if (forceDevMode) {
      return "https://mgmt-dev.aglty.io";
    }
    if (guid?.endsWith("d")) {
      return "https://mgmt-dev.aglty.io";
    } else if (guid?.endsWith("u")) {
      return "https://mgmt.aglty.io";
    } else if (guid?.endsWith("c")) {
      return "https://mgmt-ca.aglty.io";
    } else if (guid?.endsWith("e")) {
      return "https://mgmt-eu.aglty.io";
    } else if (guid?.endsWith("a")) {
      return "https://mgmt-aus.aglty.io";
    }
    return "https://mgmt.aglty.io";
  }

  getInstance(guid: string, userBaseUrl: string = null): AxiosInstance {
    let baseUrl = this.determineBaseUrl(guid, userBaseUrl);
    let instance = axios.create({
      baseURL: `${baseUrl}/oauth`,
    });
    return instance;
  }

  getInstancePoll(): AxiosInstance {
    let baseURL = forceDevMode ? "https://mgmt-dev.aglty.io" : "https://mgmt.aglty.io";
    if (forceLocalMode) {
      baseURL = "https://localhost:5050";
    }
    let instance = axios.create({
      baseURL: `${baseURL}/oauth`,
    });
    return instance;
  }

  async executeGet(apiPath: string, guid: string, userBaseUrl: string = null) {
    let instance = this.getInstance(guid, userBaseUrl);
    try {
      const resp = await instance.get(apiPath, {
        headers: {
          "Cache-Control": "no-cache",
        },
      });
      return resp;
    } catch (err) {
      console.log("error", err);
      throw err;
    }
  }

  async executePost(apiPath: string, guid: string, data: any) {
    let instance = this.getInstancePoll();
    try {
      const resp = await instance.post(apiPath, data, {
        headers: {
          "Cache-Control": "no-cache",
        },
      });
      return resp;
    } catch (err) {
      throw err;
    }
  }

  async authorize() {
    let code = await this.generateCode();

    let localDevUrl = `https://localhost:5050/oauth/Authorize?response_type=code&redirect_uri=https://localhost:5050/oauth/CliAuth&state=cli-code%2e${code}`;
    let devUrl = `https://mgmt-dev.aglty.io/oauth/Authorize?response_type=code&redirect_uri=https://mgmt-dev.aglty.io/oauth/CliAuth&state=cli-code%2e${code}`;
    let prodUrl = `https://mgmt.aglty.io/oauth/Authorize?response_type=code&redirect_uri=https://mgmt.aglty.io/oauth/CliAuth&state=cli-code%2e${code}`;

    let url = prodUrl;
    if (forceDevMode) {
      url = devUrl;
    }

    if (forceLocalMode) {
      url = localDevUrl;
    }

    await open(url);
    return code;
  }
  async checkAuthorization(): Promise<boolean> {
    const env = this.getEnv();
    const key = this.getEnvKey(env);
    const tokenRaw = await keytar.getPassword(SERVICE_NAME, key);

    if (tokenRaw) {
      try {
        const token = JSON.parse(tokenRaw);

        if (token.access_token && token.expires_in && token.timestamp) {
          const issuedAt = new Date(token.timestamp).getTime();
          const expiresAt = issuedAt + token.expires_in * 1000;

          if (Date.now() < expiresAt) {
            logReplace(ansiColors.green(`\r● Authenticated to ${env === 'prod' ? 'Agility': env} servers.\n`));
            console.log("----------------------------------\n");
            return true;
          } else {
            console.log("Existing token has expired. Starting re-authentication...");
          }
        } else {
          console.warn("Token is missing expiration metadata. Re-authentication required.");
        }
      } catch (err) {
        console.warn("Failed to parse token. Re-authentication required.");
      }
    } else {
      // console.log("🔍 No token found in keychain. Starting auth flow...");
    }

    const cliCode = await this.authorize();
    logReplace("\rWaiting for authentication in your browser...");

    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const form = new FormData();
          form.append("cliCode", cliCode);
          const token = await this.cliPoll(form);

          if (token && token.access_token && token.expires_in && token.timestamp) {
            // Store token in keytar
            logReplace(ansiColors.green(`\r🔑 Authenticated to ${env} servers.\n`));
            console.log("----------------------------------\n");

            await keytar.setPassword(SERVICE_NAME, key, JSON.stringify(token));
            clearInterval(interval);
            resolve(true);
          }
        } catch (err) {
          // Keep polling
        }
      }, 2000);

      setTimeout(() => {
        clearInterval(interval);
        reject(new Error("Authorization timed out after 60 seconds."));
      }, 60000);
    });
  }

  async getToken(): Promise<string> {
    const env = this.getEnv();
    const key = this.getEnvKey(env);

    const tokenRaw = await keytar.getPassword(SERVICE_NAME, key);

    if (!tokenRaw) {
      throw new Error(`❌ No token found in keychain for environment: ${env}. Run 'agility login' to authenticate.`);
    }

    try {
      const token = JSON.parse(tokenRaw);

      if (token.access_token && token.expires_in && token.timestamp) {
        const issuedAt = new Date(token.timestamp).getTime();
        const expiresAt = issuedAt + token.expires_in * 1000;

        if (Date.now() < expiresAt) {
          return token.access_token;
        } else {
          throw new Error("❌ Token has expired. Please run `agility login` again.");
        }
      } else {
        throw new Error("❌ Token is missing required fields (access_token, expires_in, timestamp).");
      }
    } catch (err) {
      throw new Error("❌ Failed to parse stored token. Please log in again.");
    }
  }

  async updateCodeFileStatus(status: string, environment: string) {
    let file = new fileOperations();
    if (file.codeFileExists()) {
      let data = JSON.parse(file.readTempFile("code.json"));
      // file.deleteCodeFile()
      data.status = status;
      data.environment = environment;
      file.createTempFile("code.json", JSON.stringify(data, null, 4));
    } else {
      throw new Error("Code file does not exist");
    }
  }

  async cliPoll(formData: FormData, guid: string = "blank-d") {
    let apiPath = `CliPoll`;
    try {
      const response = await this.executePost(apiPath, guid, formData);
      return response.data as cliToken;
    } catch (error) {
      console.error("Error during CLI poll:", error);
      throw error;
    }
  }

  async getPreviewKey(guid: string, userBaseUrl: string = null) {
    let apiPath = `GetPreviewKey?guid=${guid}`;
    try {
      const response = await this.executeGet(apiPath, guid, userBaseUrl);
      return response.data as string;
    } catch {
      return null;
    }
  }

  async getFetchKey(guid: string, userBaseUrl: string = null) {
    let apiPath = `GetFetchKey?guid=${guid}`;
    try {
      const response = await this.executeGet(apiPath, guid, userBaseUrl);
      return response.data as string;
    } catch {
      return null;
    }
  }

  async checkUserRole(guid: string) {
    let baseUrl = this.determineBaseUrl(guid);
    let access = false;

    let instance = axios.create({
      baseURL: `${baseUrl}/api/v1/`,
    });
    let apiPath = `/instance/${guid}/user`;

    const token = await this.getToken();

    try {
      const resp = await instance.get(apiPath, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache",
        },
      });

      let webSiteUser = resp.data as WebsiteUser;

      if (webSiteUser.isOrgAdmin) {
        access = true;
      } else {
        for (let i = 0; i < webSiteUser.userRoles.length; i++) {
          let role = webSiteUser.userRoles[i];
          if (role.name === "Manager" || role.name === "Administrator") {
            access = true;
          }
        }
      }
    } catch {
      return false;
    }

    return access;
  }

  async getUser(guid?: string) {
    let baseUrl = this.determineBaseUrl(guid);
    let apiPath = "/users/me";
    let endpoint = `${baseUrl}/api/v1${apiPath}`;

    const token = await this.getToken();

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache",
        },
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const data: serverUser = await response.json();
      return data;
    } catch (error) {
      // console.error('Fetch error:', error);
      return null;
    }
  }

  async getUsers(guid: string, userBaseUrl: string = null) {
      let apiPath = `/instance/${guid}/user/list`;
      let baseUrl = this.determineBaseUrl(guid, userBaseUrl);
      let instance = axios.create({
          baseURL: `${baseUrl}/api/v1/`,
      });
      const token = await this.getToken();
      try {
          const resp = await instance.get(apiPath, {
              headers: {
                  Authorization: `Bearer ${token}`,
                  "Cache-Control": "no-cache",
              },
          });
          return resp.data as serverUser;
      }
      catch (error) {
          console.error("Error fetching user:", error);
          return null;
      }
    }
}

