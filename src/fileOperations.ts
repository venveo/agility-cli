import * as fs from 'fs';
import * as Https from 'https';
const os = require('os');
os.tmpDir = os.tmpdir;

export class fileOperations {
  exportFiles(folder: string, fileIdentifier: any, extractedObject: any, baseFolder?: string) {
    if (baseFolder === undefined || baseFolder === '') {
      baseFolder = '.agility-files';
    }
    if (!fs.existsSync(`${baseFolder}/${folder}`)) {
      fs.mkdirSync(`${baseFolder}/${folder}`);
    }
    const fileName = `${baseFolder}/${folder}/${fileIdentifier}.json`;
    fs.writeFileSync(fileName, JSON.stringify(extractedObject));
  }

  appendFiles(folder: string, fileIdentifier: any, extractedObject: any) {
    if (!fs.existsSync(`.agility-files/${folder}`)) {
      fs.mkdirSync(`.agility-files/${folder}`);
    }

    const fileName = `.agility-files/${folder}/${fileIdentifier}.json`;
    fs.appendFileSync(fileName, JSON.stringify(extractedObject));
  }

  createLogFile(folder: string, fileIdentifier: any, baseFolder?: string) {
    if (baseFolder === undefined || baseFolder === '') {
      baseFolder = `.agility-files`;
    }
    if (!fs.existsSync(`${baseFolder}/${folder}`)) {
      fs.mkdirSync(`${baseFolder}/${folder}`);
    }
    const fileName = `${baseFolder}/${folder}/${fileIdentifier}.txt`;
    fs.closeSync(fs.openSync(fileName, 'w'));
  }

  appendLogFile(data: string) {
    const fileName = `.agility-files/logs/instancelog.txt`;
    fs.appendFileSync(fileName, data);
  }

  createFolder(folder: string) {
    if (!fs.existsSync(`.agility-files/${folder}`)) {
      fs.mkdirSync(`.agility-files/${folder}`, { recursive: true });
    }
  }

  createBaseFolder(folder?: string) {
    if (folder === undefined || folder === '') {
      folder = `.agility-files`;
    }
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder);
    }
  }

  checkBaseFolderExists(folder: string) {
    if (!fs.existsSync(folder)) {
      return false;
    }
    return true;
  }

  async downloadFile(url: string, targetFile: string) {
    return await new Promise((resolve, reject) => {
      Https.get(url, response => {
        const code = response.statusCode ?? 0;

        if (code >= 400) {
          return reject(new Error(response.statusMessage));
        }

        if (code > 300 && code < 400 && !!response.headers.location) {
          return resolve(this.downloadFile(response.headers.location, targetFile));
        }

        const fileWriter = fs.createWriteStream(targetFile).on('finish', () => {
          resolve({});
        });

        response.pipe(fileWriter);
      }).on('error', error => {
        reject(error);
      });
    });
  }

  createFile(filename: string, content: string) {
    fs.writeFileSync(filename, content);
  }

  readFile(fileName: string) {
    const file = fs.readFileSync(fileName, 'utf-8');
    return file;
  }

  checkFileExists(filePath: string): boolean {
    try {
      fs.accessSync(filePath, fs.constants.F_OK);
      return true;
    } catch (err) {
      return false;
    }
  }

  deleteFile(fileName: string) {
    fs.unlinkSync(fileName);
  }

  readTempFile(fileName: string) {
    const appName = 'mgmt-cli-code';
    const tmpFolder = os.tmpDir();
    const tmpDir = `${tmpFolder}/${appName}`;
    const fileData = this.readFile(`${tmpDir}/${fileName}`);
    return fileData;
  }

  createTempFile(fileName: string, content: string) {
    const appName = 'mgmt-cli-code';
    const tmpFolder = os.tmpDir();
    const tmpDir = `${tmpFolder}/${appName}`;
    fs.access(tmpDir, error => {
      if (error) {
        fs.mkdirSync(tmpDir);
        this.createFile(`${tmpDir}/${fileName}`, content);
      } else {
        this.createFile(`${tmpDir}/${fileName}`, content);
      }
    });
    return tmpDir;
  }

  renameFile(oldFile: string, newFile: string) {
    fs.renameSync(oldFile, newFile);
  }

  readDirectory(folderName: string, baseFolder?: string) {
    if (baseFolder === undefined || baseFolder === '') {
      baseFolder = '.agility-files';
    }
    const directory = `${baseFolder}/${folderName}`;
    const files: string[] = [];
    fs.readdirSync(directory).forEach(file => {
      const readFile = this.readFile(`${directory}/${file}`);
      files.push(readFile);
    });

    return files;
  }

  folderExists(folderName: string, baseFolder?: string) {
    if (baseFolder === undefined || baseFolder === '') {
      baseFolder = '.agility-files';
    }
    const directory = `${baseFolder}/${folderName}`;
    if (fs.existsSync(directory)) {
      return true;
    } else {
      return false;
    }
  }

  codeFileExists() {
    const appName = 'mgmt-cli-code';
    const tmpFolder = os.tmpDir();
    const tmpDir = `${tmpFolder}/${appName}/code.json`;
    if (fs.existsSync(tmpDir)) {
      return true;
    } else {
      return false;
    }
  }

  fileExists(path: string) {
    if (fs.existsSync(path)) {
      return true;
    }
    return false;
  }

  cleanup(path: string) {
    if (fs.existsSync(path)) {
      fs.readdirSync(path).forEach(file => {
        const curPath = `${path}/${file}`;
        if (fs.lstatSync(curPath).isDirectory()) {
          this.cleanup(curPath);
        } else {
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(path);
    }
  }

  cliFolderExists() {
    if (fs.existsSync('.agility-files')) {
      return true;
    } else {
      return false;
    }
  }
}
