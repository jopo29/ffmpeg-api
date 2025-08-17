// server.js
// Simple Express API: POST /convert (multipart) → AMR to M4A

const express = require("express");
const fileUpload = require("express-fileupload");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const app = express();

// Paths for converted files
const PUBLIC_DIR = path.join(__dirname, "public");
const CONVERTED_DIR = path.join(PUBLIC_DIR, "converted");
if (!fs.existsSync(CONVERTED_DIR)) fs.mkdirSync(CONVERTED_DIR, { recursive: true });

// Serve converted files publicly
app.use("/files", express.static(CONVERTED_DIR));

// Enable file uploads
app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp",
    createParentPath: true,
  })
);

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true, message: "FFmpeg API healthy" });
});

// Convert endpoint
app.post("/convert", async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ ok: false, error: "Missing 'file' upload." });
    }

    const uploaded = req.files.file;
    if (!/\.amr$/i.test(uploaded.name)) {
      return res.status(400).json({ ok: false, error: "Only .amr input is supported." });
    }

    const outName = uuidv4() + ".m4a";
    const outPath = path.join(CONVERTED_DIR, outName);

    await new Promise((resolve, reject) => {
      ffmpeg(uploaded.tempFilePath)
        .noVideo()
        .audioCodec("aac")
        .audioBitrate("128k")
        .outputOptions(["-movflags +faststart"])
        .on("error", reject)
        .on("end", resolve)
        .save(outPath);
    });

    const publicUrl = `${req.protocol}://${req.get("host")}/files/${outName}`;
    res.json({
      ok: true,
      input: uploaded.name,
      output: outName,
      m4a_url: publicUrl,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on ${PORT}`));
