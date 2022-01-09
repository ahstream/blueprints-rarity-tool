/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

import * as web2 from './web2.js';

export const ASSETS_LIMIT = 50;
export const BASE_ASSET_URI = 'https://opensea.io/assets';
export const BASE_URI = 'https://opensea.io';

// MAIN FUNCTIONS

/**
 * requestOptions: { keepAlive: boolean, timeout: number }
 */
export async function getCollectionStats(apiKey, slug, requestOptions = {}, retryFor = null, retryInterval = null) {
  console.log(apiKey, slug, requestOptions);
  const headers = apiKey ? { 'X-API-KEY': apiKey } : {};
  const url = `https://api.opensea.io/api/v1/collection/${slug}/stats`;

  const response = retryFor
    ? await web2.get(url, { headers, ...requestOptions }, retryFor, retryInterval)
    : await web2.get(url, { headers, ...requestOptions });

  if (response.data?.stats) {
    return response.data.stats;
  }

  return response;
}

export async function getContract(apiKey, contractAddress, requestOptions = {}, retryFor = null, retryInterval = null) {
  const headers = apiKey ? { 'X-API-KEY': apiKey } : {};
  const url = `https://api.opensea.io/api/v1/asset_contract/${contractAddress}`;

  const response = retryFor
    ? await web2.get(url, { headers, ...requestOptions }, retryFor, retryInterval)
    : await web2.get(url, { headers, ...requestOptions });

  if (response.data) {
    return response.data;
  }

  return response;
}

export async function getAsset(apiKey, contractAddress, tokenId, options = {}, requestOptions = {}, retryFor = null, retryInterval = null) {
  const result = await getAssets(apiKey, contractAddress, {
    ...options,
    tokenIds: [tokenId]
  }, requestOptions, retryFor, retryInterval);
  return result.error ?? result[0];
}

export async function getAssets(apiKey, contractAddress, options = {}, requestOptions = {}, retryFor = null, retryInterval = null) {
  const defaultOptions = {
    tokenIds: null,
    limit: ASSETS_LIMIT,
    offset: 0,
    direction: 'asc',
    convert: true,
  };
  const newOptions = { ...defaultOptions, ...options };

  const headers = apiKey ? { 'X-API-KEY': apiKey } : {};
  const url = `https://api.opensea.io/api/v1/assets?asset_contract_addresses=${contractAddress}&` +
    `order_direction=${newOptions.direction}&offset=${newOptions.offset}&limit=${newOptions.limit}` +
    `${newOptions.tokenIds?.length ? `&token_ids=${newOptions.tokenIds.join('%2C')}` : ''}`;

  const response = retryFor
    ? await web2.getWithRetry(url, { headers, ...requestOptions }, retryFor, retryInterval)
    : await web2.get(url, { headers, ...requestOptions });

  if (response.data?.assets) {
    return options.convert ? response.data.assets.map(obj => convertAsset(obj)) : response.data.assets;
  }

  return response;
}

// HELPER FUNCTIONS

function convertAsset(baseAsset) {
  const nowDate = new Date();

  const asset = { ...baseAsset };

  // LISTING

  const listingBasePrice = asset?.sell_orders && asset?.sell_orders[0] ? asset.sell_orders[0].base_price : null;
  const listingDecimals = asset?.sell_orders && asset?.sell_orders[0] ? asset.sell_orders[0].payment_token_contract?.decimals ?? null : null;
  const listingSymbol = asset?.sell_orders && asset?.sell_orders[0] ? asset.sell_orders[0].payment_token_contract?.symbol : null;

  asset.listing_date = asset?.sell_orders && asset?.sell_orders[0] ? new Date(asset.sell_orders[0].created_date) ?? null : null;
  asset.listing_closing_date = asset?.sell_orders && asset?.sell_orders[0] ? new Date(asset.sell_orders[0].closing_date) : null;
  asset.listing_hours = asset.listing_date ? (nowDate.getTime() - asset.listing_date.getTime()) / (1000 * 3600) : null;
  asset.listing_days = asset.listing_hours ? asset.listing_hours * 24 : null;

  asset.listing_price = listingBasePrice && listingDecimals && listingSymbol === 'ETH' ? listingBasePrice / Math.pow(10, listingDecimals) : null;
  asset.listing_symbol = listingSymbol;

  asset.is_listed = asset.listing_price && asset.listing_price > 0 && asset.listing_symbol === 'ETH';
  asset.is_auction = asset.listing_price && asset.listing_symbol === 'WETH' ? true : false;

  // LAST SALE

  const lastSaleTotalPrice = asset.last_sale?.total_price ?? null;
  const lastSaleDecimals = asset?.last_sale?.payment_token?.decimals ?? null;

  asset.last_sale_date = asset?.last_sale?.event_timestamp ? new Date(asset?.last_sale?.event_timestamp) : null;
  asset.last_sale_hours = asset.last_sale_date ? (nowDate.getTime() - asset.last_sale_date.getTime()) / (1000 * 3600) : null;
  asset.last_sale_days = asset.last_sale_hours ? asset.last_sale_hours * 24 : null;

  asset.last_sale_price = lastSaleTotalPrice && lastSaleDecimals ? lastSaleTotalPrice / Math.pow(10, lastSaleDecimals) : null;
  asset.last_sale_symbol = asset?.last_sale?.payment_token?.symbol ?? null;

  asset.summary = {};

  return asset;
}

// OTHERS -------------------------------------------------------------------------------

export function NOTUSED_assetsURL(contractAddress, offset, limit, order = 'asc') {
  return `https://api.opensea.io/api/v1/assets?asset_contract_address=${contractAddress}&order_direction=${order}&offset=${offset}&limit=${limit}`;
}

export function NOTUSED_assetsTokenIdsURL(contractAddress, tokenIds) {
  const tokenIdsParam = tokenIds.map(id => `token_ids=${id}`).join('&');
  return `https://api.opensea.io/api/v1/assets?asset_contract_address=${contractAddress}&${tokenIdsParam}`;
}

