import open from 'open';
import { compileFile } from 'pug';
import TableBuilder from 'table-builder';

import { writeFile } from './hlib/fileutils.js';
import { log } from './hlib/logger.js';
import * as opensea from './hlib/opensea.js';

const path = require('path');
const { compareOrderedNum, compareOrderedString } = require('./hlib/utils.js');

const IMAGE_NOT_FOUND_URL = 'https://www.publicdomainpictures.net/pictures/280000/velka/not-found-image-15383864787lu.jpg';

export async function writeFiles(collection, runtime, config) {
  log.info('Write files for collection:', collection.name);

  const baseFilename = normalizeFilename(collection.name);
  const filenames = [
    `${baseFilename}.html`, `${baseFilename}-price.html`, `${baseFilename}-days-listed.html`, `${baseFilename}-last-price.html`,
    `${baseFilename}-last-days.html`, `${baseFilename}-num-sales.html`, `${baseFilename}-owner.html`, `${baseFilename}-token.html`
  ];

  const dataSource = createDataSource(collection, runtime);

  for (let filename of filenames) {
    log.info('Write file:', filename);
    const html = await createPage(collection, dataSource, filename, config);
    const filepath = path.resolve(global.__datadir, filename);
    writeFile(filepath, html);
  }

  open(path.resolve(global.__datadir, `${baseFilename}.html`), { app: 'chrome' });
}

function normalizeFilename(name) {
  return name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
}

export async function createPage(collection, dataSource, filename, config) {
  const selectedData = getSelectedData(dataSource, filename);

  const makeHeader = (filename, header, title) => `<a href="./${filename}" title="${title}" class="sort-icon">${header} <i class="fa fa-sort"></i></a>&nbsp;`;

  const headers = {
    'imageHtml': '',
    'nameHtml': 'Name',
    'rankHtml': makeHeader('grifters.html', 'Rarity', 'Sort by rarity rank'),
    'topHtml': 'Top',
    'priceHtml': makeHeader('grifters-price.html', 'Price', 'Sort by lowest price'),
    'listingDaysHtml': makeHeader('grifters-days-listed.html', 'Days Listed', 'Sort by most days listed'),
    'lastSalePriceHtml': makeHeader('grifters-last-price.html', 'Last Sale Price', 'Sort by highest last sale price'),
    'lastSaleDaysHtml': makeHeader('grifters-last-days.html', 'Last Sale Day', 'Sort by most recent last sale day'),
    'numSalesHtml': makeHeader('grifters-num-sales.html', 'Sales', 'Sort by most sales'),
    'ownerHtml': makeHeader('grifters-owner.html', 'Owner', 'Sort by most Grifters owned'),
    'openseaHtml': 'Sales Page',
    'homePageHtml': 'Token Page',
    'scoreHtml': 'Score',
    'tokenIdHtml': makeHeader('grifters-token.html', 'Token ID', 'Sort by token ID'),
  };

  const header = await createHeader(collection, dataSource, selectedData, config);
  const footnotes = createFootnotes(config, filename);

  const selectedSortColumnStyleKeys = [
    { f: 'grifters.html', v: 'rarityrank-th' },
    { f: 'grifters-price.html', v: 'pricehtml-th' },
    { f: 'grifters-days-listed.html', v: 'listingdayshtml-th' },
    { f: 'grifters-last-price.html', v: 'lastsalepricehtml-th' },
    { f: 'grifters-last-days.html', v: 'lastsaledayshtml-th' },
    { f: 'grifters-num-sales.html', v: 'numsaleshtml-th' },
    { f: 'grifters-owner.html', v: 'ownerhtml-th' },
    { f: 'grifters-token.html', v: 'tokenid-th' }
  ];
  const selectedSortColumnStyle = selectedSortColumnStyleKeys.find(obj => obj.f === filename)?.v;

  const selectedSortColumnStyleHtml = `<style>.${selectedSortColumnStyle} { background: #fa3e96 }</style>`;

  const htmlTable = new TableBuilder({ 'class': 'main-table' })
      .setHeaders(headers)
      .setData(dataSource)
      .render() + selectedSortColumnStyleHtml
    || 'Data collection is empty!';

  const compiledFunction = compileFile('src/templates/collection.pug');

  return compiledFunction({
    header,
    mainContent: htmlTable,
    footnotes,
  });
}

function getSelectedData(dataSource, filename) {
  if (filename.endsWith('-price.html')) {
    return dataSource.sort((a, b) => compareOrderedNum(a.price, b.price, true));
  }
  if (filename.endsWith('-days-listed.html')) {
    return dataSource.sort((a, b) => compareOrderedNum(a.asset?.listing_days, b.asset?.listing_days, false));
  }
  if (filename.endsWith('-last-price.html')) {
    return dataSource.sort((a, b) => compareOrderedNum(a.asset?.last_sale_price, b.asset?.last_sale_price, false));
  }
  if (filename.endsWith('-last-days.html')) {
    return dataSource.sort((a, b) => compareOrderedNum(a.asset?.last_sale_days, b.asset?.last_sale_days, true));
  }
  if (filename.endsWith('-num-sales.html')) {
    return dataSource.sort((a, b) => compareOrderedNum(a.asset?.num_sales, b.asset?.num_sales, false));
  }
  if (filename.endsWith('-owner.html')) {
    return dataSource.sort((a, b) => compareOwner(a.num_owned, b.num_owned, false, String(a.owner), String(b.owner), true));
  }
  if (filename.endsWith('-token.html')) {
    return dataSource.sort((a, b) => compareOrderedNum(Number(a.token_id), Number(b.token_id), true));
  }

  return dataSource.sort((a, b) => compareOrderedNum(a.score_rank, b.score_rank, true));
}

function createDataSource(collection, runtime) {
  return collection.tokens.map(tokenData => {
      const token = { ...tokenData };

      const asset = runtime.assets?.find(obj => obj.token_id === token.token_id);

      token.asset = asset;

      const imageUrl = token.image_thumbnail_url ?? IMAGE_NOT_FOUND_URL;
      const imageHtml = `<a target="_blank" href="${token.permalink}"><img src='${imageUrl}' class='thumb' title='${createThumbImageTitle(token, collection.tokens.length)}'></a>`;

      const nameParts = token.name.split('#');
      const nameHash = nameParts.length === 2 ? `#${nameParts[1]}` : '';
      const nameHtml = `<a id="${nameHash}">${token.name}</a>`;

      const rankHtml = token.score_rank;
      const topHtml = `${normalizePct(token.score_top * 100, '%')}`;

      const priceHtml = `${normalizePrice(token.price ?? null, 2, '', ' ETH')}`;
      const listingDaysHtml = normalizeNumber(asset?.listing_days ?? null, '', ` ${normalizePlural(asset?.listing_days, 'day', 'days')}`);

      const lastSalePriceHtml = `${normalizePrice(asset?.last_sale_price ?? null, 2, '', ' ETH')}`;
      const lastSaleDaysHtml = normalizeNumber(asset?.last_sale_days ?? null, '', ` ${normalizePlural(asset?.last_sale_days, 'day', 'days')} ago`);

      const numSalesHtml = normalizeNumber(asset?.num_sales ? asset?.num_sales : null, '', ` ${normalizePlural(asset?.num_sales ?? 0, 'sale', 'sales')}`);

      const ownerUrl = token.owner_opensea_url ?? token.owner_async_url;
      const ownerHtml = `<a target="_blank" href="${ownerUrl}">${normalizeUsernameText(token.owner_opensea ?? token.owner_async)}</a> (${token.num_owned} pcs)`;

      const openseaHtml = `<a target="_blank" href="${token.permalink}">OpenSea</a>`;
      const homePageHtml = `<a target="_blank" href="${token.home_url}">AsyncArt</a>`;

      const scoreHtml = `${token.score.toFixed(2)} pts`;

      const tokenIdHtml = `<a id="${token.token_id}">#${token.token_id}</a>`;

      const tokenHtml = {
        imageHtml,
        nameHtml,
        rankHtml,
        topHtml,
        priceHtml,
        listingDaysHtml,
        lastSalePriceHtml,
        lastSaleDaysHtml,
        numSalesHtml,
        ownerHtml,
        openseaHtml,
        homePageHtml,
        scoreHtml,
        tokenIdHtml,
      };

      return { ...token, ...tokenHtml };
    }
  );
}

function compareOwner(a1, b1, ascending1, a2, b2, ascending2) {
  if (!a1 && !b1) {
    return 0;
  }
  if (a1 !== b1) {
    return ascending1 ? a1 - b1 : b1 - a1;
  }
  return compareOrderedString(a2, b2, ascending2);
}

function normalizePlural(num, singular, plural) {
  return num === 1 ? singular : plural;
}

async function createHeader(collection, dataSource, selectedData) {
  const modifiedText = collection.modified ? collection.modified.toLocaleString() : 'Unknown';
  const capacity = collection.tokens[0].capacity;

  return `<h1>${collection.tokens[0].edition_name} by ${collection.tokens[0].edition_artist}: Rarity Rankings and Other Stats</h1>

        <div class="page-header">
         <form action="#" method="get" id="search-form" name="query"
        onSubmit="var e=document.getElementById(this.gid.value); if (!e) { document.getElementById('search-result').style.visibility='visible'; return false}; document.getElementById('search-result').style.visibility='hidden'; var rect=e.getBoundingClientRect(); window.scroll(0, rect.top); return false;">

         <!-- <div>See disclaimers and notes at <a href="#footnotes">bottom of page</a>.</div> -->
         <div class="edition-image"><img src="${collection.tokens[0].edition_image_url}"></div>
         <div class="floor">${await createFloor(collection.floor)}</div>
         <div class="search">
         1-${selectedData.length} of ${collection.tokens.length} minted tokens (max capacity: ${capacity}). Updated: <b>${modifiedText}</b>. Go to Name # or Token ID:
            <input type="text" size="16" name="gid" onfocus='this.value=""' placeholder="#123">
            <span id="search-result" style="visibility: hidden">Not found</span>
        </div>
       <!-- <div>1-${selectedData.length} of ${collection.tokens.length} minted tokens (of total capacity ${capacity}). Updated: <b>${modifiedText}</b></div>-->
        </form>
      </div>`;
}

async function createSummary(collection, dataSource, selectedData,) {
  const modifiedText = collection.modified ? collection.modified.toLocaleString() : 'Unknown';

  const capacity = collection.tokens[0].capacity;

  return `<div class="summary">1-${selectedData.length} of total ${capacity} tokens.<!-- See disclaimers and notes at <a href="#footnotes">bottom of page</a>.--> Updated: <b>${modifiedText}</b></div>
         <div class="floor">${await createFloor(collection.floor)}</div>
         <div class="search">
         <form action="#" method="get" id="search-form" name="query"
        onSubmit="var e=document.getElementById(this.gid.value); if (!e) { document.getElementById('search-result').style.visibility='visible'; return false}; document.getElementById('search-result').style.visibility='hidden'; var rect=e.getBoundingClientRect(); window.scroll(0, rect.top); return false;">
            Go to Grifter # or ID:
            <input type="text" size="16" name="gid" onfocus='this.value=""' placeholder="#123">
            <span id="search-result" style="visibility: hidden">Not found</span>
        </form>
        </div>
  `;
}

function createFootnotes(config, filename) {
  return `<div id="footnotes">
  <p><b>Disclaimers & Notes:</b></p>
  <p>This web page is not connected to XCOPY or Async Art in any way. It is just a web app set up
    to have more fun following the Grifters. If people associated with the collection does not
    want the web page to exist for any reason, I will take it down from public access and make it
    private.</p>
  <p>Rarity.tools ranking method used with Trait Normalization ${config.rules.normalize ? 'On' : 'Off'}, Trait Count ${config.rules.traitCount ? 'On' : 'Off'}, Additional Weight ${config.rules.additionalWeight ? 'On' : 'Off'}. Traits are
    fetched from Async Art token page and calculated by frequency (and not by value on token page).
    This may or may not represent an actual rarity for this collection. And traits rarity may not
    matter much anyway, who knows, aesthetics may be more important and people simply buy what they
    like. Anyway, use with own discretion, not financial advice, DYOR, etc.</p>
  <p>I am not an artist or HTML & CSS expert so the styling is rather basic (could use some help
    with that). Also, this is just a quick hack done after having too much
    spare time during covid Christmas. More features could be added to make it even more fun to follow the Grifters...</p>
  <p>Page is updated manually right now, I will try to do it at least once a day. If I get requests for it, I will fix an automatic updater that updateds several times a day.</p>

    <p>
    <a href="https://async.art/blueprints/61b6c374bd2df4be86ef7aa5">Async Art Grifters collection page</a><br>
    <a
      href="https://opensea.io/assets/async-blueprints?search[sortAscending]=true&search[sortBy]=PRICE&search[stringTraits][0][name]=Artist&search[stringTraits][0][values][0]=XCOPY">OpenSea Grifters collection page</a><br>
    <a href="https://xcopy.art/">CryptoArt by XCOPY</a>
    </p>

<!--
  <p>Some links:
  <ul>
    <li><a href="https://async.art/blueprints/61b6c374bd2df4be86ef7aa5">Async Art Grifters collection page</a></li>
    <li><a
      href="https://opensea.io/assets/async-blueprints?search[sortAscending]=true&search[sortBy]=PRICE&search[stringTraits][0][name]=Artist&search[stringTraits][0][values][0]=XCOPY">OpenSea Grifters collection page</a></li>
    <li><a href="https://xcopy.art/">CryptoArt by XCOPY</a></li>
  </ul>
  </p>
  -->
  </div>
  <hr>
  By: <img class="floor-image"
              src="https://lh3.googleusercontent.com/eMVIBIVS1YPB2I6DA9Tc2iQI1JB3Z5lzH29friUD24m0GWc4WytlT91YcMuYx-WQqjOYOyTN-naKjnraAJnP9d91Lb8LZ9wINg5Z=w600">
    <a href="https://async.art/blueprints/61b6c374bd2df4be86ef7aa5/editions/0xc143bbfcdbdbed6d454803804752a064a622c1f3-127" target="_blank">Grifter #126</a> &nbsp; | &nbsp;
    <a href="https://twitter.com/0xHstream" target="_blank">https://twitter.com/0xHstream</a> &nbsp; | &nbsp;
    <a href="mailto:0xHstream@gmail.com" target="_blank">0xHstream@gmail.com</a> &nbsp; | &nbsp;
    <img src="https://hits.seeyoufarm.com/api/count/incr/badge.svg?url=https%3A%2F%2F0xhstream.github.io%2F${filename}&count_bg=%2379C83D&title_bg=%23555555&icon=&icon_color=%23E7E7E7&title=Hits&edge_flat=false"/>


    <!--
    <img src="https://hits.seeyoufarm.com/api/count/incr/badge.svg?url=https%3A%2F%2F0xhstream.github.io%2Fgrifters.html&count_bg=%2379C83D&title_bg=%23555555&icon=&icon_color=%23E7E7E7&title=Hits&edge_flat=false"/>
 -->
  `;
}

async function getFloors(config) {
  log.info('getFloors');
  const allData = config.collection.tokens.sort((a, b) => compareOrderedNum(a.price, b.price, true));
  const buynow = allData.filter(obj => obj.price > 0);

  const floors = [];
  floors.push({ name: 'Grifters Floor', data: buynow[0] ?? { price: -1 } });

  floors.push({
    name: 'Yellow',
    data: allData.find(obj => obj.traits.find(t => t.trait_type === 'Base Color' && t.value === 'Yellow')) ?? { price: -1 }
  });
  floors.push({
    name: 'Green',
    data: allData.find(obj => obj.traits.find(t => t.trait_type === 'Base Color' && t.value === 'Green')) ?? { price: -1 }
  });
  floors.push({
    name: 'Blue',
    data: allData.find(obj => obj.traits.find(t => t.trait_type === 'Base Color' && t.value === 'Blue')) ?? { price: -1 }
  });
  floors.push({
    name: 'Wretch',
    data: allData.find(obj => obj.traits.find(t => t.trait_type === 'Type' && t.value === 'Wretch')) ?? { price: -1 }
  });
  floors.push({
    name: 'Gouge',
    data: allData.find(obj => obj.traits.find(t => t.trait_type === 'Type' && t.value === 'Gouge')) ?? { price: -1 }
  });
  floors.push({
    name: 'Shady',
    data: allData.find(obj => obj.traits.find(t => t.trait_type === 'Type' && t.value === 'Shady')) ?? { price: -1 }
  });
  floors.push({
    name: 'Flimflam',
    data: allData.find(obj => obj.traits.find(t => t.trait_type === 'Type' && t.value === 'Flimflam')) ?? { price: -1 }
  });
  /*
  floors.push({
    name: 'G to the M',
    data: allData.find(obj => obj.traits.find(t => t.trait_type === 'Noise' && t.value === 'G to the M')) ?? { price: -1 }
  });
  floors.push({
    name: 'Bandit Classic',
    data: allData.find(obj => obj.traits.find(t => t.trait_type === 'Vision' && t.value === 'Bandit Classic')) ?? { price: -1 }
  });
  */
  /*
  floors.push({
    name: 'Bubble Royal',
    data: allData.find(obj => obj.traits.find(t => t.trait_type === 'Atmosphere' && t.value === 'Bubble Royal')) ?? { price: -1 }
  });
   */

  floors.push({
    name: 'BAYC',
    data: {
      price: await opensea.getCollectionFloor('boredapeyachtclub', '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d') || config.floors.BAYC,
      imageSrc: 'https://lh3.googleusercontent.com/579Ev4PhcC0a2wYL9nE1npKFLb6DXY3fSc8hAVdVWEBMGNE9xP1WXcNInBAhTF8wsqAWteaYyPNaM39jOIDJsOy-xD5SZyGs-yfWEAc=w343',
      permalink: 'https://opensea.io/collection/boredapeyachtclub'
    }
  });

  floors.push({
    name: 'CryptoPunks',
    data: {
      price: await opensea.getCollectionFloor('cryptopunks', '0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb') || config.floors.CryptoPunks,
      imageSrc: 'https://lh3.googleusercontent.com/_7ly8dF9spUn_DGWi4WEPHONaR6xwEa5TOIoquDu9bKkOFmhpk_vNO_h7a5oAqodn6ydo6Nlm6_dSTldEK17P8PA=w343',
      permalink: 'https://opensea.io/collection/cryptopunks'
    }
  });
  floors.push({
    name: 'Fidenza',
    data: {
      price: await opensea.getCollectionFloor('fidenza-by-tyler-hobbs', '0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270') || config.floors.Fidenza,
      imageSrc: 'https://lh3.googleusercontent.com/FlXb_B2Wi5ZkzsmVN8-UWoBY3vASKmlWUgF5OT_hNrwyHmVC0OYiGVa-2D8KK_nOB5OsxQlLfJwAAmcvWyYXlolcoI7_IpnAl7jcR0Q=w343',
      permalink: 'https://opensea.io/collection/fidenza-by-tyler-hobbs'
    }
  });

  const sortedFloors = floors.sort((a, b) => compareOrderedNum(a.data.price, b.data.price, true));

  return sortedFloors;
}

function createFloor(floor) {
  return 'tbd';

  let html = '';
  const add = (s) => html = html + s;

  const valueFloors = floor.filter(obj => obj.data.price > 0);
  const nonValueFloors = floor.filter(obj => obj.data.price <= 0 || !obj.data.price);

  add('<ul class="cloud" role="navigation">');
  for (let floor of [...valueFloors, ...nonValueFloors]) {
    if (floor.data.price === -1) {
      // continue;
    }
    const price = floor.data.price > 0 ? normalizePrice(floor.data.price) : (floor.data.token_id !== undefined ? 'Not for sale' : 'Floor not found');
    const weight = floor.data.price ? Math.round(floor.data.price) : 0;
    const normalizedWeight = weight > 100 ? 100 : (weight < 0 ? 0 : weight);
    const permalink = floor.data.permalink;
    add(`<li><a target="_blank" href="${permalink}" data-weight="${normalizedWeight.toFixed(0)}"><img class="floor-image" src="${floor.data.imageSrc}"> ${floor.name}: ${price}</a></li>`);
  }
  add('</ul>');

  return html;
}

function normalizeDescription(val) {
  return val.replaceAll('\'', '´');
}

function createThumbImageTitle(token, numTokens) {
  const traits = [...token.traits].sort((a, b) => b.score - a.score);
  const traitsTextBak = traits.map(trait => `${trait.score.toFixed(2)} pts - ${trait.trait_type}: ${trait.value} - ${trait.num_with_this_trait} of ${numTokens} (${normalizePct(trait.freq * 100)}%)`).join('\n');
  const traitsTextBak2 = traits.map(trait => `[${trait.score.toFixed(2)} pts] ${trait.trait_type}: ${trait.value} (${normalizePct(trait.freq * 100)}%)`).join('\n');
  const traitsText3 = traits.map(trait => `${trait.score.toFixed(2)} pts [${normalizePct(trait.freq * 100)}%] ${trait.trait_type}: ${trait.value}`).join('\n');
  const traitsText = traits.map(trait => `${normalizePct(trait.freq * 100)}%   ${trait.trait_type}: ${trait.value}   (${trait.num_with_this_trait} of ${numTokens})   (${trait.score.toFixed(2)} pts)`).join('\n');
  const levelsText = token.levels.map(level => `${level.trait_type}: ${level.value}`).join('\n');
  let s = '';
  s = s + `Name: ${token.name}`;
  s = s + `\n\n`;
  /*
  s = s + `Description: ${normalizeDescription(token.description)}`;
  s = s + `\n\n`;
  */
  s = s + `Token ID: ${token.token_id}`;
  s = s + `\n\n`;
  s = s + `Rarity rank: ${token.scoreRank}`;
  s = s + `\n`;
  s = s + `Top: ${normalizePct(token.score_top * 100, '')}%`;
  s = s + `\n`;
  s = s + `Score: ${token.score.toFixed(2)} pts`;
  s = s + `\n\n`;
  s = s + `TRAITS:`;
  s = s + `\n`;
  s = s + `${traitsText}`;
  s = s + `\n\n`;
  s = s + `\n\n`;
  /*
  s = s + Object.entries(token.tokenURIMetadata)
    .map(([key, value]) => {
      if (typeof value !== 'object') {
        return `${key}: ${value.toString()}`;
      } else {
        return null;
      }
    })
    .filter(obj => obj !== null)
    .join('\n');
   */

  return s;
}

function normalizePrice(val, defaultDecimals = 3, undefinedResult = '', suffix = '') {
  if (typeof val !== 'number') {
    return undefinedResult;
  }

  if (val >= 1000000000) {
    return `${(val / 1000000000).toFixed(0)}G${suffix}`;
  }

  if (val >= 1000000) {
    return `${(val / 1000000).toFixed(0)}M${suffix}`;
  }

  if (val >= 1000) {
    return `${(val / 1000).toFixed(0)}K${suffix}`;
  }

  const textPrice = val.toString(10);
  const textPriceSplit = textPrice.split('.');
  const numDecimals = textPriceSplit.length < 2 ? 0 : textPriceSplit[1].length;

  return `${val.toFixed(numDecimals > 2 ? 2 : numDecimals)}${suffix}`;

  if (val < 1) {
    return `${val.toFixed(defaultDecimals)}${suffix}`;
  }

  if (val < 10) {
    return `${val.toFixed(2)}${suffix}`;
  }

  return `${val.toFixed(2)}${suffix}`;
}

function normalizeNumber(val, undefinedResult = '', suffix = '') {
  return typeof val === 'number' ? `${val.toFixed(0)}${suffix}` : undefinedResult;
}

function normalizeLongDate(val, undefinedResult = '', suffix = '') {
  return (val instanceof Date) ? `${val.toLocaleString()}${suffix}` : undefinedResult;
}

function normalizeShortDate(val, undefinedResult = '', suffix = '') {
  return (val instanceof Date) ? `${val.toLocaleDateString()}${suffix}` : undefinedResult;
}

function normalizePct(val, suffix = '') {
  if (val < 0.1) {
    return `${val.toFixed(2)}${suffix}`;
  } else if (val < 10) {
    return `${val.toFixed(1)}${suffix}`;
  } else {
    return `${val.toFixed(1)}${suffix}`;
  }
}

function normalizeUsernameText(username, maxLength = 15, undefinedResult = '') {
  if (typeof username !== 'string') {
    return undefinedResult;
  }
  if (username.length > maxLength) {
    return `${username.substr(0, maxLength)}...`;
  }
  return username;
}

function normalizeAddressText(address, length = 8, undefinedResult = '') {
  if (typeof address !== 'string') {
    return undefinedResult;
  }
  return `${address.substr(0, length)}...`;
}
