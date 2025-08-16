const express = require("express");
const multer = require("multer");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
const upload = multer({ dest: "uploads/" });

// serve converted files (optional link mode)
app.use("/files", express.static(path.join(__dirname, "public")));

app.post("/convert", upload.single("file"), (req, res) => {
  const targetFormat = (req.body.format || "m4a").toLowerCase();

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded. Send multipart/form-data with field 'file'." });
  }

  const inputPath = req.file.path;
  const base = path.parse(req.file.originalname).name;
  const outName = `${base}.${targetFormat}`;
  const id = uuidv4();
  const outDir = path.join(__dirname, "public");
  const outPath = path.join(outDir, `${id}-${outName}`);

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // default: m4a (aac). You can tweak bitrate/samplerate here.
  const args = [
    "-y",
    "-i", inputPath,
    "-vn",
    "-c:a", targetFormat === "mp3" ? "libmp3lame" : "aac",
    ...(targetFormat === "mp3" ? ["-b:a", "192k"] : ["-b:a", "128k", "-movflags", "+faststart"]),
    outPath
  ];

  const ff = spawn("/usr/bin/ffmpeg", args, { stdio: "inherit" });

  ff.on("close", (code) => {
    // cleanup input asap
    fs.unlink(inputPath, () => {});

    if (code !== 0 || !fs.existsSync(outPath)) {
      return res.status(500).json({ error: "ffmpeg failed" });
    }

    // Two response modes:
    // 1) default: return a JSON link you can fetch (easiest in Zapier)
    // 2) if ?link=0 then stream the binary directly
    const wantLink = req.query.link !== "0";
    const filename = outName;

    if (wantLink) {
      const url = `${req.protocol}://${req.get("host")}/files/${path.basename(outPath)}`;
      return res.json({ url, filename });
    } else {
      res.setHeader("Content-Type", targetFormat === "mp3" ? "audio/mpeg" : "audio/mp4");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      fs.createReadStream(outPath)
        .pipe(res)
        .on("close", () => fs.unlink(outPath, () => {}));
    }
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`FFmpeg API running on port ${port}`);
});
