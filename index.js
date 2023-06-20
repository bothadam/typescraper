import axios from 'axios';
import cheerio from 'cheerio';
import moment from 'moment';
import { google } from 'googleapis';
import { readFile } from 'fs/promises';
import dotenv from 'dotenv';

dotenv.config();

async function loadCredentials() {
  const rawData = await readFile('./credentials.json');
  return JSON.parse(rawData);
}

const privatekey = await loadCredentials();

const firstPageUrl = '?user=bothadam&n=100&startDate=';
const baseUrl = 'https://data.typeracer.com/pit/race_history';
let jwtClient = new google.auth.JWT(privatekey.client_email, null, privatekey.private_key, ['https://www.googleapis.com/auth/spreadsheets']);

const scrapePage = async pageUrl => {
  try {
    const res = await axios.get(pageUrl);

    if (res.status === 200) {
      const pageResults = [];
      const html = res.data;
      const $ = cheerio.load(html);

      $('.Scores__Table__Row').each((i, element) => {
        let date = $(element).find('.profileTableHeaderDate').text().trim();
        date = (date === 'today' ? moment() : moment(date, 'MMM. D YYYY')).format('YYYY-MM-DD');

        let [wpm, gap, accuracy] = $(element).find('.profileTableHeaderRaces').text().trim().split('\n');
        // We only want the words per minute number, so strip away the " WPM" part.
        wpm = wpm.split(' ')[0];

        accuracy = accuracy.trim().split('%')[0];

        pageResults.push([date, parseInt(wpm), parseInt(accuracy)]);
      });
      const olderPageUrl = $('a:contains("load older results")').attr('href');

      if (olderPageUrl) {
        const nextPageResults = await scrapePage(`${baseUrl}${olderPageUrl}`);
        return pageResults.concat(nextPageResults);
      } else {
        return pageResults;
      }
    } else {
      console.log('Failed to retrieve data');
    }
  } catch (e) {
    console.log('error scraping page', pageUrl, '\n', e);
  }
};

const putResultsOnSheet = async results => {
  await jwtClient.authorize();

  const sheetId = process.env.SHEET_ID;
  const spreadsheetId = process.env.SPREADSHEET_ID;

  let requests = [
    {
      updateCells: {
        range: {
          sheetId,
          startRowIndex: 0,
          startColumnIndex: 0,
        },
        fields: '*',
      },
    },
    {
      updateCells: {
        start: {
          sheetId,
          rowIndex: 0,
          columnIndex: 0,
        },
        rows: results.map(row => ({
          values: row.map(cell => ({
            userEnteredValue: typeof cell === 'number' ? { numberValue: cell } : { stringValue: String(cell) },
          })),
        })),
        fields: 'userEnteredValue',
      },
    },
  ];

  let response = await google.sheets('v4').spreadsheets.batchUpdate({
    spreadsheetId,
    resource: {
      requests: requests,
    },
    auth: jwtClient,
  });

  if (response.status == 200) {
    console.log('Done');
  } else {
    console.log('If this happens during a demo it will be awkward');
  }
};

const main = async () => {
  let results = await scrapePage(`${baseUrl}${firstPageUrl}`);
  results = results.reverse().map((res, i) => [i + 1, ...res, Math.floor((i + 1) / 10)]);
  results = [['nr', 'date', 'wmp', 'accuracy', 'group'], ...results];
  putResultsOnSheet(results);
};

main();
