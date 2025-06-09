export interface AgilityConfig {
  baseFolder: string;
  apiEndpoints: {
    dev: string;
    us: string;
    canada: string;
    europe: string;
    australia: string;
  };
  oauth: {
    deviceCodeUrl: string;
    tokenUrl: string;
  };
  files: {
    codeFile: string;
    logFile: string;
  };
}

export class ConfigService {
  private static instance: ConfigService;
  private config: AgilityConfig;

  private constructor() {
    this.config = {
      baseFolder: '.agility-files',
      apiEndpoints: {
        dev: 'https://mgmt-dev.aglty.io',
        us: 'https://mgmt.aglty.io',
        canada: 'https://mgmt-ca.aglty.io',
        europe: 'https://mgmt-eu.aglty.io',
        australia: 'https://mgmt-aus.aglty.io',
      },
      oauth: {
        deviceCodeUrl: '/oauth/device/code',
        tokenUrl: '/oauth/token',
      },
      files: {
        codeFile: 'code.json',
        logFile: 'instancelog.txt',
      },
    };
  }

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  getConfig(): AgilityConfig {
    return this.config;
  }

  getBaseFolder(): string {
    return this.config.baseFolder;
  }

  getApiEndpoint(region: 'dev' | 'us' | 'canada' | 'europe' | 'australia'): string {
    return this.config.apiEndpoints[region];
  }

  getApiEndpointForGuid(guid: string): string {
    if (guid.endsWith('d')) {
      return this.config.apiEndpoints.dev;
    } else if (guid.endsWith('c')) {
      return this.config.apiEndpoints.canada;
    } else if (guid.endsWith('e')) {
      return this.config.apiEndpoints.europe;
    } else if (guid.endsWith('a')) {
      return this.config.apiEndpoints.australia;
    } else {
      return this.config.apiEndpoints.us;
    }
  }
}
