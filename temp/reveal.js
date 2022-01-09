import _ from 'lodash';

import * as tokenlib from "./token.js";

// EXPORTED

export async function revealCollection(revealTokenIds, contractAddress, unrevealedImage) {
  return getRevealedToken(revealTokenIds, contractAddress, unrevealedImage);
}

// INTERNAL

export async function getRevealedToken(revealTokenIds, contractAddress, unrevealedImage) {
  console.log(revealTokenIds, contractAddress, unrevealedImage);
  const maybeRevealedTokens = [];

  for (const tokenId of revealTokenIds) {
    const token = await tokenlib.fetchTokenById(tokenId, contractAddress);
    const revealStatus = await getRevealStatus(token, unrevealedImage);
    if (revealStatus === 'REVEALED') {
      return token;
    } else if (revealStatus === 'MAYBE_REVEALED') {
      // Push token and later analyze all tokens to see if collection is revealed!
      maybeRevealedTokens.push(token);
    }
  }

  if (maybeRevealedTokens.length > 1) {
    const imageURIs = maybeRevealedTokens.map(obj => obj.image);
    const uniqueURIs = [...new Set(imageURIs)];
    if (uniqueURIs.length < 2) {
      // If all token images are same, token is NOT revealed!
      return null;
    } else {
      // If token images are unique, token is revealed!
      return maybeRevealedTokens[0];
    }
  }

  // Token is NOT revealed!
  return null;
}

export async function getRevealStatus(token, unrevealedImage = null) {
  if (!token || _.isEmpty(token) || !token.attributes || token.attributes.length < 1 || _.isEmpty(token.attributes)) {
    return 'NOT_REVEALED';
  }

  if (unrevealedImage && token.image && unrevealedImage === token.image) {
    return 'NOT_REVEALED';
  }

  if (!isIterable(token.attributes)) {
    return 'NOT_REVEALED';
  }

  let numTraits = 0;
  const valueMap = new Map();
  for (let attr of token.attributes) {
    if (attr.trait_type) {
      if (attr.display_type) {
        // Dont count other types than normal (string) traits!
        continue;
      }
      numTraits++;
      valueMap.set(attr.value, true);
    }
  }

  if (numTraits > 1 && valueMap.size === 1) {
    // All traits have same value => not revealed!
    return 'NOT_REVEALED';
  }

  if (numTraits > 1) {
    return 'REVEALED';
  }

  if (numTraits === 1) {
    // Might be revealed! Need to check if image property is valid by comparing with other tokens.
    return 'MAYBE_REVEALED';
  }

  return 'NOT_REVEALED';
}

// INTERNAL FUNCTIONS

function isIterable(obj) {
  return !(obj == null || typeof obj[Symbol.iterator] !== 'function');
}

