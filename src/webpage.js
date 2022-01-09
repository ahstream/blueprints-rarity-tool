import open from 'open';
import { compileFile } from 'pug';
import TableBuilder from 'table-builder';

import { writeFile } from './hlib/fileutils.js';
import { log } from './hlib/logger.js';

const path = require('path');

const IMAGE_NOT_FOUND_URL = 'https://www.publicdomainpictures.net/pictures/280000/velka/not-found-image-15383864787lu.jpg';

export async function writeFiles(collection, runtime, config) {
  log.info('Write files for collection:', collection.name);

  const baseFilename = normalizeFilename(collection.name);

  const filenames = {
    index: `${baseFilename}.html`,
    price: `${baseFilename}-price.html`,
    daysListed: `${baseFilename}-days-listed.html`,
    lastPrice: `${baseFilename}-last-price.html`,
    lastDays: `${baseFilename}-last-days.html`,
    numSales: `${baseFilename}-num-sales.html`,
    token: `${baseFilename}-token.html`,
  };

  const dataSource = createDataSource(collection, runtime);

  for (let key of Object.keys(filenames)) {
    const filename = filenames[key];
    log.info('Write file:', filename);
    const html = await createPage(collection, dataSource, filename, filenames, config);
    const filepath = path.resolve(global.__datadir, filename);
    writeFile(filepath, html);
  }

  open(path.resolve(global.__datadir, `${baseFilename}.html`), { app: 'chrome' });
}

function normalizeFilename(name) {
  return name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
}

export async function createPage(collection, dataSource, filename, filenames, config) {
  const selectedData = getSelectedData(dataSource, filename);

  const makeHeader = (filename, header, title) => `<a href="./${filename}" title="${title}" class="sort-icon">${header} <i class="fa fa-sort"></i></a>&nbsp;`;

  const headers = {
    'imageHtml': '',
    'nameHtml': 'Name',
    'rankHtml': makeHeader(filenames.index, 'Rarity', 'Sort by rarity rank'),
    'topHtml': 'Top',
    'priceHtml': makeHeader(filenames.price, 'Price', 'Sort by lowest price'),
    'listingDaysHtml': makeHeader(filenames.daysListed, 'Days Listed', 'Sort by most days listed'),
    'lastSalePriceHtml': makeHeader(filenames.lastPrice, 'Last Sale Price', 'Sort by highest last sale price'),
    'lastSaleDaysHtml': makeHeader(filenames.lastDays, 'Last Sale Day', 'Sort by most recent last sale day'),
    'numSalesHtml': makeHeader(filenames.numSales, 'Sales', 'Sort by most sales'),
    'ownerHtml': makeHeader(filenames.owner, 'Owner', 'Sort by most Grifters owned'),
    'openseaHtml': 'Sales Page',
    'homePageHtml': 'Token Page',
    'scoreHtml': 'Score',
    'tokenIdHtml': makeHeader(filenames.token, 'Token ID', 'Sort by token ID'),
  };

  const header = createHeader(collection, dataSource, selectedData, config);
  const footnotes = createFootnotes(config, filename);

  const selectedSortColumnStyleKeys = [
    { f: filenames.index, v: 'rankhtml-th' },
    { f: filenames.price, v: 'pricehtml-th' },
    { f: filenames.daysListed, v: 'listingdayshtml-th' },
    { f: filenames.lastPrice, v: 'lastsalepricehtml-th' },
    { f: filenames.lastDays, v: 'lastsaledayshtml-th' },
    { f: filenames.numSales, v: 'numsaleshtml-th' },
    { f: filenames.owner, v: 'ownerhtml-th' },
    { f: filenames.token, v: 'tokenidhtml-th' }
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

function compareOrderedNum(a, b, ascending) {
  if (typeof a !== 'number' && typeof b !== 'number') {
    return 0;
  }
  if (typeof a !== 'number') {
    return 1;
  }
  if (typeof b !== 'number') {
    return -1;
  }
  if (a === b) {
    return 0;
  }
  return ascending ? a - b : b - a;
}

function compareOrderedString(a, b, ascending) {
  const aUpper = a.toUpperCase();
  const bUpper = b.toUpperCase();
  if (typeof aUpper !== 'string' && typeof bUpper !== 'string') {
    return 0;
  }
  if (typeof aUpper !== 'string') {
    return 1;
  }
  if (typeof bUpper !== 'string') {
    return -1;
  }
  if (aUpper === bUpper) {
    return 0;
  }
  if (ascending) {
    return aUpper > bUpper ? 1 : -1;
  }
  return bUpper > aUpper ? 1 : -1;
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

function createHeader(collection, dataSource, selectedData, config) {
  const modifiedText = collection.modified ? collection.modified.toLocaleString() : 'Unknown';
  const artist = collection.tokens[0].edition_artist;
  const capacity = collection.tokens[0].capacity;
  const editionName = collection.tokens[0].edition_name;
  const editionUrl = collection.tokens[0].edition_url;

  const artistUrl = config.collections[editionName]?.artistUrl ?? null;
  const artistWebPageHtml = artistUrl ? `<a href="${artistUrl}" target="_blank">${artist} Web Page</a>&nbsp;&nbsp;|&nbsp;&nbsp;` : '';

  return `
    <h1>${collection.tokens[0].edition_name} by ${collection.tokens[0].edition_artist}: Rarity Rankings and Other Stats</h1>
        <div class="page-header">
         <form action="#" method="get" id="search-form" name="query"
        onSubmit="var e=document.getElementById(this.gid.value); if (!e) { document.getElementById('search-result').style.visibility='visible'; return false}; document.getElementById('search-result').style.visibility='hidden'; var rect=e.getBoundingClientRect(); window.scroll(0, rect.top); return false;">

         <!-- <div>See disclaimers and notes at <a href="#footnotes">bottom of page</a>.</div> -->
         <div class="edition-image"><img src="${collection.tokens[0].edition_image_url}"></div>

         <div class="">
            ${artistWebPageHtml}
            <a href="${editionUrl}" target="_blank">Collection Web Page</a>&nbsp;&nbsp;|&nbsp;&nbsp;
            <a href="https://async.art/blueprints" target="_blank">Explore Async Art Blueprints</a>&nbsp;&nbsp;|&nbsp;&nbsp;
            <a href="#footnotes">Disclaimers and Notes</a>
            <br><br></div>

         <div class="floor">${createFloor(collection.floors)}</div>

         <div class="search">
         1-${selectedData.length} of ${collection.tokens.length} minted tokens (max capacity: ${capacity}). Updated: ${modifiedText}. Go to Name # or Token ID:
            <input type="text" size="16" name="gid" onfocus='this.value=""' placeholder="#123">
            <span id="search-result" style="visibility: hidden">Not found</span>
        </div>
       <!-- <div>1-${selectedData.length} of ${collection.tokens.length} minted tokens (of total capacity ${capacity}). Updated: <b>${modifiedText}</b></div>-->
        </form>
      </div>`;
}

function createFootnotes(config, filename) {
  return `<div id="footnotes">
  <p><b>DISCLAIMERS AND NOTES:</b></p>
  <p>This web page is not connected to Async Art in any way. It is just a web app set up
    to have more fun following the Async Art Blueprint collections. If people associated with the collection does not
    want the web page to exist for any reason, I will take it down from public access and make it
    private.</p>
  <p>Rarity.tools ranking method used with Trait Normalization ${config.rules.normalize ? 'On' : 'Off'},
    Trait Count ${config.rules.traitCount ? 'On' : 'Off'}, Additional Weight ${config.rules.additionalWeight ? 'On' : 'Off'}.
    Traits are fetched from Async Art token page and calculated by frequency (and not by value on token page).
    This may or may not represent an actual rarity for this collection. And traits rarity may not
    matter much anyway, who knows, aesthetics may be more important and people simply buy what they
    like. Anyway, use with own discretion, not financial advice, DYOR, etc.</p>
  <p>Page is updated manually right now. I might make it automatic some day.</p>
    <!--<br>
    <a
      href="https://opensea.io/assets/async-blueprints?search[sortAscending]=true&search[sortBy]=PRICE&search[stringTraits][0][name]=Artist&search[stringTraits][0][values][0]=XCOPY">OpenSea Grifters collection page</a><br>
    <a href="https://xcopy.art/">CryptoArt by XCOPY</a>-->
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

function createFloor(collectionFloors) {
  let html = '';
  const add = (s) => html = html + s;

  add('<ul class="cloud" role="navigation">');
  for (let floor of collectionFloors) {
    const price = floor.data.price > 0 ? normalizePrice(floor.data.price) : (floor.data.token_id !== undefined ? 'Not for sale' : 'Floor not found');
    const weight = floor.data.price ? Math.round(floor.data.price) : 0;
    const normalizedWeight = weight > 100 ? 100 : (weight < 0 ? 0 : weight);
    const permalink = floor.data.permalink;
    const imageUrl = floor.data.image_thumbnail_url ?? IMAGE_NOT_FOUND_URL;
    add(`<li><a target="_blank" href="${permalink}"><img class="floor-image" src="${imageUrl}"> ${floor.name} Floor: ${price}</a></li>`);
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
