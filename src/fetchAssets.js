import _ from 'lodash';

import * as opensea from './hlib/opensea.js';
import { log } from './hlib/logger.js';
import * as myURIFetcher from './myLib/myURIFetcher.js';
import { delay, parseRetryAfterSecs, range } from './myLib/myUtils.js';

const FETCH_ASSETS_MAX_CONCURRENT = Infinity;
const FETCH_ASSETS_TIMEOUT = 8000;
const FETCH_ASSETS_BATCH_DELAY = 100;
const FETCH_ASSETS_STANDARD_DELAY = 1000;
const FETCH_ASSETS_TIMEOUT_DELAY = 1000;
const FETCH_ASSETS_RETRY_FOR_SECONDS = null;

export async function fetch(contractAddress, fromTokenId, toTokenId, context, fetchOptions = {}) {
  log.info('Fetch assets:', contractAddress, fromTokenId, toTokenId);

  const newFetchOptions = {
    maxConcurrent: fetchOptions.fetchAssetsMaxConcurrent ?? FETCH_ASSETS_MAX_CONCURRENT,
    timeout: fetchOptions.fetchAssetsTimeout ?? FETCH_ASSETS_TIMEOUT,
    batchDelay: fetchOptions.fetchAssetsBatchDelay ?? FETCH_ASSETS_BATCH_DELAY,
    standardDelay: fetchOptions.fetchAssetsStandardDelay ?? FETCH_ASSETS_STANDARD_DELAY,
    timeoutDelay: fetchOptions.fetchAssetsTimeoutDelay ?? FETCH_ASSETS_TIMEOUT_DELAY,
    retryForSeconds: fetchOptions.fetchAssetsRetryForSeconds ?? FETCH_ASSETS_RETRY_FOR_SECONDS,
  };

  const chunksContext = {};
  await getAssetsByChunks(contractAddress, fromTokenId, toTokenId, chunksContext, newFetchOptions);

  log.info('chunksContext.length', chunksContext.length);

  const assets = [];
  chunksContext.assets.forEach(asset => {
    assets.push(opensea.convertAsset(asset));
  });

  context.assets = assets;
  context.modified = new Date();
  context.finished = true;
}

export async function fetchAssetsOld(contractAddress, fromTokenId, toTokenId, context) {
  const assets = [];
  const source = await getAssetsByChunksOld(contractAddress, fromTokenId, toTokenId);
  source.forEach(asset => {
    assets.push(opensea.convertAsset(asset));
  });
  context.assets = assets;
  context.finished = true;
}

async function getAssetsByChunks(contractAddress, fromTokenId, toTokenId, context, fetchOptions) {
  log.info(`Fetch assets chunks:`, contractAddress, fromTokenId, toTokenId);
  const limit = 20;

  var uriList = [];
  const tokenIds = range(fromTokenId, toTokenId);
  log.info('tokenIds', tokenIds);
  while (tokenIds.length) {
    log.info('tokenIds.length', tokenIds.length);
    uriList.push({
      uri: opensea.assetsTokenIdsURL(contractAddress, tokenIds.splice(0, limit)),
      metadata: {}
    });
  }
  log.info('uriList', uriList);
  log.info('uriList.length', uriList.length);
  log.debug(uriList);

  const fetchContext = {
    assets: [],
    numTotal: uriList.length,
    stats: {
      numOk: 0,
      numTimeout: 0,
      numErr: 0,
      num404: 0,
      num429: 0,
      num500: 0,
    }
  };
  await myURIFetcher.fetch(uriList, fetchURICallback, fetchContext, fetchOptions);

  if (context === null) {
    return fetchContext.assets;
  } else {
    context.assets = fetchContext.assets.flat();
    context.finished = true;
  }
}

function fetchURICallback(request, response, context, fetchOptions) {
  log.debug(request, response, context, fetchOptions);

  if (response.ok && !_.isEmpty(response.data)) {
    // Asset is valid!
    context.assets.push(response.data.assets);
    context.stats.numOk++;
    log.info(`(Batch ${request.metadata.index}/${request.metadata.numBatches}) ok`);
    log.debug(`(Batch ${request.metadata.index}/${request.metadata.numBatches}) ok`, context.stats);
    return { ok: true };
  }

  if (response.reason === 'noResponse') {
    // Likely a timeout, retry!
    context.stats.numTimeout++;
    log.info(`(Batch ${request.metadata.index}/${request.metadata.numBatches}) timeout retry`);
    log.debug(`(Batch ${request.metadata.index}/${request.metadata.numBatches}) timeout retry`, context.stats);
    return { retry: true, delay: fetchOptions.timeoutDelay };
  }

  if (response.reason === 'noRequest') {
    // Unknown error! Error log and skip!
    context.stats.numSkip++;
    log.info(`(Batch ${request.metadata.index}/${request.metadata.numBatches}) noRequest skip`);
    log.debug(`(Batch ${request.metadata.index}/${request.metadata.numBatches}) noRequest skip`, context.stats);
    return { skip: true };
  }

  // Otherwise it should be a non-success response status code!

  let retrySeconds;

  switch (response.status) {
    case 408:
      context.stats.numTimeout++;
      log.info(`(Batch ${request.metadata.index}/${request.metadata.numBatches}) timeout retry`);
      log.debug(`(Batch ${request.metadata.index}/${request.metadata.numBatches}) timeout retry`, context.stats);
      return { retry: true, delay: fetchOptions.timeoutDelay };
    case 429:
      retrySeconds = parseRetryAfterSecs(response.error.response.headers['retry-after'], 10);
      console.log('retrySeconds', retrySeconds);
      console.log('response.error.response.headers[\'retry-after\']', response.error.response.headers['retry-after']);
      context.stats.num429++;
      log.info(`(Batch ${request.metadata.index}/${request.metadata.numBatches}) 429 retry ${retrySeconds} sec`);
      log.debug(`(Batch ${request.metadata.index}/${request.metadata.numBatches}) 429 retry ${retrySeconds} sec`, context.stats);
      return { retry: true, delay: retrySeconds * 1000 };
    case 500:
    case 503:
    case 504:
      context.stats.num500++;
      log.info(`(Batch ${request.metadata.index}/${request.metadata.numBatches}) 500 retry ${retrySeconds}`);
      log.debug(`(Batch ${request.metadata.index}/${request.metadata.numBatches}) 500 retry ${retrySeconds}`, context.stats);
      return { retry: true, delay: fetchOptions.standardDelay };
    case 403:
    case 404:
    case 502: // Bad Gateway
      context.stats.num404++;
      log.info(`(Batch ${request.metadata.index}/${request.metadata.numBatches}) 404 skip`);
      log.debug(`(Batch ${request.metadata.index}/${request.metadata.numBatches}) 404 skip`, context.stats);
      return { skip: true };
    default:
      context.stats.numError++;
      log.info(`(Batch ${request.metadata.index}/${request.metadata.numBatches}) unknown error skip`);
      log.debug(`(Batch ${request.metadata.index}/${request.metadata.numBatches}) unknown error skip`, context.stats);
      return { skip: true };
  }
}

async function getAssetsByChunksOld(contractAddress, fromTokenId, toTokenId, projectId, batchSize = Infinity) {
  const maxSupply = parseInt(toTokenId) - parseInt(fromTokenId) + 1;
  const limit = 50;
  const times = Math.ceil(maxSupply / limit);

  const tries = [];
  [...Array(times).keys()].map(i => {
    tries.push({
      index: i,
      status: null,
      url: opensea.assetsURL(contractAddress, i * limit, limit)
    });
  });

  const finalResult = [];
  let retryAfterSecs = 0;
  while (true) {
    const newTries = tries.filter(obj => obj.status !== 'ok' && obj.status !== 'skip').map(obj => {
      return {
        index: obj.index,
        status: obj.status,
        url: obj.url,
        promise: fetch(obj.url, { method: 'GET' })
      };
    }).slice(0, batchSize);
    if (newTries.length < 1) {
      break;
    }
    log.debug(`(${projectId}) getCollectionByChunks, batch size: ${newTries.length}`);
    const results = await Promise.all(newTries.map(obj => obj.promise));
    for (let i = 0; i < results.length; i++) {
      const resultsArrIndex = newTries[i].index;
      const response = results[i];
      log.debug(`(${projectId}) Response status: ${response.status} ${response.statusText} (${newTries[i].url})`);
      tries[resultsArrIndex].status = response.status.toString();
      if (response.status === 200) {
        finalResult.push((await response.json()).assets);
        tries[resultsArrIndex].status = 'ok';
      } else if (response.status === 429) {
        retryAfterSecs = parseInt(response.headers.get('retry-after'));
      } else if (response.status === 400) {
        tries[resultsArrIndex].status = 'skip';
      } else {
        log.info(`(${projectId}) Unexpected response status: ${response.status} ${response.statusText} (${newTries[i].url})`);
      }
    }
    const numOk = tries.filter(obj => ['ok', 'skip'].includes(obj.status)).length;
    const num429 = tries.filter(obj => ['429'].includes(obj.status)).length;
    const numNotOk = tries.length - numOk;

    if (retryAfterSecs > 0) {
      log.info(`(${projectId}) Batches: ${times}, numOk: ${numOk}, numNotOk: ${numNotOk}, num429: ${num429} (retry after ${retryAfterSecs} secs)`);
      await delay(retryAfterSecs * 1000);
      retryAfterSecs = 0;
    } else {
      log.info(`(${projectId}) Batches: ${times}, numOk: ${numOk}, numNotOk: ${numNotOk}, num429: ${num429}`);
      await delay(50);
    }
  }
  return finalResult.flat();
}
