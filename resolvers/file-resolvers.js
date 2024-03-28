const { default: axios } = require("axios");
const { google } = require("googleapis");
const { oauthClient } = require("../gdrive-api/config");
const { getRandomId } = require("../utils");
const ytdl = require("ytdl-core");
const path = require("path");
const WebTorrent = (await import('webtorrent')).default;

async function uploadToGDrive(req, res) {
  const { tokens, url, filename } = req.body;

  try {
    oauthClient.setCredentials(tokens);
    const drive = google.drive({
      version: "v3",
      auth: oauthClient,
    });
    await drive.files.list();

    const fileId = getRandomId();
    fileMeta[fileId] = { progress: 0 };

    let length = 0;
    let total_length = 0;
    let response;
    let fileExtension = '';

    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      // If the URL is a YouTube video
      const videoId = ytdl.getURLVideoID(url);
      const info = await ytdl.getInfo(videoId);
      response = ytdl(url, { quality: 'highestaudio' });
      total_length = info.videoDetails.lengthSeconds * 1000; // Convert seconds to milliseconds
      fileExtension = '.mp4';

      response.on("data", async (chunk) => {
        try {
          length += chunk.length;
          let percentCompleted = Math.floor((length / total_length) * 100);

          console.log("completed: ", percentCompleted);

          fileMeta[fileId].progress = percentCompleted;
          if (percentCompleted === 100) {
            // remove from global state after 30 minutes
            setTimeout(() => {
              delete fileMeta[fileId];
            }, 30 * 60 * 1000);
          }
        } catch (err) {
          console.log(err);
        }
      });
    } else if (url.startsWith("magnet:")) {
      // If the URL is a magnet link
      const client = new WebTorrent();
      
      // Start downloading the torrent
      const torrent = client.add(url);
      
      torrent.on('download', () => {
        total_length = torrent.length;
      });

      response = torrent;

      fileExtension = '.torrent';
    } else {
      // If the URL is a direct link to a file
      const urlPath = new URL(url).pathname;
      fileExtension = path.extname(urlPath);
      response = await axios.get(url, { responseType: "stream" });
      total_length = parseInt(response.headers["content-length"]);
    }

    drive.files.create({
      requestBody: {
        name: filename ? `${filename}${fileExtension}` : `file${fileExtension}`, // Set filename based on provided filename or extract from URL
        mimeType: fileExtension === '.torrent' ? "application/x-bittorrent" : (fileExtension === '.mp4' ? "video/mp4" : response.headers["content-type"]),
      },
      media: {
        mimeType: fileExtension === '.torrent' ? "application/x-bittorrent" : (fileExtension === '.mp4' ? "video/mp4" : response.headers["content-type"]),
        body: response,
      },
    });

    return res.json({ success: true, url, fileId });
  } catch (err) {
    console.log(err);
    return res.json({ success: false, message: err.message });
  }
}

async function getProgress(req, res) {
  const { fileId } = req.query;

  if (!fileId) {
    res.status(400);
    return res.json({
      success: false,
      message: "Request failed! expected fileId is missing.",
    });
  }
  if (fileMeta[fileId]) {
    return res.json({
      success: true,
      progress: fileMeta[fileId].progress,
    });
  }
  res.status(404);
  return res.json({
    success: false,
    message: "file not found",
  });
}

module.exports = {
  uploadToGDrive,
  getProgress,
};
