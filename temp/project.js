import _ from 'lodash';
import open from "open";

import * as rarity from "../src.bak/rarity.js";
import { getFromCache } from "./cache.js";
import { debugToFile, getConfig, saveCache } from "./config.js";
import { fetchTokenURIs } from "./fetchTokenURIs.js";
import { fetchTokenURIs2 } from "./fetchTokenURIs2.js";
import { addToHotTokens, updateHotOV } from "./hotToken.js";
import { log } from "./logUtils.js";
import { addSecondsToDate, delay, doIfTrue, range, sort } from "./miscUtils.js";
import { notifyHotToken, notifyNewResults } from "./notify.js";
import * as notify from "./notify.js";
import { getAssetsData, updateAssets } from "./opensea.js";
import { calcRarity, calcTemporaryTokenRarity } from "./rarity.js";
import * as reveal from "./reveal.js";
import { release, take } from "./semaphore.js";
import * as timer from "./timer.js";
import * as tokenURI from "./tokenURI.js";
import { cleanProjectHtmlFiles } from "./tools.js";
import { addTokenTraits, normalizeTraitKey } from "./trait.js";
import * as webPage from "./webPage.js";
import { createAlertWebPage } from "./webPage.js";

const BASE_ASSET_URI = 'https://opensea.io/assets/';

// REVEAL FUNCTIONS ----------------------------------------------------------------------------------------

export async function revealProjects(projectId, args) {
  log.info(`Start revealing projects...`);

  args.command = 'reveal';
  const config = getConfig(projectId, args);

  if (config.projectId) {
    return await revealProject(projectId, args);
  }

  Object.keys(config.projects).forEach((projectId) => {
    if (!config.projects[projectId].disabled) {
      revealProject(projectId, args);
    }
  });
}

export async function revealProject(projectId, args) {
  const config = getConfig(projectId, args);

  cleanProjectHtmlFiles(config, config.projectId, 'reveal');

  config.collection.retryTo = addSecondsToDate(new Date(), 60 * 60);
  config.collection.waitBeforeRetry = 500;

  await getAssetsTask(config);
  await revealProjectTask(config.collection);
  await fetchCollectionTask(config);
  process.exit();
  saveCache(config);
  // debugToFile(config, 'config1234.json');

  log.info(`(${config.projectId}) Finished fetching collection`);
  // log.info(`(${config.projectId}) Finished fetching collection: ${countDoneConfig(config)} ok, ${countSkippedConfig(config)} skipped`);

  return config;
}

async function revealProjectTask(collection) {
  log.info(`(${collection.projectId}) Wait for reveal...`);
  while (true) {
    const revealedToken = await reveal.revealCollection(
      collection.revealTokenIds,
      collection.contractAddress,
      collection.unrevealedImage
    );
    if (revealedToken !== null) {
      collection.baseTokenURI = tokenURI.convertToBaseTokenURI(revealedToken.tokenId, revealedToken.tokenURI);
      console.log(revealedToken);
      return true;
    }
    log.info(`(${collection.projectId}) .`);
    await delay(collection.sleepBetweenReveal);
  }
}

// INTERNAL FUNCTIONS

async function getAssetsTask(config) {
  await getOpenseaAssets(config);
  updateAssetsInfo(config);
}

async function getOpenseaAssets(config) {
  try {
    if (config.args.skipOpensea) {
      log.debug('Skip Opensea');
      return;
    }

    if (!take('getOpenseaAssets', log.info, config.projectId)) {
      log.info(`(${config.projectId}) Asset fetcher is busy, wait for my turn to fetch tokens...`);
      while (!take('getOpenseaAssets', log.info, config.projectId)) {
        await delay(1000);
      }
    }
    log.info(`(${config.projectId}) Get Opensea assets...`);

    const myTimer = timer.create();
    await updateAssets(config);
    // myTimer.ping(`(${config.projectId}) getOpenseaAssets duration`);

    release('getOpenseaAssets');

    saveCache(config);
  } catch
    (error) {
    log.error(error);
    release('getOpenseaAssets');
  }
}

function updateAssetsInfo(config) {
  const assetArr = Object.entries(config.cache.opensea.assets.data).map(([key, val]) => val);
  const assets = assetArr.filter(obj => obj.price > 0);
  const prices = assets.map(obj => obj.price).sort((a, b) => a - b);

  config.collection.assetsInfo = {
    numBuynow: prices.length,
    floor: Math.min(...prices),
    roof: Math.max(...prices),
    levels: [
      { price: 0.2, count: prices.filter(price => price <= 0.2).length },
      { price: 0.3, count: prices.filter(price => price <= 0.3).length },
      { price: 0.4, count: prices.filter(price => price <= 0.4).length },
      { price: 0.5, count: prices.filter(price => price <= 0.5).length },
      { price: 0.75, count: prices.filter(price => price <= 0.75).length },
      { price: 1.0, count: prices.filter(price => price <= 1.0).length },
    ]
  };
}

async function fetchCollectionTask(config) {
  const baseTokens = range(config.collection.firstTokenId, config.collection.lastTokenId, 1).map(id => {
    const asset = getFromCache(config.cache.opensea.assets, id);
    const tokenId = id.toString();
    return {
      tokenId,
      tokenIdSortKey: id,
      tokenURI: tokenURI.createTokenURI(id, config.collection.baseTokenURI),
      assetURI: asset?.permalink ?? null,
      price: asset?.price ?? null,
      hasAsset: !_.isEmpty(asset),
      cache: config.args.skipTokenCache ? null : getFromCache(config.cache.tokens, tokenId)
      // traits: asset?.traits ?? null,
    };
  });

  const tokensOnSale = sort(baseTokens.filter(token => token.price > 0), 'price', true);
  const tokensNotOnSale = baseTokens.filter(token => token.price <= 0);
  const allTokens = [...tokensOnSale, ...tokensNotOnSale];

  log.info(`(${config.projectId}) Total tokens: ${allTokens.length} (Buynow: ${tokensOnSale.length})`);

  const urls = allTokens.map(token => {
    return {
      url: token.tokenURI,
      metadata: token,
    };
  });

  const outputArray = [];
  const stats = {};

  const lastRetryDate = addSecondsToDate(new Date(), 60 * 60);

  fetchTokenURIs(config.projectId, urls, outputArray, config.fetchTokenOptions, lastRetryDate, config.cache.tokens, stats);

  let numProcessedTokensThisRun = 0;
  let lastToken = null;
  while (numProcessedTokensThisRun < urls.length) {
    while (outputArray.length) {
      numProcessedTokensThisRun++;

      const result = outputArray.shift();
      if (result.status !== '200') {
        continue;
      }

      const token = addTokenRef(result.ref, result.data, config.collection, numProcessedTokensThisRun);
      if (!token) {
        continue;
      }

      lastToken = token;
    }
    await delay(10);
  }

  log.info(`(${config.projectId}) Stats:`, stats);
  await createRevealResults(config, null, true);
}

async function createRevealResults(config) {
  return;
}

function addTokenRef(tokenRef, tokenData, collection, revealOrder) {
  if (_.isEmpty(tokenData) || _.isEmpty(tokenData.attributes) || !tokenData.image) {
    log.debug('Not proper JSON:', tokenData);
    return false;
  }

  const { attributes, ...otherTokenProperties } = tokenData;
  const token = { ...otherTokenProperties, ...tokenRef };
  collection.tokens.push(token);

  token.revealOrder = revealOrder;

  if (!token.assetURI) {
    token.assetURI = `${BASE_ASSET_URI}${collection.contractAddress}/${token.tokenId}`;
  }

  addTokenTraits(token, attributes, collection);
  calcTemporaryTokenRarity(token, collection);

  return token;
}

async function getTokenURIs(urls, fetchTokenOptions) {
  const outputArray = [];
  const resultArray = [];

  fetchTokenURIs2(urls, outputArray, fetchTokenOptions);

  let numProcessed = 0;
  while (numProcessed < urls.length) {
    while (outputArray.length) {
      numProcessed++;
      const result = outputArray.shift();
      resultArray.push(result);
      console.log(result);
    }
    await delay(5);
  }
  return resultArray;
}

