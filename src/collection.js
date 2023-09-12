import _ from 'lodash';

import * as debug from './hlib/debug.js';
import { log } from './hlib/logger.js';
import { BASE_ASSET_URI } from './hlib/opensea.js';
import {
  getAssetsBlockWithRetry,
  getCollectionStatsWithRetry
} from './hlib/openseaHelpers.js';
import * as openseaHelpers from './hlib/openseaHelpers.js';
import * as utils from './hlib/utils.js';
import { getWithRetry } from './hlib/web2.js';
import { calcRarity } from './rarity.js';
import { normalizeURI } from './tokenURI.js';
import { addTokenAttributes, } from './trait.js';
import * as webpage from './webpage.js';
import { writeGrifters } from './webpage.js';

const { compareOrderedNum } = require('./hlib/utils.js');

const SLEEP_BETWEEN_POLLS_SEC = 30;
const MAX_CONCURRENT_ASYNC_REQUESTS = 10;
const MIN_PCT_OF_LAST_FLOOR_PRICE_TO_NOT_BE_ERROR = 0.3;

export async function poll(config) {
  config.runtime = { tokens: [], assets: [], collections: {} };

  let firstLoop = true;
  while (true) {
    log.info('Run poll loop...');

    if (!firstLoop) await pausePoll();
    firstLoop = false;

    config.runtime.stats = await fetchStats(config);
    if (config.runtime.stats.error) continue;

    config.runtime.assets = await fetchAssets(config, config.runtime.stats.num_tokens);
    if (config.runtime.assets.error) continue;
    log.info('config.runtime.assets.length', config.runtime.assets.length);

    config.runtime.tokens = await fetchTokens(config, config.runtime.stats.num_tokens);
    if (!config.runtime.tokens) continue;
    log.info('config.runtime.tokens.length', config.runtime.tokens.length);

    config.runtime.floorHistory = await fetchFloorHistory(config);
    if (!config.runtime.floorHistory) continue;
    debug.debugToFile(config.runtime.floorHistory, 'config.runtime.floorHistory');

    normalizeTokens(config);
    addCollections(config);

    debug.debugToFile(config.runtime.collections, 'collections');
    debug.debugToFile(config.runtime, 'runtime');

    await writeResult(config);

    webpage.writeGrifters(config);

    break;
  }
}

export async function grifters(config) {
  config.runtime = { tokens: [], assets: [], collections: {} };

  config.runtime = { tokens: [], assets: [], collections: {} };

  config.runtime.stats = await fetchStats(config);

  config.runtime.assets = await fetchAssets(config, config.runtime.stats.num_tokens);
  log.info('config.runtime.assets.length', config.runtime.assets.length);

  debug.debugToFile(config, 'config');
  debug.debugToFile(config.runtime.collections, 'collections');

  webpage.writeGrifters(config);
  webpage.writeGriftersGonnaClaim(config);
}

const pausePoll = async () => {
  log.info(`Sleep ${SLEEP_BETWEEN_POLLS_SEC} secs between polls...`);
  await utils.sleep(SLEEP_BETWEEN_POLLS_SEC * 1000);
};

async function fetchStats(config) {
  log.info(`Fetch stats...`);
  const stats = config.skipOpenseaFetchAssets ? { count: config.numTokens } : await getCollectionStatsWithRetry(config.slug);
  if (stats.error) {
    return stats;
  }
  stats.num_tokens = stats.count;
  log.info(`stats:`, stats);
  return stats;
}

async function fetchAssets(config, numTokens) {
  log.info(`Fetch assets...`);
  return config.skipOpenseaFetchAssets ? [] : await getAssetsBlockWithRetry(config.contractAddress, numTokens, 0);
}

async function fetchTokens(config, numTokens) {
  log.info(`Fetch ${numTokens} tokens...`);
  // const tokens = await getTokens(config, 50, 0);
  // const tokens = await getTokens(config, numNewTokens, runtime.tokens.length);
  const tokenIds = config.runtime.assets.map(obj => obj.token_id);
  const tokens = await getTokensAsync(config, tokenIds);
  // const tokens = await getTokensAsync(config, 500, 0);
  if (!tokens) {
    log.error('tokens error:', tokens);
    return null;
  }
  // tokens.forEach(token => config.runtime.tokens.push(token));
  return tokens;
}

async function addCollections(config) {
  log.info(`Add collections...`);
  const editions = [...new Set(config.runtime.tokens.map(t => t.edition_name))];
  editions.forEach(editionName => {
    const tokens = config.runtime.tokens.filter(t => t.edition_name === editionName);
    const collection = createCollection(editionName, tokens, config.rules);
    config.runtime.collections[editionName] = collection;
    collection.modified = new Date();
    collection.floors = calcFloor(collection, config);
  });
}

function normalizeTokens(config) {
  log.info('Normalize tokens...');

  for (const token of config.runtime.tokens) {
    const asset = config.runtime.assets.find(obj => obj.token_id === token.token_id);

    token.image_url = normalizeURI(asset?.image_url || asset?.image_origina_url || token.image_url || token.image);
    token.image_preview_url = normalizeURI(asset?.image_preview_url);
    token.image_thumbnail_url = normalizeURI(asset?.image_thumbnail_url);

    token.price = asset?.listing_price ?? null;
    token.permalink = asset?.permalink ?? `${BASE_ASSET_URI}/${config.contractAddress}/${token.token_id}`;
    token.owner_opensea = asset?.owner?.user?.username ?? asset?.owner?.address ?? null;
    token.owner_opensea_url = token.owner_opensea ? `https://opensea.io/${token.owner_opensea}` : null;
    token.num_owned = config.runtime.tokens.filter(obj => obj.edition_name === token.edition_name && obj.owner_async === token.owner_async).length;
  }
}

function getEditionNameFromTokenName(name) {
  if (typeof name !== 'string') {
    log.error('Unknown name:', name);
    return 'unknown';
  }

  if (name.includes('THC')) {
    return 'Thousand Headers Coterie';
  }
  if (name.includes('DEyes')) {
    return 'DecentralEyesMashup';
  }
  if (name.includes('Grifter')) {
    return 'Grifters';
  }

  return 'unknown';
}

async function fetchFloorHistory(config) {
  log.info(`Fetch floor history...`);

  config.runtime.events = config.skipOpenseaFloorHistory ? [] : await openseaHelpers.getEventBlockWithRetry(config.contractAddress, 200, 0);

  const eventDates = {};
  for (let event of config.runtime.events) {
    if (!event.is_public) {
      continue;
    }
    if (!event.is_listing || event.is_bundle || event.event_type !== 'created') {
      console.error('Invalid listing type for event:', event);
      continue;
    }

    const editionNameFromToken = config.runtime.tokens.find(obj => obj.token_id === event.asset.token_id)?.edition_name;
    const editionName = editionNameFromToken || getEditionNameFromTokenName(event.asset.name);
    if (!eventDates[editionName]) {
      eventDates[editionName] = {};
    }
    const shortDate = event.listing_short_date;
    if (!eventDates[editionName][shortDate]) {
      eventDates[editionName][shortDate] = { events: [] };
    }
    eventDates[editionName][shortDate].edition_name = editionName;
    eventDates[editionName][shortDate].date = event.listing_date;
    eventDates[editionName][shortDate].short_date = event.listing_short_date;
    eventDates[editionName][shortDate].floor_price = null;
    eventDates[editionName][shortDate].events.push(event);
  }

  config.runtime.eventDates = eventDates;

  debug.debugToFile(eventDates, 'eventDates');

  const floorHistory = [];
  for (let key of Object.keys(eventDates)) {
    const edition = eventDates[key];
    let lastFloor = 0;
    for (let key2 of Object.keys(edition).sort()) {
      const eventDate = edition[key2];
      const sortedPrices = eventDate.events.sort((a, b) => compareOrderedNum(b.listing_price, a.listing_price)).map(obj => obj.listing_price);
      let thisFloor = null;
      while (sortedPrices[0]) {
        const thisPrice = sortedPrices.shift();
        if (!lastFloor) {
          lastFloor = thisPrice;
        }
        if (thisPrice < lastFloor * MIN_PCT_OF_LAST_FLOOR_PRICE_TO_NOT_BE_ERROR) {
          // Potential error in floor price!
          continue;
        }
        lastFloor = thisPrice;
        thisFloor = thisPrice;
        break;
      }

      if (!thisFloor) {
        // No valid floor price this date!
        log.info('No valid floor price this date!', edition[key2]);
        continue;
      }

      eventDate.floor_price = thisFloor;

      floorHistory.push({
        edition_name: eventDate.edition_name,
        date: eventDate.date,
        short_date: eventDate.short_date,
        floor_price: eventDate.floor_price
      });
    }
  }

  return floorHistory;
}

function calcFloor(collection, config) {
  const floors = [];

  const allTokens = collection.tokens.sort((a, b) => compareOrderedNum(a.price, b.price, true));
  const floorTokens = allTokens.filter(t => t.price > 0).sort();

  if (floorTokens.length < 1) {
    return [];
  }

  if (floorTokens[0]) {
    floors.push({ name: 'Collection', data: floorTokens[0], qty: allTokens.length });
  }

  const collectionConfig = config.collectionPrefs[collection.name];
  if (!collectionConfig?.floors) {
    return floors;
  }

  for (let traitType of collectionConfig.floors) {
    const traitValues = [...new Set(allTokens.map(token => token.traits.find(t => t.trait_type === traitType)?.value))];
    traitValues.forEach(traitValue => {
      if (traitValue === 'None') {
        return;
      }
      floors.push({
        name: traitValue,
        data: allTokens.find(obj => obj.traits.find(t => t.trait_type === traitType && t.value === traitValue)) ?? { price: -1 },
        qty: allTokens.filter(obj => obj.traits.find(t => t.trait_type === traitType && t.value === traitValue)).length
      });
    });
  }

  return floors.sort((a, b) => compareOrderedNum(a.data.price, b.data.price, true));
}

async function writeResult(config) {
  for (let key of Object.keys(config.runtime.collections)) {
    await webpage.createCollectionFiles(config, config.runtime.collections[key]);
  }
  webpage.createIndexFile(config);
}

async function getTokens(config, limit, offset) {
  const tokens = [];

  for (let id of utils.range(offset, offset + limit - 1)) {
    const url = config.baseHomeUrl.replace('{ID}', id);
    const response = await getWithRetry(url, { keepAlive: true });
    if (response.error) {
      console.error('getToken URL error:', url, response.error.message);
      continue;
    }
    const token = createToken(response.data, id.toFixed(), url);
    if (!token) {
      console.error('parse token error:', url, token);
      continue;
    }
    tokens.push(token);
  }

  return tokens;
}

async function getTokensAsync(config, tokenIdList) {
  const tokens = [];

  const allIds = [...tokenIdList];

  let errorIds = [];

  const errorCount = {};

  while (true) {
    log.debug('errorIds:', errorIds);
    const numNewIds = MAX_CONCURRENT_ASYNC_REQUESTS - errorIds.length;
    const currentIds = [...errorIds, ...allIds.splice(0, numNewIds)];
    log.debug('numNewIds:', numNewIds);
    log.info('Get token IDs:', currentIds);
    errorIds = [];
    log.debug('currentIds', currentIds);
    if (currentIds.length < 1) {
      break;
    }

    const promises = [];
    const currentUrls = [];
    for (let id of currentIds) {
      const url = config.baseHomeUrl.replace('{ID}', id);
      currentUrls.push(url);
      promises.push(getWithRetry(url, { keepAlive: true }));
    }

    const responses = await Promise.all(promises);
    let i = -1;
    for (let response of responses) {
      i++;
      const id = currentIds[i];
      if (response.error) {
        console.error('getToken URL error:', currentUrls[i], response.error.message);
        errorCount[id] = errorCount[id] ? errorCount[id] + 1 : 1;
        if (errorCount[id] < 10) {
          // Try 10 times
          errorIds.push(id);
        } else {
          log.info('Tried 10 times with error token, skip it:', id);
        }
        continue;
      }
      const token = createToken(response.data, id, currentUrls[i]);
      if (!token) {
        console.error('parse token error:', token);
        continue;
      }
      tokens.push(token);
    }

    await utils.sleep(1000);
  }

  return tokens;
}

async function getTokensAsyncNoList(config, limit, offset) {
  const tokens = [];

  const allIds = utils.range(offset, offset + limit - 1);

  let errorIds = [];

  while (true) {
    log.debug('errorIds:', errorIds);
    const numNewIds = MAX_CONCURRENT_ASYNC_REQUESTS - errorIds.length;
    const currentIds = [...errorIds, ...allIds.splice(0, numNewIds)];
    log.debug('numNewIds:', numNewIds);
    log.info('Get token IDs:', currentIds);
    errorIds = [];
    log.debug('currentIds', currentIds);
    if (currentIds.length < 1) {
      break;
    }

    const promises = [];
    const currentUrls = [];
    for (let id of currentIds) {
      const url = config.baseHomeUrl.replace('{ID}', id);
      currentUrls.push(url);
      promises.push(getWithRetry(url, { keepAlive: true }));
    }

    const responses = await Promise.all(promises);
    let i = -1;
    for (let response of responses) {
      i++;
      if (response.error) {
        errorIds.push(currentIds[i]);
        console.error('getToken URL error:', currentUrls[i], response.error.message);
        continue;
      }
      const id = currentIds[i];
      const token = createToken(response.data, id.toFixed(), currentUrls[i]);
      if (!token) {
        console.error('parse token error:', token);
        continue;
      }
      tokens.push(token);
    }

    await utils.sleep(1000);
  }

  return tokens;
}

function createToken(htmltext, tokenId, url) {
  const token = parseHomePageToken(htmltext);
  return !token ? null : { ...token, token_id: tokenId, home_url: url };
}

function parseHomePageToken(htmltext) {
  return parseHomePageMetadata(htmltext);
}

function parseHomePageMetadata(htmltext) {
  const result = htmltext.match(/<script id="__NEXT_DATA__" type="application\/json">(.*)<\/script>/im);
  if (!result || !result[1]) {
    log.error('Failed to regex parse', { result, htmltext });
    return {};
  }
  let props;
  try {
    props = JSON.parse(result[1]);
  } catch (error) {
    log.error('Failed to JSON.parse props', { result, htmltext });
    return {};
  }

  const pageProps = props.props.pageProps;

  const baseData = {
    edition: {
      title: pageProps.edition.blueprint.title?.trim(),
      imageUrl: pageProps.edition.blueprint.imageUrl,
      artistsCache: pageProps.edition.blueprint.artists,
      capacity: pageProps.edition.blueprint.capacity,
      description: pageProps.edition.blueprint.description?.trim(),
      blueprintId: pageProps.edition.blueprint.blueprintId,
      id: pageProps.edition.blueprint.id,
      url: `https://async.art/blueprints/${pageProps.edition.blueprint.id}`
    },
    token: {
      title: pageProps.edition.title?.trim(),
      created: pageProps.edition.created,
      tokenId: pageProps.edition.tokenId,
      tokenNumber: pageProps.edition.tokenNumber,
      slug: pageProps.edition.slug,
      tokenUri: pageProps.edition.tokenUri,
      tokenData: pageProps.edition.tokenData,
      imageIpfs: pageProps.edition.imageIpfs,
      imageUrl: pageProps.edition.imageUrl,
      owner: pageProps.edition.owner?.trim(),
      ownerUsername: pageProps.edition.ownerCache.username?.trim(),
    }
  };

  const attributes = parseAttributes(baseData.edition.title, baseData.token.tokenData.attributes);
  const artist = attributes.find(obj => obj.trait_type === 'Artist')?.value;

  const topData = {
    token_id: baseData.token.tokenId.toString(),
    name: baseData.token.tokenData.name?.trim(),
    description: baseData.token.tokenData.description?.trim(),
    external_url: baseData.token.tokenData.external_url,
    image_url: baseData.token.imageUrl,
    edition_name: baseData.edition.title?.trim(),
    edition_artist: artist?.trim(),
    edition_url: baseData.edition.url,
    edition_image_url: baseData.edition.imageUrl,
    capacity: baseData.edition.capacity,
    owner_async: baseData.token.owner?.trim(),
    owner_async_url: `https://async.art/u/${baseData.token.owner}/collection`,
    attributes
  };

  return { ...baseData, ...topData };
}

function parseHomePageTokenImage(htmltext) {
  const result = htmltext.match(/<meta property="og:image" content="([^"]*)"\/>/im);
  if (!result || !result[1]) {
    log.error('Failed to regex parse', { result, htmltext });
    return null;
  }
  return result[1];
}

function parseAttributes(edition, attributes) {
  switch (edition) {
    case 'Grifters':
      return parseGrifters(attributes);
    default:
      return parseGenericEdition(attributes);
  }
}

function parseAttributesHtml(htmltext) {
  const result = htmltext.match(/"attributes":(\[[^\]]*\])/im);
  if (!result || !result[1]) {
    log.error('Failed to regex parse', { result, htmltext });
    return null;
  }
  let attributes;
  try {
    attributes = JSON.parse(result[1]);
  } catch (error) {
    log.error('Failed to JSON.parse attributes', { result, htmltext });
    return null;
  }

  const artist = attributes.find(obj => obj.trait_type === 'Artist')?.value;
  if (!artist) {
    console.error('Unknown artist:', attributes);
    return null;
  }

  switch (artist) {
    case 'XCOPY':
      return { artist, attributes: parseGrifters(attributes) };
    default:
      return { artist, attributes: parseGenericEdition(attributes) };
  }
}

function parseGrifters(attributes) {
  const type = attributes.find(item => item.trait_type === 'Type')?.value;
  const color = attributes.find(item => item.trait_type === type)?.value ?? 'None';

  const newAttributes = attributes.filter(item => item.trait_type !== type);
  newAttributes.push({ trait_type: 'Base Color', value: color });

  return newAttributes;
}

function parseGenericEdition(attributes) {
  return attributes;
}

/* ---------------------------------------------------------------------------------------------- */

function createCollection(editionName, tokens, rules) {
  log.info('Start createCollectionFromTokens');

  const collection = defaultCollection(editionName);

  tokens.sort((a, b) => Number(a.token_id) - Number(b.token_id));
  for (const token of tokens) {
    addTokenToCollection(token, collection, rules);
  }
  calcRarity(collection, rules);
  log.info('End createCollectionFromTokens');

  return collection;
}

function addTokenToCollection(token, collection, rules) {
  const { attributes, ...newToken } = token;
  if (!validateToken(token, rules)) {
    return;
  }
  collection.tokens.push(newToken);
  addTokenAttributes(newToken, attributes, collection, rules);
}

function validateToken(token, rules) {
  if (!rules.validation) {
    return true;
  }

  const validateTrait = (token, key, value) => {
    const attr = token.attributes.find(obj => obj.trait_type === key);
    if (!attr) {
      return false;
    }
    if (value === '*') {
      return true;
    }
    if (attr.value !== value) {
      return false;
    }
    return true;
  };

  if (rules.validation.traits) {
    for (const [key, value] of Object.entries(rules.validation.traits)) {
      if (!validateTrait(token, key, value)) {
        log.debug('Invalid token traits:', key, value, token, rules);
        return false;
      }
    }
  }

  const validateProperty = (token, key, value) => {
    if (!token[key] || token[key] !== value) {
      return false;
    }
    return true;
  };

  if (rules.validation.properties) {
    for (const [key, value] of Object.entries(rules.validation.properties)) {
      if (!validateProperty(token, key, value)) {
        log.debug('Invalid token properties:', key, value, token, rules);
        return false;
      }
    }
  }

  return true;
}

function defaultCollection(name) {
  return {
    name,
    tokens: [],
    traits: {
      items: {}
    },
  };
}
