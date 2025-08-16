const express = require("express");
const multer = require("multer");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
const upload = multer({ dest: "uploads/" });

// Serve converted files
app.use("/files", express.static(path.join(__dirname, "public")));

app.post("/convert", upload.single("file"), (req, res) => {
  const targetFormat = (req.body.format || "m4a").toLowerCase();

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded. Use field 'file'." });
  }

  const inputPath = req.file.path;
  const baseName = path.parse(req.file.originalname).name;
  const id = uuidv4();
  const outDir = path.join(__dirname, "public");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, `${id}-${baseName}.${targetFormat}`);

  // Run FFmpeg
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
    fs.unlink(inputPath, () => {}); // clean input
    if (code !== 0 || !fs.existsSync(outPath)) {
      return res.status(500).json({ error: "FFmpeg failed" });
    }
    const url = `${req.protocol}://${req.get("host")}/files/${path.basename(outPath)}`;
    res.json({ url, filename: path.basename(outPath) });
  });
});

// ✅ Use Railway port
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`FFmpeg API running on port ${PORT}`);
});
