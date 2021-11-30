/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/no-var-requires */

const mkdirp = require('mkdirp');
const path = require('path');
const fs = require('fs-extra');
const hasha = require('hasha');
const request = require('request');
const progress = require('request-progress');
const targz = require('targz');
const Archive = require('./archive').Archive;

const configData = require('../src/tools.json');

/*eslint-env node*/

function downloadFile(fromUrl, toFile, progressCallBack, throttle) {
  return new Promise((resolve, reject) => {
    let previous = 0;
    progress(request(fromUrl), {
      throttle: throttle || 250,
      delay: 0,
      lengthHeader: 'content-length',
    })
      .on('progress', (state) => {
        const current = Math.round(state.percent * 100);
        current !== previous && progressCallBack && progressCallBack(current, current - previous);
        previous = current;
      })
      .on('error', reject)
      .on('end', () => progressCallBack && progressCallBack(100, 100 - previous))
      .pipe(fs.createWriteStream(toFile))
      .on('close', resolve)
      .on('error', reject);
  });
}

async function isDownloadRequired(filePath, sha256) {
  let result = true;
  if (fs.existsSync(filePath)) {
    const fileSha256 = await hasha.fromFile(filePath, { algorithm: 'sha256' });
    result = fileSha256 !== sha256;
  }
  return result;
}

function extract(zipFile, extractTo, prefix) {
  return new Promise((resolve, reject) => {
    if (zipFile.endsWith('.tar.gz')) {
      targz.decompress(
        {
          src: zipFile,
          dest: extractTo,
          tar: {
            map: (header) => {
              prefix && header.name.startsWith(prefix) ? (header.name = header.name.substring(prefix.length)) : header;
              return header;
            },
          },
        },
        (err) => {
          err ? reject(err) : resolve();
        }
      );
    } else {
      reject('Unknown archive type:' + zipFile);
    }

    // resolve();
  });
}

async function downloadFileAndCreateSha256(toolsCacheFolder, toolsFolder, platform) {
  mkdirp.sync(toolsCacheFolder);
  mkdirp.sync(toolsFolder);
  const currentFile = path.join(toolsCacheFolder, platform.dlFileName);
  if (await isDownloadRequired(currentFile, platform.sha256sum)) {
    console.log(`Downloading ${platform.url} to ${currentFile}`);
    await downloadFile(platform.url, currentFile, (current) => console.log(`${current}%`));
    const currentSHA256 = await hasha.fromFile(currentFile, { algorithm: 'sha256' });
    if (currentSHA256 === platform.sha256sum) {
      console.log(`Download of ${currentFile} has finished and SHA256 is correct`);
    } else {
      throw Error(`${currentFile} is downloaded and SHA256 is not correct`);
    }
  } else {
    console.log('Previously downloaded archive SHA256 is correct');
  }
  console.log(`Extracting ${currentFile} to ${path.join(toolsFolder, platform.cmdFileName)}`);
  // this is temp workaround for tar.gz content issue https://github.com/openshift/odo/issues/3668
  if (!currentFile.endsWith('.exe') && currentFile.includes('.')) {
    await Archive.unzip(currentFile, toolsFolder, platform.cmdFileName, platform.filePrefix);
  } else {
    fs.copyFileSync(currentFile, path.join(toolsFolder, platform.cmdFileName));
  }
}

async function bundleTools() {
  const outFolder = path.resolve('.', 'out');
  const toolsCacheFolder = path.join(outFolder, 'tools-cache');
  let currentPlatform = process.env.TARGET;
  if (!currentPlatform) {
    currentPlatform = process.argv.find((arg) => arg === '--platform') ? process.platform : 'all';
  }
  console.log(currentPlatform);
  console.info(`Download tools to '${toolsCacheFolder}'`);
  for (const key in configData) {
    const tool = configData[key];
    for (const OS in tool.platform) {
      if (currentPlatform === 'all' || OS === currentPlatform) {
        console.log(`Bundle '${tool.description}' for ${OS}`);
        const osSpecificLocation = path.join(outFolder, 'tools', OS);
        await downloadFileAndCreateSha256(toolsCacheFolder, osSpecificLocation, tool.platform[OS]);
        fs.chmodSync(path.join(osSpecificLocation, tool.platform[OS].cmdFileName), 0o765);
      }
    }
  }
}

bundleTools().catch((error) => {
  console.error(error);

  process.exit(1);
});
