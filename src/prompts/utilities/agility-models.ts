import { FC } from "react";
// react isn't necessarily installed in the CLI, or the destination app
// Not sure how to handle the functional component aspect


/**
 * Represents a reference to a piece of content in the system.
 * @typedef ContentReference
 * @property {number} [contentid] - The unique identifier of the content item.
 * @property {boolean} [fulllist] - Indicates whether the full list of content items should be retrieved.
 * @property {string} [referencename] - The name of the reference for the content item.
 */
export interface ContentReference {
	contentid?: number
	fulllist?: boolean
	referencename?: string
}

 /**
 * Defines a page's visibility.
 * @typedef SitemapVisibility
 * @memberof AgilityFetch.Types
 * @property {boolean} menu - If set to true, this page should be hidden from menus.
 * @property {boolean} sitemap - If set to true, this page should be hidden from the sitemap and not accessible by robots.
 */

 export interface SitemapVisibility {
    menu: boolean;
    sitemap: boolean;
  }



 /**
 * Defines the common **System Properties** of pages and content items in the CMS.
 * @typedef SystemProperties
 * @memberof AgilityFetch.Types
 * @property {datetime} created - The date/time this item was created.
 * @property {datetime} modified - The date/time this item was last modified.
 * @property {number} state - The **state** of this content item. **1** = *Staging*, **2** = *Published*, **3** = *Deleted*, **4** = *Approved*, **5** = *AwaitingApproval*, **6** = *Declined*, **7** = *Unpublished*
 * @property {number} versionID - The unique versionID of this content item.
 */

 export interface SystemProperties {
    created: Date;
    modified: Date;
    state: 1 | 2 | 3 | 4 | 5 | 6 | 7;
    versionID: number;
  }


/**
* Defines a **Content Zone** on a page in the CMS.
* @typedef ContentZone
* @memberof AgilityFetch.Types
* @property {string} module - The reference name of the module definition of this module.
* @property {AgilityFetch.Types.ContentItem} item - The contentItem representing the content of this module.
*/


export interface ContentZone {
  module: string;
  item: ContentItem | ContentReference;
  customData?: any;
}


 /**
 * Defines a **Page** in the CMS.
 * @typedef Page
 * @memberof AgilityFetch.Types
 * @property {number} pageID - The unique ID of the page in this language.
 * @property {string} name - The friendly url slug for the page - this is used to make up the URL.
 * @property {string} path - The url path for this page.
 * @property {string} title - The page title for the page, used for SEO and appears in the browser bar/tab.
 * @property {string} menuText - And alternate text field, often used in dynamic menu generation.
 * @property {string} pageType - The type of page. Valid values include *static*, *dynamic*, *dynamic_node*, *link*, and *folder*.
 * @property {string} templateName - The name of the Page Template this page uses.
 * @property {boolean} securePage - This value represents whether this page should be secured within the website.
 * @property {AgilityFetch.Types.SystemProperties} properties The system properties of this page item.
 * @property {Object.<string, AgilityFetch.Types.ContentZone>} zones - Contains a dictionary of content zones for this page and the modules in each zone.
 * @property {string} [redirectUrl] - If this page is a *link*, then this property will show the intended destination redirect.
 * @property {number} [dynamicItemContentID] - If this page is a dynamic page, then this property will show the associated contentID of the dynamic content item.
 * @property {AgilityFetch.Types.SitemapVisibility} visible - Object that contains properties pertaining to the intended visibility of this page for seo and menus.
 */

    // Define the SystemProperties interface if necessary
    // interface SystemProperties {
    //   // Define properties of AgilityFetch.Types.SystemProperties if needed
    //   // For example:
    //   someProperty: string;
    // }
  
    // Define the ContentZone interface if necessary
    // interface ContentZone {
    //   // Define properties of AgilityFetch.Types.ContentZone if needed
    //   // For example:
    //   someProperty: string;
    // }
  
    // Define the SitemapVisibility type if necessary
    // type SitemapVisibility = {
    //   // Define properties of AgilityFetch.Types.SitemapVisibility if needed
    //   // For example:
    //   isVisible: boolean;
    // };

        export interface Page {
          pageID: number;
          name: string;
          path: string;
          title: string;
          menuText: string;
          pageType: "static" | "dynamic" | "dynamic_node" | "link" | "folder";
          templateName: string;
          securePage: boolean;
          properties: SystemProperties; // Replace with the actual SystemProperties interface
          zones: { [key: string]: ContentZone[] }; // Replace with the actual ContentZone interface
          redirectUrl?: string;
          dynamicItemContentID?: number;
          visible: SitemapVisibility; // Replace with the actual SitemapVisibility type
          seo?: SEOProperties;
        }
      


/**
 * Defines the configuration options for the API client.
 * @typedef Config
 * @property {string | null} [baseUrl] - The optional base URL for the API.
 * @property {boolean} [isPreview] - Indicates whether the API will use the Preview API. Default is false.
 * @property {string | null} [guid] - The GUID that represents your instance.
 * @property {string | null} [apiKey] - The Fetch or Preview API key.
 * @property {string | null} [locale] - The locale for the API requests.
 * @property {Object.<string, string>} [headers] - Additional headers to include in the request.
 * @property {boolean} [requiresGuidInHeaders] - Indicates if the GUID is required in headers.
 * @property {'debug' | 'info' | 'warn' | 'error' | 'silent'} [logLevel] - The logging level. Default is 'warn'.
 * @property {boolean} [debug] - Used for debugging purposes. Default is false.
 * @property {Object} [caching] - Optional caching options.
 * @property {number} [caching.maxAge] - The maximum age for caching. Caching is disabled by default.
 * @property {any} [fetchConfig] - Additional fetch configuration options.
 */
export interface Config {
    baseUrl?: string | null;
    isPreview?: boolean;
    guid?: string | null;
    apiKey?: string | null;
    locale?: string | null;
    headers?: { [key: string]: string };
    requiresGuidInHeaders?: boolean;
    logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'silent';
    debug?: boolean;
    caching?: {
        maxAge?: number;
    };
    fetchConfig?: any;
}

/**
 * Represents the parameters required for making an HTTP request.
 * @typedef RequestParams
 * @property {string} url - The endpoint URL for the request.
 * @property {'get' | 'post' | 'put' | 'delete'} method - The HTTP method to be used for the request.
 * @property {string | null} baseURL - The base URL to be used for the request, or null if not applicable.
 * @property {Record<string, string>} headers - An object containing the headers to be sent with the request.
 * @property {Record<string, any>} params - An object containing query parameters to be appended to the URL.
 */
export interface RequestParams {
    url: string
    method: string //'get' | 'post' | 'put' | 'delete',
    baseURL: string | null,
    headers: any,
    params: any
  }
  
/**
 * Represents an instance of the API client.
 * @typedef ApiClientInstance
 * @property {Config} config - The configuration object for the API client.
 * @property {Function} makeRequest - A function to make API requests.
 * @param {RequestParams} req - The parameters for the API request.
 * @returns {Promise<any>} A promise resolving to the response of the API request. Replace 'any' with the proper type for the response if possible.
 */
  export interface ApiClientInstance {
    config: Config;
    makeRequest(req: RequestParams): Promise<any>; // Replace 'any' with the proper type for req if possible.
  }
  

/**
 * Defines the SEO properties for a content item.
 * @interface SEOProperties
 * @property {string} metaDescription - The meta description for the content item.
 * @property {string} metaKeywords - The meta keywords for the content item.
 * @property {string} metaHTML - The meta HTML for the content item.
 * @property {boolean} menuVisible - Whether the content item should be visible in the menu.
 * @property {boolean} sitemapVisible - Whether the content item should be visible in the sitemap.
 */

export interface SEOProperties {
    metaDescription: string;
    metaKeywords: string;
    metaHTML: string;
    menuVisible: boolean;
    sitemapVisible: boolean;
  }

/**
 * Represents the properties of a content item in the Agility CMS system.
 * @typedef ContentItemProperties
 * @memberof AgilityModels
 * @property {number} state - The state of the content item (e.g., published, draft, etc.).
 * @property {Date} modified - The date when the content item was last modified.
 * @property {number} versionID - The version identifier of the content item.
 * @property {string} referenceName - The unique reference name of the content item.
 * @property {string} definitionName - The name of the content definition associated with the content item.
 * @property {number} itemOrder - The order of the content item in a list or collection.
 */
export interface ContentItemProperties {
  state: number
  modified: Date
  versionID: number
  referenceName: string
  definitionName: string
  itemOrder: number
}

/**
 * Defines a **Content Item** in the CMS
 * @typedef ContentItem
 * @memberof AgilityFetch.Types
 * @property {number} contentID - The unique ID of the content item in this language.
 * @property {ContentItemProperties} properties - The system properties of the content item.
 * @property {Object} fields - A dictionary of the fields and the values of the content item.
 * @property {SEOProperties} seo - Any SEO related fields for the content item. This is only returned for Dynamic Page Items.
*/


export interface ContentItem<T = { [key: string]: any }> {
  contentID: number;
  properties: ContentItemProperties;
  fields: T;
  seo?: SEOProperties;
}


/**
 * The GetDynamicPageItem function is used to retrieve the dynamic page item for a given page.
 * 
 * @export
 * @interface getDynamicPageURL
 * @param {int} contentID The contentID of the dynamic page item
 * @param {boolean} preview Whether to use the preview API key
 * @param {string | null} slug The slug of the dynamic page item, optional
 * @param {string | null} locale The locale of the dynamic page item, optional
 * 
 */
export interface IGetDynamicPageURLProps {
  contentID: number;
  preview: boolean;
  slug?: string | null;
  locale?: string | null;
}

/**
 * Represents a node in the Agility CMS sitemap.
 * @typedef AgilitySitemapNode
 * @memberof AgilityFetch.Types
 * 
 * @property {string} title - The title of the page.
 * @property {string} name - The name of the page.
 * @property {number} pageID - The unique identifier for the page.
 * @property {number} menuText - The text displayed in the menu for this page.
 * @property {Object} visible - Defines the visibility of the page.
 * @property {boolean} [visible.menu] - If set to true, this page should be hidden from menus.
 * @property {boolean} [visible.sitemap] - If set to true, this page should be hidden from the sitemap and not accessible by robots.
 * @property {string} path - The URL path of the page.
 * @property {string | null} redirect - The URL to which this page redirects, or null if there is no redirect.
 * @property {boolean} isFolder - Indicates whether this node represents a folder (always false for pages).
 * @property {number} [contentID] - The unique identifier for the content associated with this page, if any.
 */
export interface AgilitySitemapNode {
  title: string
  name: string
  pageID: number
  menuText: number
  visible: { menu?: boolean, sitemap?: boolean },
  path: string
  redirect: string | null
  isFolder: false,
  contentID?: number
}

/**
 * Represents the properties of an Agility CMS page.
 * @typedef AgilityPageProps
 * @property {AgilitySitemapNode} sitemapNode - The sitemap node associated with the page.
 * @property {Page} [page] - The page object containing details about the page.
 * @property {any} [dynamicPageItem] - The dynamic page item, if applicable.
 * @property {string | null} [pageTemplateName] - The name of the page template, or null if not specified.
 * @property {string | null} [languageCode] - The language code of the page, or null if not specified.
 * @property {string | null} [channelName] - The name of the channel, or null if not specified.
 * @property {boolean} [isPreview] - Indicates whether the page is in preview mode.
 * @property {boolean} [isDevelopmentMode] - Indicates whether the page is in development mode.
 * @property {boolean} [notFound] - Indicates whether the page was not found.
 * @property {function(string): ModuleWithInit | null} [getModule] - A function to retrieve a module by its name. Returns the module or null if not found.
 * @property {{ [name: string]: any }} [globalData] - An object containing global data accessible across the page.
 */
export interface AgilityPageProps {
  sitemapNode: AgilitySitemapNode;
  page?: Page;
  dynamicPageItem?: any;
  pageTemplateName?: string | null;
  languageCode?: string | null;
  channelName?: string | null;
  isPreview?: boolean;
  isDevelopmentMode?: boolean;
  notFound?: boolean;
  getModule?(moduleName: string): ModuleWithInit | null;
  globalData?: { [name: string]: any };
}

/**
 * Represents the arguments passed to a custom initialization function.
 * @typedef CustomInitPropsArg
 * @property {any} item - The content item being processed.
 * @property {Page} page - The page object containing details about the current page.
 * @property {ApiClientInstance} agility - The Agility API client instance for interacting with the CMS.
 * @property {string} languageCode - The language code of the current content (e.g., "en-us").
 * @property {string} channelName - The name of the content channel being used.
 * @property {AgilitySitemapNode} sitemapNode - The sitemap node representing the current page in the site structure.
 * @property {any} [dynamicPageItem] - Optional. The dynamic page item, if applicable, for dynamic page rendering.
 */
export interface CustomInitPropsArg {
  item: any;
  page: Page;
  agility: ApiClientInstance;
  languageCode: string;
  channelName: string;
  sitemapNode: AgilitySitemapNode;
  dynamicPageItem?: any;
}

/**
 * Represents the arguments passed to the global custom initialization function.
 * @typedef GlobalCustomInitPropsArg
 * @property {Page} page - The current page object containing details about the page being rendered.
 * @property {ApiClientInstance} agility - The Agility CMS API client instance for interacting with the CMS.
 * @property {string} languageCode - The language code of the current page (e.g., "en-us").
 * @property {string} channelName - The name of the current content channel.
 * @property {AgilitySitemapNode} sitemapNode - The sitemap node representing the current page in the sitemap.
 * @property {any} [dynamicPageItem] - Optional. The dynamic page item data, if the page is a dynamic page.
 */
export interface GlobalCustomInitPropsArg {
  page: Page;
  agility: ApiClientInstance;
  languageCode: string;
  channelName: string;
  sitemapNode: AgilitySitemapNode;
  dynamicPageItem?: any;
}

/**
 * Represents the properties passed to a module in the Agility CMS system.
 * @typedef ModuleProps
 * @template T - The type of the content item associated with the module.
 * @property {Page} page - The page object containing metadata and details about the current page.
 * @property {ContentItem<T>} module - The content item representing the module's data.
 * @property {string} languageCode - The language code of the current page (e.g., "en-us").
 * @property {string} channelName - The name of the channel associated with the current page.
 * @property {AgilitySitemapNode} sitemapNode - The sitemap node representing the current page in the site structure.
 * @property {ContentItem<any>} [dynamicPageItem] - The content item for the dynamic page, if applicable.
 * @property {boolean} isDevelopmentMode - Indicates whether the application is running in development mode.
 * @property {boolean} isPreview - Indicates whether the application is in preview mode.
 * @property {{ [name: string]: any }} [globalData] - An optional object containing global data accessible to the module.
 */
export interface ModuleProps<T> {
  page: Page;
  module: ContentItem<T>;
  languageCode: string;
  channelName: string;
  sitemapNode: AgilitySitemapNode;
  dynamicPageItem?: ContentItem<any>;
  isDevelopmentMode: boolean;
  isPreview: boolean;
  globalData?: { [name: string]: any };
}

/**
 * Represents the properties of an unloaded module in the Agility CMS system.
 * @typedef UnloadedModuleProps
 * @property {Page} page - The page object associated with the module.
 * @property {{ contentid: number }} module - The module object containing its unique content ID.
 * @property {string} languageCode - The language code for the current content (e.g., "en-us").
 * @property {string} channelName - The name of the channel where the module resides.
 * @property {AgilitySitemapNode} sitemapNode - The sitemap node associated with the module.
 * @property {ContentItem<any>} [dynamicPageItem] - The dynamic page item, if applicable, containing content for dynamic pages.
 * @property {boolean} isDevelopmentMode - Indicates whether the application is running in development mode.
 * @property {boolean} isPreview - Indicates whether the application is in preview mode.
 * @property {{ [name: string]: any }} [globalData] - Optional global data object containing additional information.
 */
export interface UnloadedModuleProps {
  page: Page;
  module: { contentid: number };
  languageCode: string;
  channelName: string;
  sitemapNode: AgilitySitemapNode;
  dynamicPageItem?: ContentItem<any>;
  isDevelopmentMode: boolean;
  isPreview: boolean;
  globalData?: { [name: string]: any };
}

/**
 * Represents the properties passed to a dynamic module in the Agility CMS system.
 * @typedef DynamicModuleProps
 * @template T - The type of the module's content item.
 * @template D - The type of the dynamic page's content item.
 * @property {Page} page - The page object containing metadata and details about the current page.
 * @property {ContentItem<T>} module - The content item representing the module being rendered.
 * @property {string} languageCode - The language code of the current page (e.g., "en-us").
 * @property {string} channelName - The name of the channel associated with the current page.
 * @property {AgilitySitemapNode} sitemapNode - The sitemap node representing the current page in the sitemap structure.
 * @property {ContentItem<D>} [dynamicPageItem] - The content item for the dynamic page, if applicable.
 * @property {{ [name: string]: any }} [globalData] - An optional object containing global data accessible to the module.
 */
export interface DynamicModuleProps<T, D> {
  page: Page;
  module: ContentItem<T>;
  languageCode: string;
  channelName: string;
  sitemapNode: AgilitySitemapNode;
  dynamicPageItem?: ContentItem<D>;
  globalData?: { [name: string]: any };
}

/**
 * Represents the properties for initializing a custom module with additional data.
 * 
 * @typedef CustomInitProps
 * @template T - The type of the module's primary data.
 * @template C - The type of the custom data to be included.
 * @extends ModuleProps<T>
 * 
 * @property {C} customData - The custom data to be passed to the module.
 */
export interface CustomInitProps<T, C> extends ModuleProps<T> {
  customData: C;
}



/**
 * Represents a React functional component for an unloaded module.
 * 
 * @typedef UnloadedModule
 * @property {UnloadedModuleProps} props - The properties required by the unloaded module component.
 * 
 * @extends FC
 */
export interface UnloadedModule extends FC<UnloadedModuleProps> { }

/**
 * Represents a module component in the Agility CMS system.
 * 
 * @typedef Module
 * @template TContent - The type of content associated with the module.
 * @memberof AgilityModels
 * @extends FC<ModuleProps<TContent>>
 * 
 * @property {TContent} content - The content data associated with the module.
 * @property {string} moduleName - The name of the module.
 * @property {Record<string, any>} [customFields] - Optional custom fields for the module.
 */
export interface Module<TContent> extends FC<ModuleProps<TContent>> { }

/**
 * Represents a module with dynamic content and dynamic page items.
 * This interface extends a functional component (FC) with properties specific to dynamic modules.
 *
 * @typedef ModuleWithDynamic
 * @template TContent - The type of the content associated with the module.
 * @template TDynamicPageItem - The type of the dynamic page items associated with the module.
 * @memberof AgilityFetch.Types
 * @extends FC<DynamicModuleProps<TContent, TDynamicPageItem>>
 */
export interface ModuleWithDynamic<TContent, TDynamicPageItem>
  extends FC<DynamicModuleProps<TContent, TDynamicPageItem>> { }



/**
 * A component used to render an Agility module that has an additional data access method called getCustomInitialProps
 *
 * @export
 * @interface ModuleWithInit
 * @extends {FC<CustomInitProps<TProps, TInit>>}
 * @template TProps The type of props object that the component expects
 * @template TInit The type of object that will be returned by the getCustomInitialProps method
 */
export interface ModuleWithInit<TProps = {}, TInit = {}>
  extends FC<CustomInitProps<TProps, TInit>> {
  getCustomInitialProps?(props: CustomInitPropsArg): Promise<TInit>;
}

/**
 * A component with an additional data access method called getCustomInitialProps
 *
 * @export
 * @interface ComponentWithInit
 * @extends {FC<TProps>}
 * @template TProps The type of props object that the component expects
 * @template TInit The type of object that will be returned by the getCustomInitialProps method
 */
export interface ComponentWithInit<TInit = {}> extends FC<AgilityPageProps> {
  getCustomInitialProps?(props: GlobalCustomInitPropsArg): Promise<TInit>;
}

/**
 * Represents the properties of a content zone in the Agility CMS system.
 * @typedef ContentZoneProps
 * @property {string} name - The name of the content zone.
 * @property {Page} page - The page object associated with the content zone.
 * @property {AgilitySitemapNode} sitemapNode - The sitemap node associated with the content zone.
 * @property {any} [dynamicPageItem] - The dynamic page item, if applicable.
 * @property {string} languageCode - The language code for the content zone (e.g., "en-us").
 * @property {string} channelName - The name of the channel associated with the content zone.
 * @property {function(string): any} getModule - A function to retrieve a module by its name.
 * @property {boolean} isDevelopmentMode - Indicates whether the system is in development mode.
 * @property {boolean} isPreview - Indicates whether the system is in preview mode.
 * @property {{ [name: string]: any }} [globalData] - Optional global data available for the content zone.
 */
export interface ContentZoneProps {
  name: string;
  page: Page;
  sitemapNode: AgilitySitemapNode;
  dynamicPageItem?: any;
  languageCode: string;
  channelName: string;
  getModule(moduleName: string): any;
  isDevelopmentMode: boolean;
  isPreview: boolean;
  globalData?: { [name: string]: any };
}

/**
 * Represents the properties of an agility model.
 * @typedef Properties
 * @memberof AgilityCLI.Models
 * @property {number} state - The current state of the model.
 * @property {string} modified - The last modified date of the model in ISO 8601 format.
 * @property {number} versionID - The unique identifier for the version of the model.
 * @property {string} referenceName - The reference name of the model.
 * @property {string} definitionName - The definition name of the model.
 * @property {number} itemOrder - The order of the item within the model.
 */
export interface Properties {
  state: number;
  modified: string;
  versionID: number;
  referenceName: string;
  definitionName: string;
  itemOrder: number;
}


/**
 * Represents an image field with metadata.
 * @typedef ImageField
 * @memberof AgilityFetch.Types
 * @property {string} label - The label or name of the image.
 * @property {string} url - The URL of the image.
 * @property {string} target - The target attribute for the image link (e.g., "_blank" for opening in a new tab).
 * @property {number} filesize - The size of the image file in bytes.
 * @property {number} height - The height of the image in pixels.
 * @property {number} width - The width of the image in pixels.
 */
export interface ImageField {
  label: string;
  url: string;
  target: string;
  filesize: number;
  height: number;
  width: number;
}

/**
 * Represents a URL field with associated properties.
 * @typedef URLField
 * @memberof AgilityFetch.Types
 * @property {string} href - The hyperlink reference (URL) of the field.
 * @property {string} target - Specifies where to display the linked URL (e.g., "_blank" for a new tab).
 * @property {string} text - The display text for the hyperlink.
 */
export interface URLField {
  href: string;
  target: string;
  text: string;
}

/**
 * Represents the options for API interactions.
 * @typedef ApiOptions
 * @memberof AgilityFetch.Types
 * @property {Function} [onSitemapRetrieved] - A callback function that is triggered when the sitemap is retrieved.
 * @property {boolean} [expandAllContentLinks] - If set to true, all content links will be expanded.
 * @property {number} [contentLinkDepth] - Specifies the depth to which content links should be expanded.
 */
export interface ApiOptions {
  onSitemapRetrieved?: Function;
  expandAllContentLinks?: boolean;
  contentLinkDepth?: number;
}
