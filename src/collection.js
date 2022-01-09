import _ from 'lodash';
import open from 'open';

import * as debug from './hlib/debug.js';
import { log } from './hlib/logger.js';
import { BASE_ASSET_URI } from './hlib/opensea.js';
import {
  getAssetsBlockWithRetry,
  getCollectionStatsWithRetry
} from './hlib/openseaHelpers.js';
import * as utils from './hlib/utils.js';
import { getWithRetry } from './hlib/web2.js';
import { calcRarity } from './rarity.js';
import { normalizeURI } from './tokenURI.js';
import { addTokenAttributes, } from './trait.js';
import * as webpage from './webpage.js';

const { compareOrderedNum, compareOrderedString } = require('./hlib/utils.js');

const SLEEP_BETWEEN_POLLS_SEC = 30;

export async function poll(config, artist = null) {
  const runtime = { tokens: [], assets: [], collections: {} };

  const pause = async () => {
    console.log(`Sleep ${SLEEP_BETWEEN_POLLS_SEC} secs between polls...`);
    await utils.sleep(SLEEP_BETWEEN_POLLS_SEC * 1000);
  };

  while (true) {
    console.log('Run poll loop...');

    runtime.stats = config.skipOpensea ? { count: config.numTokens } : await getCollectionStatsWithRetry(config.slug);
    if (runtime.stats.error) {
      console.error('runtime.stats.error:', runtime.stats.error);
      await pause();
      continue;
    }

    const numNew = runtime.stats.count - runtime.tokens.length;
    if (numNew > 0) {
      console.log(`Fetch ${numNew} new tokens...`);
      const tokens = await getTokens(config, 30, 660);
      // const tokens = await getTokens(config, numNew, runtime.tokens.length);
      if (!tokens) {
        console.error('tokens error:', tokens);
        await pause();
        continue;
      }
      tokens.forEach(token => runtime.tokens.push(token));
    }

    debug.debugToFile(runtime);

    console.log(`Fetch assets...`);
    let assetsData = { assets: [], artists: {} };
    if (!config.skipOpensea) {
      assetsData = await getAssetsData(config.contractAddress, 30, 660, config);
      // assetsData = await getAssetsData(config.contractAddress, runtime.stats.count, 0);
      if (!assetsData.assets) {
        console.error('assetsData.assets error:', assetsData.assets);
        await pause();
        continue;
      }
    }
    runtime.assets = assetsData.assets;

    normalizeTokens(runtime, config);

    console.log(`Add collections...`);
    const editions = [...new Set(runtime.tokens.map(t => t.edition_name))];
    editions.forEach(editionName => {
      console.log('editionName', editionName);
      const tokens = runtime.tokens.filter(t => t.edition_name === editionName);
      const collection = createCollection(editionName, tokens, config.rules);
      runtime.collections[editionName] = collection;
      collection.modified = new Date();
      collection.floors = calcFloor(collection, config);
    });

    await writeResult(runtime, config);

    debug.debugToFile(runtime);

    break;

    await pause();
  }
}

function calcFloor(collection, config) {
  const floors = [];

  const allTokens = collection.tokens.sort((a, b) => compareOrderedNum(a.price, b.price, true));
  const floorTokens = allTokens.filter(t => t.price > 0).sort();

  floors.push({ name: 'Collection Floor', data: floorTokens[0] ?? { price: -1 } });

  const collectionConfig = config.collections[collection.name];
  if (!collectionConfig?.floors) {
    return floors;
  }

  console.log('allTokens', allTokens);
  for (let traitType of collectionConfig.floors) {
    const traitValues = [...new Set(allTokens.map(token => token.traits.find(t => t.trait_type === traitType)?.value))];
    traitValues.forEach(traitValue => {
      floors.push({
        name: traitValue,
        data: allTokens.find(obj => obj.traits.find(t => t.trait_type === traitType && t.value === traitValue)) ?? { price: -1 }
      });
    });
  }

  return floors;
}

async function writeResult(runtime, config) {
  for (let key of Object.keys(runtime.collections)) {
    await webpage.writeFiles(runtime.collections[key], runtime, config);
  }
}

async function getTokens(config, limit, offset) {
  console.log('Get tokens...');

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
      title: pageProps.blueprintEdition.blueprint.title,
      imageUrl: pageProps.blueprintEdition.blueprint.imageUrl,
      artistsCache: pageProps.blueprintEdition.blueprint.artists,
      capacity: pageProps.blueprintEdition.blueprint.capacity,
      description: pageProps.blueprintEdition.blueprint.description,
      blueprintId: pageProps.blueprintEdition.blueprint.blueprintId,
      url: `https://async.art/blueprints/${pageProps.blueprintEdition.blueprint.blueprintId}`
    },
    token: {
      title: pageProps.blueprintEdition.title,
      created: pageProps.blueprintEdition.created,
      tokenId: pageProps.blueprintEdition.tokenId,
      tokenNumber: pageProps.blueprintEdition.tokenNumber,
      slug: pageProps.blueprintEdition.slug,
      tokenUri: pageProps.blueprintEdition.tokenUri,
      tokenData: pageProps.blueprintEdition.tokenData,
      imageIpfs: pageProps.blueprintEdition.imageIpfs,
      imageUrl: pageProps.blueprintEdition.imageUrl,
      owner: pageProps.blueprintEdition.owner,
      ownerUsername: pageProps.blueprintEdition.ownerCache.username,
    }
  };

  const attributes = parseAttributes(baseData.edition.title, baseData.token.tokenData.attributes);
  const artist = attributes.find(obj => obj.trait_type === 'Artist')?.value;

  const topData = {
    token_id: baseData.token.tokenId.toString(),
    name: baseData.token.tokenData.name,
    description: baseData.token.tokenData.description,
    external_url: baseData.token.tokenData.external_url,
    image_url: baseData.token.imageUrl,
    edition_name: baseData.edition.title,
    edition_artist: artist,
    edition_url: baseData.edition.url,
    edition_image_url: baseData.edition.imageUrl,
    capacity: baseData.edition.capacity,
    owner_async: baseData.token.owner,
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

function normalizeTokens(runtime, config) {
  log.info('Normalize tokens...');
  for (const token of runtime.tokens) {
    const asset = runtime.assets.find(obj => obj.token_id === token.token_id);
    normalizeImage(token, asset, runtime);

    token.price = asset?.listing_price ?? null;
    token.permalink = asset?.permalink ?? `${BASE_ASSET_URI}/${config.contractAddress}/${token.token_id}`;
    token.owner_opensea = asset?.owner?.username ?? asset?.owner?.address ?? null;
    token.owner_opensea_url = token.owner_opensea ? `https://opensea.io/${token.owner_opensea}` : null;
    token.num_owned = runtime.tokens.filter(obj => obj.edition_name === token.edition_name && obj.owner_async === token.owner_async).length;
  }
}

function normalizeImage(token, asset) {
  if (token.image && token.image_preview) {
    return;
  }
  token.image_url = normalizeURI(asset?.image_url || asset?.image_origina_url || token.image_url);
  token.image_thumbnail_url = normalizeURI(asset?.image_thumbnail_url || asset?.image_preview_url || token.image_thumbnail_url || token.image_url);
}

/* ---------------------------------------------------------------------------------------------- */

async function getAssetsData(contractAddress, qty, offset) {
  const assets = await getAssetsBlockWithRetry(contractAddress, qty, offset);
  const data = { assets, artists: {} };

  for (let asset of assets) {
    const artistName = asset.traits.find(obj => obj.trait_type === 'Artist')?.value;
    if (!artistName) {
      console.error('Unknown artistName:', asset, artistName);
      continue;
    }
    if (!data.artists[artistName]) {
      data.artists[artistName] = { name: artistName, assets: [] };
    }
    data.artists[artistName].assets.push(asset);
  }

  return data;
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
