/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

import * as opensea from './opensea.js';
import { EVENTS_LIMIT } from './opensea.js';

const API_KEY = '34d2961db6c14d319ab19ffc818c8b1b';
const DEFAULT_RETRY_FOR_SEC = 60;
const DEFAULT_RETRY_INTERVAL_MS = 1000;

// INTERFACE FUNCTIONS

export async function getCollectionStats(slug, requestOptions = {}) {
  return await getCollectionStatsWithRetry(slug, requestOptions, null, null);
}

export async function getCollectionStatsWithRetry(slug, requestOptions = {}, retryFor = DEFAULT_RETRY_FOR_SEC, retryInterval = DEFAULT_RETRY_INTERVAL_MS) {
  return await opensea.getCollectionStats(API_KEY, slug, requestOptions, retryFor, retryInterval);
}

export async function getContract(contractAddress, requestOptions = {}) {
  return getContractWithRetry(contractAddress, requestOptions, null, null);
}

export async function getContractWithRetry(contractAddress, requestOptions = {}, retryFor = DEFAULT_RETRY_FOR_SEC, retryInterval = DEFAULT_RETRY_INTERVAL_MS) {
  return opensea.getContract(API_KEY, contractAddress, requestOptions, retryFor, retryInterval);
}

export async function getAsset(contractAddress, tokenId, options = {}, requestOptions = {}) {
  return getAssetWithRetry(contractAddress, tokenId, options, requestOptions, null, null);
}

export async function getAssetWithRetry(contractAddress, tokenId, options = {}, requestOptions = {}, retryFor = DEFAULT_RETRY_FOR_SEC, retryInterval = DEFAULT_RETRY_INTERVAL_MS) {
  return opensea.getAsset(API_KEY, contractAddress, tokenId, options, requestOptions, retryFor, retryInterval);
}

export async function getAssets(contractAddress, options = {}, requestOptions = {}) {
  return getAssetsWithRetry(contractAddress, options, requestOptions, null, null);
}

export async function getAssetsWithRetry(contractAddress, options = {}, requestOptions = {}, retryFor = DEFAULT_RETRY_FOR_SEC, retryInterval = DEFAULT_RETRY_INTERVAL_MS) {
  return opensea.getAssets(API_KEY, contractAddress, options, requestOptions, retryFor, retryInterval);
}

export async function getEvents(contractAddress, options = {}, requestOptions = {}) {
  return getEventsWithRetry(contractAddress, options, requestOptions, null, null);
}

export async function getEventsWithRetry(contractAddress, options = {}, requestOptions = {}, retryFor = DEFAULT_RETRY_FOR_SEC, retryInterval = DEFAULT_RETRY_INTERVAL_MS) {
  return opensea.getEvents(API_KEY, contractAddress, options, requestOptions, retryFor, retryInterval);
}

// MAIN FUNCTIONS

export async function getAssetsBlock(contractAddress, blockSize, fromOffset = 0, options = {}, requestOptions = {}) {
  return getAssetsBlockWithRetry(contractAddress, blockSize, fromOffset, options, requestOptions, null, null);
}

export async function getAssetsBlockWithRetry(contractAddress, blockSize, fromOffset = 0, options = {}, requestOptions = {}, retryFor = DEFAULT_RETRY_FOR_SEC, retryInterval = DEFAULT_RETRY_INTERVAL_MS) {
  const assets = [];
  let numToFetch = blockSize;
  let offset = fromOffset;

  while (numToFetch > 0) {
    console.log(`Assets left to get: ${numToFetch}`);
    const limit = numToFetch > opensea.ASSETS_LIMIT ? opensea.ASSETS_LIMIT : numToFetch;
    const assetsBatch = await opensea.getAssets(API_KEY, contractAddress, {
      ...options,
      limit,
      offset
    }, requestOptions, retryFor, retryInterval);
    if (assetsBatch.error) {
      return assetsBatch;
    }
    assets.push(assetsBatch);
    numToFetch = numToFetch - assetsBatch.length;
    offset = offset + assetsBatch.length;
  }
  return assets.flat();
}

export async function getEventBlock(contractAddress, blockSize, fromOffset = 0, options = {}, requestOptions = {}) {
  return getEventBlockWithRetry(contractAddress, blockSize, fromOffset, options, requestOptions, null, null);
}

export async function getEventBlockWithRetry(contractAddress, blockSize = EVENTS_LIMIT, fromOffset = 0, options = {}, requestOptions = {}, retryFor = DEFAULT_RETRY_FOR_SEC, retryInterval = DEFAULT_RETRY_INTERVAL_MS) {
  const events = [];
  let offset = fromOffset;

  while (true) {
    console.log(`Get ${blockSize} events from offset: ${offset}`);
    const eventBatch = await opensea.getEvents(API_KEY, contractAddress, {
      ...options,
      limit: blockSize,
      offset
    }, requestOptions, retryFor, retryInterval);
    if (eventBatch.error) {
      return eventBatch;
    }
    if (eventBatch?.length === 0) {
      break;
    }
    events.push(eventBatch);
    offset = offset + eventBatch.length;
  }

  return events.flat();
}

export async function getCollectionFloor(slug, requestOptions = {}) {
  return getCollectionFloorWithRetry(slug, requestOptions, null, null);
}

export async function getCollectionFloorWithRetry(slug, requestOptions = {}, retryFor = DEFAULT_RETRY_FOR_SEC, retryInterval = DEFAULT_RETRY_INTERVAL_MS) {
  let data = await getCollectionStats(slug, requestOptions, retryFor, retryInterval);
  return data.error || !data.stats.floor_price ? null : data.stats.floor_price;
}
