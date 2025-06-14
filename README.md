# Agility CLI

## About the Agility CLI

- Provides a facility to developers to use the new Agility Management API more effectively.
- Provides features to perform operations to login to agility instance, pull the instance, push the instance and clone the instance (coupling of push and pull operations).
- Provides logs on failed records for content and pages.
- Ability to generate Content and Pages in bulk for a Website.
- Deleted Content, Pages, Models, Containers and Assets were not processed from the CLI.

## Getting Started

### Installation
#### Using npm
1. To install the cli locally using npm, open terminal and type: ```npm i @agility/cli```.
2. For global installation using npm, open terminal and type: ```npm i @agility/cli -g```.

#### Using yarn
1. To install the cli locally using yarn, open terminal and type: ```yarn add @agility/cli```.
2. For global installation using yarn, open terminal and type: ```yarn global add @agility/cli```.

### Using the CLI
#### Authenticate first
1. Login to agility instance using command ```agility login```.
2. A browser window will appear to perform the authentication process. You may have to authorize before proceeding.
3. Once authenticated use the following steps to perform operations on your instance.
4. You should be a Org Admin, Instance Admin or have a Manager Role in an instance to perform operations in the CLI. 

#### Performing operations on CLI
1. To pull an instance use the command ```agility pull --guid="<<Provide Guid of your Instance>>" --locale="<<Provide the locale of the Instance>>" --channel="<<Provide the channel to be pulled>>" --baseUrl="<<Optional Parameter to provide the base URL if the pull operation doesn't work. Refer the section "Base URL's".>>"``` to pull an instance.
2. To push an instance use the command ```agility push --guid="<<Provide the target Instance guid>> --locale="<<Provide the locale of the Instance>>"```
3. For instance cloning, this command is a mix of push and pull. Use the command ```agility clone --sourceGuid="<<Provide Guid of your source Instance>>" --targetGuid="<<Provide the target Instance guid>>" --locale="<<Provide the locale of the Instance>>" --channel="<<Provide the channel to be cloned>>"``` to perform cloning between instances.
4. To sync Models use the command ```agility sync-models --sourceGuid="<<Optional Parameter Guid of your source instance>>" --targetGuid="<<Optional Parameter Guid of your target Instance>>" --pull="<<Optional Parameter value true/false>>" --dryRun="<<Optional Parameter value true/false>>" --filter="<<Optional Parameter folder path where filter file is present. Ex: - C:\Agility\filterModels.json" --folder="<<Optional Parameter name of the folder where files to be exported. If no value is provided, files will be exported to .agility-files folder>>"```.
5. To update content in an instance - ```agility updatecontent --guid="<<Provide the target instance guid>>" --locale="<<Provide the locale of the Instance>>" --contentItems="<<The ID's of the content items you want to update>>"```

Note: To update content in an instance, you need to make sure your local ID's match the target instance ID's. If you just pushed your instance to another instance, you may need to pull down the target instance so data and ID's matches correctly. 

6. To publish content in an instance - ```agility publishcontent --guid="<<Provide the target instance guid>>" --locale="<<Provide the locale of the Instance>>" --contentItems="<<The ID's of the content items you want to update>>"```

7. To access the error logs, navigate to .agility-files/logs/instancelog.txt

#### Model Sync File samples
1. To generate the filter file, use the following JSON format for models and templates: -
```json
{
	"Models": ["MyModel"],//referenceName of the models.
	"Templates": ["My Template"] //Template name of the templates.
}
```
2. Following is the format of the file generated for the dry run process: - 
```json
{
  "ModelReferenceName": {
    "result":{
      "added":{
      },
      "updated":{
      }
    },
    "TemplateName":{
      "result":{
        "added":{
        },
        "updated":{
        }
      }
    }
  }
}
//If a model or template is not present in the target instance, then: - 
{
  referenceName: 'Model with ModelReferenceName will be added.',
  templateName: 'Model with TemplateName will be added.'
}
```
The file is generated at ```<Folder Name>\models-sync\modelsDryRun.json``` (where Folder Name is ```.agility-files``` or the value provided inside the folder parameter).

#### Model Sync Sample commands
1. ```agility model-sync --sourceGuid="abc" --targetGuid="def"```- To Sync everything.
2. ```agility model-sync --sourceGuid="abc" --targetGuid="def" --filter="C:\myFilter.json"``` - Perform Sync operation on a filter.
3. ```agility model-sync --sourceGuid="abc" --folder="models" --pull=true``` - To perform pull operation on a folder models.
4. ```agility model-sync --targetGuid="def" --folder="models"``` - To perform push operation from folder models.
5. ```agility model-sync --targetGuid="def" --folder="models" filter="C:\myFilter.json"``` - To perform push operation on a filter using source folder models.
6. ```agility model-sync --sourceGuid="abc" --targetGuid="def" --dryRun=true``` - To perform Dry Run operation.

#### Folder Structure
1. If a pull or clone instance is initiated, a local folder .agility-files is created.
2. Assets are saved inside the assets folder which consists of a json folder which has the metadata of the assets downloaded. The folder structure is .agility-files/assets/json for metadata. Rest assets are present inside the assets folder.
3. Galleries are saved inside the .agility-files/assets/galleries in a json format which is the metadata of the galleries of your source instance.
4. Containers metadata is present inside .agility-files/containers folder.
5. For example, if the locale is en-us, then the Pages and Content metadata is present inside the folder .agility-files/en-us/item for Content and  .agility-files/en-us/pages. These are the base folders to create Content and Pages to perform CLI push/clone. There are other folders created i.e. list, nestedsitemap, page, sitemap, state and urlredirections, which are not used by the CLI but are part of pull operation.
6. Models metadata is present inside .agility-files/models folder.
7. Templates metadata is present inside .agility-files/templates folder.
#### Base URL's
In some cases when the pull operation fails to fetch the preview key, you need to override the baseUrl for the CLI to perform the pull operation. Following is the list of Base URL's for different locations. Depeneding on the location of the instance use the Base URL value for the pull operation:

1. USA: https://mgmt.aglty.io
2. Canada: https://mgmt-ca.aglty.io
3. Europe: https://mgmt-eu.aglty.io
4. Australia: https://mgmt-aus.aglty.io

## Resources

### Agility CMS

- [Official site](https://agilitycms.com)
- [Documentation](https://help.agilitycms.com/hc/en-us)

### Community

- [Official Slack](https://join.slack.com/t/agilitycommunity/shared_invite/enQtNzI2NDc3MzU4Njc2LWI2OTNjZTI3ZGY1NWRiNTYzNmEyNmI0MGZlZTRkYzI3NmRjNzkxYmI5YTZjNTg2ZTk4NGUzNjg5NzY3OWViZGI)
- [Blog](https://agilitycms.com/resources/posts)
- [GitHub](https://github.com/agility)
- [Forums](https://help.agilitycms.com/hc/en-us/community/topics)
- [Facebook](https://www.facebook.com/AgilityCMS/)
- [Twitter](https://twitter.com/AgilityCMS)

## Feedback and Questions

If you have feedback or questions about this starter, please use the [Github Issues](https://github.com/agility/agility-cms-management-cli/issues) on this repo, join our [Community Slack Channel](https://join.slack.com/t/agilitycommunity/shared_invite/enQtNzI2NDc3MzU4Njc2LWI2OTNjZTI3ZGY1NWRiNTYzNmEyNmI0MGZlZTRkYzI3NmRjNzkxYmI5YTZjNTg2ZTk4NGUzNjg5NzY3OWViZGI) or create a post on the [Agility Developer Community](https://help.agilitycms.com/hc/en-us/community/topics).