const { default: axios } = require("axios");
const { google } = require("googleapis");
const { oauthClient } = require("../gdrive-api/config");
const { getRandomId } = require("../utils");
const ytdl = require("ytdl-core");
const path = require("path");

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

    if (url.includes("youtube.com")) {
      // If the URL is a YouTube video
      const info = await ytdl.getInfo(url);
      response = ytdl(url, { quality: 'highestaudio' });
      total_length = info.videoDetails.lengthSeconds * 1000; // Convert seconds to milliseconds
      fileExtension = '.mp4';
    } else {
      // If the URL is a direct link to a file
      const urlPath = new URL(url).pathname;
      fileExtension = path.extname(urlPath);
      response = await axios.get(url, { responseType: "stream" });
      total_length = parseInt(response.headers["content-length"]);
    }

    response.data.on("data", async (chunk) => {
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

    drive.files.create({
      requestBody: {
        name: filename ? `${filename}${fileExtension}` : path.basename(url), // Set filename based on provided filename or extract from URL
        mimeType: "video/mp4",
      },
      media: {
        mimeType: "video/mp4",
        body: response.data,
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

module.exports = {
  uploadToGDrive,
  getProgress,
};
