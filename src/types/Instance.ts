export interface AgilityInstance {
    guid: string;
    previewKey: string;
    fetchKey: string;
    websiteDetails: {
      orgCode: string;
      orgName: string;
      websiteName: string;
      websiteNameStripped: string;
      displayName: string;
      guid: string;
      websiteID: number;
      isCurrent: boolean;
      managerUrl: string;
      version: string;
      isOwner: boolean;
      isDormant: boolean;
      isRestoring: boolean;
      teamID: string | null;
    };
  }