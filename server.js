const express = require("express");
const fileUpload = require("express-fileupload");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(fileUpload());

// Ensure a temp directory exists
const TEMP_DIR = "/tmp";
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

// Convert endpoint
app.post("/convert", async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ status: "error", message: "No file uploaded" });
    }

    const amrFile = req.files.file;
    const format = req.body.format || "m4a";
    const tempInput = path.join(TEMP_DIR, `${uuidv4()}.amr`);
    const tempOutput = path.join(TEMP_DIR, `${uuidv4()}.${format}`);

    // Save uploaded file to temp
    await amrFile.mv(tempInput);

    // Convert using ffmpeg
    ffmpeg(tempInput)
      .toFormat(format)
      .on("error", (err) => {
        console.error("Conversion error:", err);
        res.status(500).json({ status: "error", message: "Conversion failed", error: err.message });
        fs.unlinkSync(tempInput);
      })
      .on("end", () => {
        // Return the file as base64 (or you can integrate a public storage later)
        const data = fs.readFileSync(tempOutput);
        const base64File = Buffer.from(data).toString("base64");

        // Clean up temp files
        fs.unlinkSync(tempInput);
        fs.unlinkSync(tempOutput);

        res.json({
          status: "success",
          format: format,
          file_base64: base64File
        });
      })
      .save(tempOutput);
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Server error", error: err.message });
  }
});

// Listen on Railway's assigned port
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
