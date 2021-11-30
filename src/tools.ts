/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Platform } from './util/platform';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as semver from 'semver';
import { which } from 'shelljs';

import configData = require('./tools.json');
import { cli } from './cli';

interface ToolDef {
  description: string;
  vendor: string;
  name: string;
  version: string;
  versionRange: string;
  versionRangeLabel: string;
  dlFileName: string;
  cmdFileName: string;
  filePrefix: string;
  location: Promise<string | undefined>;
  platform: {
    [key: string]: {
      url: string;
      sha256sum: string;
      dlFileName: string;
      cmdFileName: string;
    };
  };
}
interface ToolsMap {
  [cliName: string]: ToolDef;
}
function loadMetadata(requirements: object): ToolsMap {
  const req = JSON.parse(JSON.stringify(requirements));
  const osFamily = Platform.OS;
  for (const object in requirements) {
    if (req[object].platform) {
      if (req[object].platform[osFamily]) {
        Object.assign(req[object], req[object].platform[osFamily]);
        delete req[object].platform;
      } else {
        delete req[object];
      }
    }
  }
  return req;
}

const tools: ToolsMap = loadMetadata(configData);

export async function detectCli(cliName: string): Promise<string | undefined> {
  if (tools[cliName].location === undefined) {
    const toolCacheLocation = path.resolve(__dirname, '..', 'tools', Platform.OS, tools[cliName].cmdFileName);
    const toolLocations: string[] = [toolCacheLocation];

    const whichLocation = which(cliName);
    toolLocations.unshift(whichLocation && whichLocation.stdout);

    tools[cliName].location = selectTool(toolLocations, tools[cliName].versionRange).then((location) => {
      if (location && Platform.OS !== 'win32') {
        fs.chmodSync(location, 0o765);
      }
      return location;
    });
  }
  return tools[cliName].location;
}

async function selectTool(locations: string[], versionRange: string): Promise<string | undefined> {
  let result: string | undefined = undefined;
  for (const location of locations) {
    // eslint-disable-next-line no-await-in-loop
    if (location && semver.satisfies((await getVersion(location)) ?? '', versionRange)) {
      result = location;
      break;
    }
  }
  return result;
}

async function getVersion(location: string): Promise<string | undefined> {
  let detectedVersion: string | undefined = undefined;
  if (fs.existsSync(location)) {
    const result = await cli.execute(`"${location}"`, ['version', '--short']);
    if (result.stdout) {
      const versionRegExp = /.*([0-9]+\.[0-9]+\.[0-9]+).*/;
      const toolVersion: string[] = result.stdout
        .trim()
        .split('\n')
        .filter((value) => {
          return versionRegExp.test(value);
        })
        .map((value) => {
          const res = versionRegExp.exec(value);
          if (res) {
            return res[1];
          }
          return '';
        });
      if (toolVersion.length) {
        [detectedVersion] = toolVersion;
      }
    }
  }
  return detectedVersion;
}
