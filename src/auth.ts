import axios, { AxiosInstance } from 'axios';
import { cliToken } from './models/cliToken';
import { fileOperations } from './fileOperations';
import { serverUser } from './models/serverUser';
import { WebsiteUser } from './models/websiteUser';
import { ConfigService } from './config';
const open = require('open');

export class Auth {
  private config: ConfigService;

  constructor() {
    this.config = ConfigService.getInstance();
  }

  async generateCode() {
    const firstPart = (Math.random() * 46656) | 0;
    const secondPart = (Math.random() * 46656) | 0;
    const firstString = ('000' + firstPart.toString(36)).slice(-3);
    const secondString = ('000' + secondPart.toString(36)).slice(-3);
    return firstString + secondString;
  }

  determineBaseUrl(guid: string, userBaseUrl: string = null): string {
    if (userBaseUrl) {
      return userBaseUrl;
    }
    return this.config.getApiEndpointForGuid(guid);
  }

  getInstance(guid: string, userBaseUrl: string = null): AxiosInstance {
    const baseUrl = this.determineBaseUrl(guid, userBaseUrl);
    const instance = axios.create({
      baseURL: `${baseUrl}/oauth`,
    });
    return instance;
  }

  getInstancePoll(): AxiosInstance {
    const baseURL = 'https://mgmt.aglty.io';
    const instance = axios.create({
      baseURL: `${baseURL}/oauth`,
    });
    return instance;
  }

  async executeGet(apiPath: string, guid: string, userBaseUrl: string = null) {
    const instance = this.getInstance(guid, userBaseUrl);
    try {
      const resp = await instance.get(apiPath, {
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      return resp;
    } catch (err) {
      throw err;
    }
  }

  async executePost(apiPath: string, guid: string, data: any) {
    const instance = this.getInstancePoll();
    try {
      const resp = await instance.post(apiPath, data, {
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      return resp;
    } catch (err) {
      throw err;
    }
  }

  async authorize() {
    const code = await this.generateCode();
    //let url = `https://mgmt-dev.aglty.io/oauth/Authorize?response_type=code&redirect_uri=https://mgmt-dev.aglty.io/oauth/CliAuth&state=cli-code%2e${code}`;
    const url = `https://mgmt.aglty.io/oauth/Authorize?response_type=code&redirect_uri=https://mgmt.aglty.io/oauth/CliAuth&state=cli-code%2e${code}`;
    await open(url);
    const codeFile = new fileOperations();
    codeFile.createTempFile('code.json', `{"code": "${code}"}`);
    return code;
  }

  async cliPoll(formData: FormData, guid: string = 'blank-d') {
    const apiPath = `CliPoll`;
    const response = await this.executePost(apiPath, guid, formData);
    return response.data as cliToken;
  }

  async getPreviewKey(guid: string, userBaseUrl: string = null) {
    const apiPath = `GetPreviewKey?guid=${guid}`;
    try {
      const response = await this.executeGet(apiPath, guid, userBaseUrl);
      return response.data as string;
    } catch {
      return null;
    }
  }

  async checkUserRole(guid: string, token: string) {
    const baseUrl = this.determineBaseUrl(guid);
    let access = false;
    const instance = axios.create({
      baseURL: `${baseUrl}/api/v1/`,
    });
    const apiPath = `/instance/${guid}/user`;
    try {
      const resp = await instance.get(apiPath, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
        },
      });

      const webSiteUser = resp.data as WebsiteUser;
      if (webSiteUser.isOrgAdmin) {
        access = true;
      } else {
        for (let i = 0; i < webSiteUser.userRoles.length; i++) {
          const role = webSiteUser.userRoles[i];
          if (role.name === 'Manager' || role.name === 'Administrator') {
            access = true;
          }
        }
      }
    } catch {
      return false;
    }

    return access;
  }

  async getUser(guid: string, token: string) {
    const baseUrl = this.determineBaseUrl(guid);
    const instance = axios.create({
      baseURL: `${baseUrl}/api/v1/`,
    });
    const apiPath = '/users/me';
    try {
      const resp = await instance.get(apiPath, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
        },
      });
      return resp.data as serverUser;
    } catch {
      return null;
    }
  }
}
