import _ from 'lodash';

import configFromFile from '../config/config.json';
// import { ensureFolder, writeJSONFile } from "./myLib/myFileUtils.js";
import { log } from "./myLibOld/myLogger.js";

const path = require('path');

export function getConfig(collectionId, args) {
  const baseConfig = {
    ...configFromFile,
    collectionId,
    args,
    // dataFolder: ensureFolder(path.resolve(__dirname, '../data'))
  };

  if (!collectionId) {
    return baseConfig;
  }

  if (!baseConfig.projects[collectionId]) {
    log.error(`Collection id ${collectionId} does not exist! Program will exit!`);
    process.exit(-1);
  }

  const config = {
    ...baseConfig,
    ...baseConfig.projects[collectionId],
    // projectFolder: ensureFolder(path.resolve(__dirname, `../data/collections/${collectionId}`))
  };

  const maxSupply = config.supply[0];
  config.maxSupply = maxSupply;
  config.firstTokenId = config.supply[1] ?? 0;
  config.lastTokenId = config.supply[2] ?? maxSupply;

  config.debug = () => debugToFile(config);

  return config;
}

export function debugToFile(config) {
  const filename = `config-${Date.now()}.json`;
  const filepath = config.projectFolder ? `${config.projectFolder}/${filename}` : `${config.dataFolder}/${filename}`;
  // writeJSONFile(filepath, { debug: config });
}

