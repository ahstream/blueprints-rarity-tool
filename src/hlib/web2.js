import axios from 'axios';
import http from 'http';
import https from 'https';

import * as utils from './utils.js';

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });
const keepAliveAxios = axios.create({ httpAgent, httpsAgent, maxRedirects: 10, });

const DEFAULT_REQUEST_TIMEOUT_MS = 30 * 1000;
const DEFAULT_RETRY_FOR_SEC = 60;
const DEFAULT_RETRY_INTERVAL_MS = 1000;

/**
 * options: { keepAlive: boolean, timeout: number }
 */
export async function get(url, options = {}) {
  return request({ method: 'GET', url, ...options });
}

export async function getWithRetry(url, options = {}, retryFor = DEFAULT_RETRY_FOR_SEC, retryInterval = DEFAULT_RETRY_INTERVAL_MS) {
  let result = get(url, options);
  if (!result.error) {
    return result;
  }

  const retryTo = utils.addSecondsToDate(new Date(), retryFor);
  while (retryTo >= new Date()) {
    result = get(url, options);
    if (!result.error) {
      return result;
    }
    await utils.sleep(retryInterval);
  }

  return result;
}

/**
 * options: { keepAlive: boolean, timeout: number }
 */
export async function post(url, data, options = {}) {
  return request({ method: 'POST', url, data, ...options });
}

/**
 * options: { keepAlive: boolean, timeout: number }
 * @returns {response} | {error, reason=statusCode|noResponse|noRequest}
 */

async function request(options) {
  try {
    const timeout = options.timeout ?? DEFAULT_REQUEST_TIMEOUT_MS;
    const abort = axios.CancelToken.source();
    const id = setTimeout(() => abort.cancel('timeout'), timeout);
    const allOptions = { ...options, timeout, cancelToken: abort.token };

    console.info('web2.request URL:', allOptions.url);
    const response = allOptions.keepAlive ? await keepAliveAxios(allOptions) : await axios(allOptions);
    clearTimeout(id);
    return response;
    // return { ok: true, data: response.data };
  } catch (error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      // console.log(error.response.data);
      // console.log(error.response.status);
      // console.log(error.response.headers);
      return { error, reason: 'statusCode' };
    } else if (error.request || error.message === 'timeout') {
      // The request was made but no response was received
      // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
      // http.ClientRequest in node.js
      // console.log(error.request);
      return { error, reason: 'noResponse' };
    } else {
      // Something happened in setting up the request that triggered an Error
      // console.log('Error', error.message);
      return { error, reason: 'noRequest' };
    }
  }
}
