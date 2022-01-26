/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as targz from 'targz';

export function untar(archive: string, extractTo: string, prefix?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (archive.endsWith('.tar.gz')) {
      targz.decompress(
        {
          src: archive,
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
      reject(`Unsupported extension for '${archive}'`);
    }
  });
}
