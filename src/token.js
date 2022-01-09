import _ from 'lodash';

import { log } from './myLibOld/myLogger.js';
import { get } from './myLibOld/myWeb2.js';
import { getTokenURI } from './tokenURI.js';

// EXPORTED

export async function fetchTokenById(tokenId, contractAddress) {
  console.log(tokenId, contractAddress);
  const result = await getTokenURI(tokenId, contractAddress);
  if (result.error) {
    return result;
  }
  return await fetchTokenByURI(tokenId, result.uri);
}

// INTERNAL FUNCTIONS

async function fetchTokenByURI(tokenId, tokenURI) {
  try {
    const tokenData = await get(tokenURI, {});
    if (tokenData.error) {
      return tokenData;
    }
    return {
      tokenId: tokenId.toString(),
      tokenIdSortKey: Number(tokenId),
      tokenURI,
      ...tokenData.data
    };
  } catch (error) {
    log.error('Error in fetchTokenByURI:', error);
    return { tokenId, tokenURI, error };
  }
}

