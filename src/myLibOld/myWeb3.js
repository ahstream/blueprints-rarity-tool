/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

import _ from 'lodash';

import * as myWeb2 from './myWeb2.js';

const ETHERSCAN_API_URL = 'http://node1.web3api.com/';
const TOKENURI_METHOD_SIGNATUR = '0xc87b56dd';

const CURL_HEADERS = [
  'authority: node1.web3api.com',
  'pragma: no-cache',
  'cache-control: no-cache',
  'sec-ch-ua: "Chromium";v="94", "Google Chrome";v="94", ";Not A Brand";v="99"',
  'sec-ch-ua-mobile: ?0',
  'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 Safari/537.36',
  'sec-ch-ua-platform: "Windows"',
  'content-type: application/json',
  'accept: */*',
  'origin: https://etherscan.io',
  'sec-fetch-site: cross-site',
  'sec-fetch-mode: cors',
  'sec-fetch-dest: empty',
  'referer: https://etherscan.io/',
  'accept-language: sv,en-GB;q=0.9,en-US;q=0.8,en;q=0.7,la;q=0.6,da;q=0.5,de;q=0.4',
];

const AXIOS_HEADERS = {
  'authority': 'node1.web3api.com',
  'pragma': 'no-cache',
  'cache-control': 'no-cache',
  'sec-ch-ua': '"Chromium";v="94", "Google Chrome";v="94", ";Not A Brand";v="99"',
  'sec-ch-ua-mobile': '?0',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 Safari/537.36',
  'sec-ch-ua-platform': '"Windows"',
  'content-type': 'application/json',
  'accept': '*/*',
  'origin': 'https://etherscan.io',
  'sec-fetch-site': 'cross-site',
  'sec-fetch-mode': 'cors',
  'sec-fetch-dest': 'empty',
  'referer': 'https://etherscan.io/',
  'accept-language': 'sv,en-GB;q=0.9,en-US;q=0.8,en;q=0.7,la;q=0.6,da;q=0.5,de;q=0.4',
};

export async function getTokenURIFromContract(id, contractAddress) {
  try {
    return await getTokenURIFromEtherscanWithAxios(id, contractAddress, ETHERSCAN_API_URL, TOKENURI_METHOD_SIGNATUR);
  } catch (error) {
    return { error, message: `unknownError` };
  }
}

async function getTokenURIFromEtherscanWithAxios(id, contractAddress, url, signatur) {
  console.log('id, contractAddress', id, contractAddress);
  const tokenIdData = createTokenIdData(id, signatur);
  const postFields = `{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"from":"0x0000000000000000000000000000000000000000","data":"${tokenIdData}","to":"${contractAddress}"},"latest"]}`;

  console.log(postFields);

  const response = await myWeb2.post(url, JSON.parse(postFields), { headers: AXIOS_HEADERS });

  if (response.error) {
    return { error: response.error, reason: response.reason, status: response.status };
  }

  if (typeof response.data !== 'object') {
    return { error: response, reason: 'corruptResponseData' };
  }

  if (response.data.error) {
    return { error: response, reason: 'errorResponseData' };
  }

  if (!response.data.result || response.data.result.length < 130) {
    return { error: response, reason: 'shortTokenURI' };
  }

  const uri = hex2a(response.data.result.substring(130)).replace(/\0/g, '').trim();
  /*
  if (!isValidURL(uri)) {
    return { error: response, reason: 'invalidTokenURI' };
  }
   */

  return { uri };
}

async function getTokenURIFromEtherscanWithCurl(id, contractAddress, url, signatur) {
  const tokenIdData = createTokenIdData(id, signatur);
  const postFields = `{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"from":"0x0000000000000000000000000000000000000000","data":"${tokenIdData}","to":"${contractAddress}"},"latest"]}`;

  const response = await curly.post(url, { postFields, httpHeader: CURL_HEADERS });

  if (response.statusCode !== 200) {
    return { error: true, message: `Status code: ${response.statusCode}` };
  }

  let data;
  try {
    data = JSON.parse(response.data);
  } catch (error) {
    return { error, message: 'corruptResponseData', data };
  }

  if (data.error) {
    return { error: true, message: 'errorPropertyInResponse', data };
  }

  const { result } = data;
  if (!result || result.length < 130) {
    return { error: true, message: 'shortTokenURI', data };
  }

  const uri = hex2a(data.result.substring(130)).replace(/\0/g, '').trim();
  if (!isValidURL(uri)) {
    return { error: true, message: 'invalidTokenURI', data };
  }

  return { uri };
}

function createTokenIdData(id, signatur) {
  const hexId = typeof (id) === 'string' ? parseInt(id, 10).toString(16) : id.toString(16);
  const suffix = hexId.padStart(64, '0');
  return `${signatur}${suffix}`;
}

function hex2a(hexValue) {
  const hexStr = hexValue.toString(); // force conversion
  let str = '';
  for (let i = 0; i < hexStr.length; i += 2)
    str += String.fromCharCode(parseInt(hexStr.substr(i, 2), 16));
  return str;
}

function isValidURL(uri) {
  try {
    if (!uri) {
      return false;
    }
    const url = new URL(uri);
    return true;
  } catch (_error) {
    return false;
  }
}
