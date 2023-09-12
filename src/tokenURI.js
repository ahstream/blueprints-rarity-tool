/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

import { log } from './hlib/logger.js';
import { countWord, replaceLastOccurrenceOf } from './myLib/myUtils.js';
import * as web3 from './myLib/myWeb3.js';

const IPFS_URL = 'ipfs://';

// MAIN FUNCTIONS ----------------------------------------------------------------------------------

export async function getTokenURI(tokenId, contractAddress) {
  return getTokenURIByContract(tokenId, contractAddress);
}

export async function getTokenURIByContract(tokenId, contractAddress) {
  const result = await web3.getTokenURIFromContract(tokenId, contractAddress);
  if (result.uri) {
    return { uri: normalizeURI(result.uri) };
  }
  return result;
}

export function createTokenURI(tokenId, baseTokenURI) {
  if (typeof baseTokenURI !== 'string') {
    return '';
  }
  return baseTokenURI.replace('{ID}', tokenId);
}

export function createBaseTokenURI(tokenId, tokenURI) {
  try {
    if (tokenURI === '' || typeof tokenURI !== 'string') {
      return '';
    }
    const idString = tokenId.toString();
    const count = countWord(tokenURI, idString);
    if (count === 1) {
      return tokenURI.replace(idString, '{ID}');
    }
    if (count > 1) {
      return replaceLastOccurrenceOf(tokenURI, idString, '{ID}');
    }
    log.debug('Invalid conversion to baseTokenURI:', tokenId, tokenURI);
    return '';
  } catch (error) {
    log.error('Error inconvertToBaseTokenURI:', error);
    return '';
  }
}

export function normalizeURI(uri) {
  if (typeof uri !== 'string') {
    return uri;
  }
  let normalizedURI = uri;
  if (uri && uri.startsWith(IPFS_URL)) {
    normalizedURI = uri.replace(IPFS_URL, 'https://ipfs.io/ipfs/');
  }
  if (uri && uri.startsWith('Qm')) {
    normalizedURI = 'https://ipfs.io/ipfs/' + uri;
  }
  return normalizedURI;
}
