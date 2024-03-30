const { WebTorrent} = require('webtorrent');
const { default: axios } = require("axios");
const { google } = require("googleapis");
const { oauthClient } = require("../gdrive-api/config");
const { getRandomId } = require("../utils");

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

    if (url.startsWith('magnet:?')) {
      // Handle torrent upload
      const client = new WebTorrent();
      client.on('error', (err) => {
        console.error(err);
        return res.json({ success: false, message: err.message });
      });

      client.add(url, async (torrent) => {
        const file = torrent.files[0]; // Assuming we are interested in the first file in the torrent
        const response = await drive.files.create({
          requestBody: {
            name: filename ? `${filename}.${ext}` : file.name,
            mimeType: file.type,
          },
          media: {
            mimeType: file.type,
            body: file.createReadStream(),
          },
        });

        console.log('File uploaded successfully. File ID:', response.data.id);
        client.destroy(); // Clean up
        return res.json({ success: true, url, fileId });
      });
    } else {
      // Handle direct link upload
      const response = await axios.get(url, {
        responseType: "stream",
      });
      const filenameSplitted = url.split("/");
      const ext = filenameSplitted[filenameSplitted.length - 1].split('.').pop();
      const total_length = parseInt(response.headers["content-length"]);

      response.data.on("data", async (chunk) => {
        try {
          length += chunk.length;
          let percentCompleted = Math.floor((length / total_length) * 100);

          fileMeta[fileId].progress = percentCompleted;
          if (percentCompleted === 100) {
            // remove from global state after 30 minutes
            setTimeout(() => {
              delete fileMeta[fileId];
            }, 30 * 60 * 1000);
          }
        } catch (err) {
          console.log(`error while downloading of file: ${url}`)
          console.log(err);
        }
      });

      const uploadResponse = await drive.files.create({
        requestBody: {
          name: filename ? `${filename}.${ext}` : filenameSplitted[filenameSplitted.length - 1],
          mimeType: response.headers["content-type"],
        },
        media: {
          mimeType: response.headers["content-type"],
          body: response.data,
        },
      });

      console.log('File uploaded successfully. File ID:', uploadResponse.data.id);
      return res.json({ success: true, url, fileId });
    }
  } catch (err) {
    console.log("uploadToGDrive: error ", err);
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
