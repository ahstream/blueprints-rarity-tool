import _ from 'lodash';

import { log } from './myLibOld/myLogger.js';
import * as myURIFetcher from './myLibOld/myURIFetcher.js';
import { parseRetryAfterSecs, range } from './myLibOld/myUtils.js';
import * as myWeb2 from './myLibOld/myWeb2.js';
import { createTokenURI, getTokenURI } from './tokenURI.js';

const FETCH_TOKENS_MAX_CONCURRENT = 100;
const FETCH_TOKENS_TIMEOUT = 8000;
const FETCH_TOKENS_BATCH_DELAY = 100;
const FETCH_TOKENS_STANDARD_DELAY = 1000;
const FETCH_TOKENS_TIMEOUT_DELAY = 1000;
const FETCH_TOKENS_UNREVEALED_DELAY = 12000;
const FETCH_TOKENS_RETRY_FOR_SECONDS = null;

export async function fetch(collectionId, baseTokenURI, firstTokenId, lastTokenId, context, fetchOptions = {}) {
  const newFetchOptions = {
    maxConcurrent: fetchOptions.fetchTokensMaxConcurrent ?? FETCH_TOKENS_MAX_CONCURRENT,
    timeout: fetchOptions.fetchTokensTimeout ?? FETCH_TOKENS_TIMEOUT,
    batchDelay: fetchOptions.fetchTokensBatchDelay ?? FETCH_TOKENS_BATCH_DELAY,
    standardDelay: fetchOptions.fetchTokensStandardDelay ?? FETCH_TOKENS_STANDARD_DELAY,
    timeoutDelay: fetchOptions.fetchTokensTimeoutDelay ?? FETCH_TOKENS_TIMEOUT_DELAY,
    unrevealedDelay: fetchOptions.fetchTokensUnrevealedDelay ?? FETCH_TOKENS_UNREVEALED_DELAY,
    retryForSeconds: fetchOptions.fetchTokensRetryForSeconds ?? FETCH_TOKENS_RETRY_FOR_SECONDS,
  };

  const fetchContext = { tokens: [] };
  const uriList = createURIList(collectionId, baseTokenURI, firstTokenId, lastTokenId);

  await myURIFetcher.fetch(uriList, fetchURICallback, fetchContext, newFetchOptions);

  if (context === null) {
    return fetchContext.tokens;
  } else {
    context.tokens = fetchContext.tokens;
    context.finished = true;
  }
}

export async function fetchIpfs(config, collectionId, firstTokenId, lastTokenId, context, fetchOptions = {}) {
  const newFetchOptions = {
    maxConcurrent: fetchOptions.fetchTokensMaxConcurrent ?? FETCH_TOKENS_MAX_CONCURRENT,
    timeout: fetchOptions.fetchTokensTimeout ?? FETCH_TOKENS_TIMEOUT,
    batchDelay: fetchOptions.fetchTokensBatchDelay ?? FETCH_TOKENS_BATCH_DELAY,
    standardDelay: fetchOptions.fetchTokensStandardDelay ?? FETCH_TOKENS_STANDARD_DELAY,
    timeoutDelay: fetchOptions.fetchTokensTimeoutDelay ?? FETCH_TOKENS_TIMEOUT_DELAY,
    unrevealedDelay: fetchOptions.fetchTokensUnrevealedDelay ?? FETCH_TOKENS_UNREVEALED_DELAY,
    retryForSeconds: fetchOptions.fetchTokensRetryForSeconds ?? FETCH_TOKENS_RETRY_FOR_SECONDS,
  };

  const ipfsList = createIPFSList(collectionId, firstTokenId, lastTokenId);
  for (const item of ipfsList) {
    log.info(`Get IPFS for tokenId ${item.metadata.tokenId} (last: ${lastTokenId})`);
    const tokenURI = await getTokenURI(item.metadata.tokenId, config.contractAddress);
    if (tokenURI && tokenURI.uri) {
      const realTokenURI = `https://ipfs.io/ipfs/${tokenURI.uri}`;
      log.info(`TokenURI: ${realTokenURI}`);
      item.uri = realTokenURI;
      item.metadata.ipfs = tokenURI.uri;
      item.metadata.tokenURI = realTokenURI;
    }
  }

  const newIpfsList = ipfsList.filter(obj => obj.metadata.ipfs);

  const fetchContext = { tokens: [] };
  await myURIFetcher.fetch(newIpfsList, fetchURICallback, fetchContext, newFetchOptions);

  if (context === null) {
    return fetchContext.tokens;
  } else {
    context.tokens = fetchContext.tokens;
    context.finished = true;
  }
}

export async function simpleFetch(baseTokenURI, firstTokenId, lastTokenId) {
  const result = {
    tokens: [],
    errors: [],
  };

  const uriList = createURIList(firstTokenId, lastTokenId, baseTokenURI);
  for (const uriItem of uriList) {
    const wrappedResponse = await myWeb2.get(uriItem.uri, {}, true);

    if (wrappedResponse.ok) {
      result.tokens.push({ ...wrappedResponse.data, ...uriItem.metadata });
    } else {
      result.errors.push({ ...uriItem.metadata, error: wrappedResponse.error });
    }
  }
  return result;
}

function createURIList(collectionId, baseTokenURI, firstTokenId, lastTokenId) {
  return range(firstTokenId, lastTokenId, 1).map(id => {
    const tokenURI = createTokenURI(id, baseTokenURI);
    return {
      uri: tokenURI,
      metadata: {
        collectionId,
        tokenId: id,
        tokenURI
      }
    };
  });
}

function createIPFSList(collectionId, firstTokenId, lastTokenId) {
  return range(firstTokenId, lastTokenId, 1).map(id => {
    return {
      metadata: {
        collectionId,
        tokenId: id,
        ipfs: null,
        tokenURI: null
      }
    };
  });
}

function normalizeTokenImage(val, undefinedValue = null) {
  if (typeof val !== 'string') {
    return undefinedValue;
  }
  if (val.startsWith('Qm')) {
    return `https://ipfs.io/ipfs/${val}`;
  }
  return val;
}

function fetchURICallback(request, response, context, fetchOptions) {
  log.debug('fetchURICallback request, response:', request, response);
  log.info('fetchURICallback request, response:', request, response);

  if (response.ok && !_.isEmpty(response.data?.attributes)) {
    // Token is valid!
    const token = {
      tokenId: request.metadata.tokenId,
      tokenURI: request.metadata.tokenURI,
      collectionId: request.metadata.collectionId,
      tokenURIMetadata: response.data,
      ...response.data
    };
    token.__image = token.image;
    token.image = normalizeTokenImage(token.image);
    context.tokens.push(token);
    return { ok: true };
  }

  if (response.ok && !response.data) {
    log.info(`[${request.metadata.tokenId}] skip (null metadata) (${response?.data?.name})`);
    return { skip: true };
  }

  if (response.ok && response.data?.error) {
    // Metadata contains error property, token is most likely not valid, treat it as non-existing token!
    log.info(`[${request.metadata.tokenId}] skip (metadata error property) (${response?.data?.name})`);
    return { skip: true };
  }

  if (response.ok && !request.metadata?.hasAsset) {
    // TODO Token has JSON but no attributes + has no asset => likely non-existing token!
    log.info(`[${request.metadata.tokenId}] skip (likely non-existing token) (${response?.data?.name})`);
    return { skip: true };
  }

  if (response.ok) {
    // Otherwise if ok: token is probably valid but has not been revealed yet, we should retry!
    log.info(`[${request.metadata.tokenId}] retry after ${fetchOptions.unrevealedDelay} (not revealed yet) (${response?.data?.name})`);
    return { retry: true, delay: fetchOptions.unrevealedDelay };
  }

  if (response.reason === 'noResponse') {
    console.log(response);
    // Likely a timeout, retry!
    log.info(`[${request.metadata.tokenId}] retry after ${fetchOptions.timeoutDelay} (noResponse) (${response?.data?.name})`);
    return { retry: true, delay: fetchOptions.timeoutDelay };
  }

  if (response.reason === 'noRequest') {
    // Unknown error! Error log and skip!
    log.error(`[${request.metadata.tokenId}] skip (noRequest) (${response?.data?.name})`);
    return { skip: true };
  }

  // Otherwise it should be a non-success response status code!

  let retryAfterSecs = null;
  switch (response.status) {
    case 408:
      log.info(`[${request.metadata.tokenId}] 408 retry after ${fetchOptions.timeoutDelay} (${response?.data?.name})`);
      return { retry: true, delay: fetchOptions.timeoutDelay };
    case 429:
      retryAfterSecs = parseRetryAfterSecs(response.error.response.headers['retry-after'], 5);
      log.info(`[${request.metadata.tokenId}] 429 retry after ${retryAfterSecs} seconds (${response?.data?.name})`);
      return { retry: true, delay: retryAfterSecs * 1000 };
    case 500:
    case 503:
    case 504:
      log.info(`[${request.metadata.tokenId}] 5xx retry after ${fetchOptions.standardDelay} (${response?.data?.name})`);
      return { retry: true, delay: fetchOptions.standardDelay };
    case 403:
    case 404:
    case 502: // Bad Gateway
      if (request.metadata.hasAsset) {
        // If token has asset AND collection is revealed, NotFound means that this token metadata
        // is about to be revealed soon! Retry after a little longer delay.
        log.info(`[${request.metadata.tokenId}] 5xx retry after ${fetchOptions.standardDelay} (about to reveal) (${response?.data?.name})`);
        return { retry: true, delay: fetchOptions.unrevealedDelay };
      } else {
        log.info(`[${request.metadata.tokenId}] 404 skip (${response?.data?.name})`);
        return { skip: true };
      }
    default:
      log.info(`[${request.metadata.tokenId}] unknown skip (status: ${response.status}) (${response?.data?.name})`);
      return { skip: true };
  }
}
