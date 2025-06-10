import * as mgmtApi from '@agility/management-sdk';

export const createMockModel = (overrides: Partial<mgmtApi.Model> = {}): mgmtApi.Model => ({
  id: 1,
  lastModifiedDate: '2023-01-01T00:00:00Z',
  displayName: 'Test Model',
  referenceName: 'TestModel',
  lastModifiedBy: 'test@example.com',
  lastModifiedAuthorID: 1,
  description: 'A test model',
  allowTagging: true,
  contentDefinitionTypeName: 'Content',
  isPublished: true,
  wasUnpublished: false,
  fields: [
    createMockModelField({ name: 'title', label: 'Title', type: 'Text' }),
    createMockModelField({ name: 'content', label: 'Content', type: 'HTML' }),
    createMockModelField({ name: 'textBlob', label: 'Text Blob', type: 'MultiLineText' }),
  ],
  ...overrides,
});

export const createMockModelField = (
  overrides: Partial<mgmtApi.ModelField> = {}
): mgmtApi.ModelField => ({
  name: 'TestField',
  label: 'Test Field',
  type: 'Text',
  settings: {},
  labelHelpDescription: '',
  itemOrder: 0,
  designerOnly: false,
  isDataField: true,
  editable: true,
  hiddenField: false,
  fieldID: '1',
  description: 'A test field',
  ...overrides,
});

export const createMockContainer = (
  overrides: Partial<mgmtApi.Container> = {}
): mgmtApi.Container => ({
  columns: [],
  contentViewID: 1,
  contentDefinitionID: 1,
  contentDefinitionName: 'TestModel',
  referenceName: 'TestContainer',
  contentViewName: 'Test Container',
  contentDefinitionType: 2,
  requiresApproval: false,
  lastModifiedDate: '2023-01-01T00:00:00Z',
  lastModifiedOn: '2023-01-01T00:00:00Z',
  lastModifiedBy: 'test@example.com',
  isShared: false,
  isDynamicPageList: false,
  disablePublishFromList: false,
  contentViewCategoryID: null,
  contentViewCategoryReferenceName: null,
  contentViewCategoryName: null,
  title: 'Test Container',
  defaultPage: null,
  isPublished: true,
  schemaTitle: 'Test Container',
  allowClientSideSave: false,
  defaultSortColumn: 'Title',
  defaultSortDirection: 'ASC',
  usageCount: 0,
  isDeleted: false,
  enableRSSOutput: false,
  enableAPIOutput: true,
  commentsRecordTypeName: null,
  numRowsInListing: 25,
  contentDefinitionTypeID: 2,
  fullSyncModDate: '2023-01-01T00:00:00Z',
  confirmSharingOnPublish: false,
  contentTemplateName: null,
  currentUserCanDelete: true,
  currentUserCanEdit: true,
  currentUserCanDesign: true,
  currentUserCanManage: true,
  currentUserCanContribute: true,
  currentUserCanPublish: true,
  defaultListingPage: null,
  defaultDetailsPage: null,
  defaultDetailsPageQueryString: '',
  isListItem: false,
  ...overrides,
});

export const createMockContentViewColumn = (
  overrides: Partial<mgmtApi.ContentViewColumn> = {}
): mgmtApi.ContentViewColumn => ({
  fieldName: 'TestField',
  label: 'Test Field',
  sortOrder: 1,
  isDefaultSort: false,
  sortDirection: 'ASC',
  typeName: 'Text',
  ...overrides,
});
