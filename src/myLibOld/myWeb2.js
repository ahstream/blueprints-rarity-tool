import axios from 'axios';
import http from 'http';
import https from 'https';

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });
const keepAliveAxios = axios.create({ httpAgent, httpsAgent, maxRedirects: 10, });

const DEFAULT_TIMEOUT = 30 * 1000;

export async function get(url, options = {}, keepAlive = false) {
  return request({ method: 'get', url, ...options }, keepAlive);
}

export async function post(url, data, options = {}, keepAlive = false) {
  return request({ method: 'post', url, data, ...options }, keepAlive);
}

/**
 *
 * @param options
 * @param keepAlive
 * @returns {ok, data} | {error, reason='responseStatus | noResponse | noRequest', status}
 */
function request2(options, keepAlive) {
  const allOptions = { timeout: DEFAULT_TIMEOUT, ...options };
  const thisAxios = keepAlive ? keepAliveAxios : axios;
  thisAxios(allOptions)
    .then(response => {
      return { ok: true, data: response.data };
    })
    .catch(error => {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        // console.log(error.response.data);
        // console.log(error.response.status);
        // console.log(error.response.headers);
        return { error, reason: 'errorResponse', status: error.response.status };
      } else if (error.request) {
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
    });
}

async function request(options, keepAlive) {
  try {
    const timeout = options.timeout ?? DEFAULT_TIMEOUT;
    const abort = axios.CancelToken.source();
    const id = setTimeout(
      () => abort.cancel('timeout'),
      timeout
    );

    const allOptions = { timeout: DEFAULT_TIMEOUT, cancelToken: abort.token, ...options };
    const response = keepAlive ? await keepAliveAxios(allOptions) : await axios(allOptions);
    clearTimeout(id);
    return { ok: true, data: response.data };
  } catch (error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      // console.log(error.response.data);
      // console.log(error.response.status);
      // console.log(error.response.headers);
      return { error, reason: 'errorResponse', status: error.response.status };
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
