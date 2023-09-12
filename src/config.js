import _ from 'lodash';

const { join } = require('path');
import {
  ensureFolder,
  writeJSONFile
} from './hlib/fileutils.js';

export function convertConfig(baseConfig) {
  const config = {
    ...baseConfig,
    dataFolder: ensureFolder(toAbsFilepath(`../data`)),
    projectFolder: ensureFolder(toAbsFilepath(`../data/collections/${baseConfig.collectionId}`))
  };

  let maxSupply, firstTokenId, lastTokenId;
  switch (config.supply.length) {
    case 1:
      maxSupply = config.supply[0];
      firstTokenId = 0;
      lastTokenId = maxSupply;
      break;
    case 2:
      firstTokenId = config.supply[0];
      lastTokenId = config.supply[1];
      maxSupply = lastTokenId - firstTokenId + 1;
      break;
    case 3:
      maxSupply = config.supply[0];
      firstTokenId = config.supply[1];
      lastTokenId = config.supply[2];
      break;
    default:
      throw new Error(`Invalid config supply property: ${config.supply}`);
  }

  config.maxSupply = maxSupply;
  config.firstTokenId = firstTokenId;
  config.lastTokenId = lastTokenId;

  config.debug = () => debugToFile(config);

  return config;
}

export function debugToFile(config) {
  const filename = `config-${Date.now()}.json`;
  const filepath = config.projectFolder ? `${config.projectFolder}/${filename}` : `${config.dataFolder}${filename}`;
  writeJSONFile(filepath, { debug: config });
}

function toAbsFilepath(path) {
  return join(__dirname, path);
}

