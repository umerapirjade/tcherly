const https = require("https");
const Youtube = require("simple-youtube-api");

const apiKey = process.env.GOOGLE_API_KEY;
const hasApiKey = !!apiKey && !apiKey.startsWith("<");
const youtube = hasApiKey ? new Youtube(apiKey) : null;

const fetchText = (url) =>
  new Promise((resolve, reject) => {
    const { hostname, pathname, search } = new URL(url);
    const headers = { "User-Agent": "Mozilla/5.0", "Accept-Language": "en" };
    https
      .get({ hostname, path: pathname + search, headers }, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve(body));
      })
      .on("error", reject);
  });

// Fallback used when GOOGLE_API_KEY is not configured (e.g. local development)
const scrapeDuration = async (link) => {
  const { video: id } = Youtube.util.parseURL(link) || {};
  if (!id) throw new Error("Invalid YouTube link.");
  const html = await fetchText(`https://www.youtube.com/watch?v=${id}`);
  const match = html.match(/"lengthSeconds":"(\d+)"/);
  if (!match) throw new Error("Could not determine video duration. Set GOOGLE_API_KEY in .env.");
  return parseInt(match[1], 10);
};

const getVideoDuration = async (link) => {
  if (youtube) {
    const { durationSeconds } = await youtube.getVideo(link);
    return durationSeconds;
  }
  return scrapeDuration(link);
};

module.exports = { youtube, getVideoDuration };
