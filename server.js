require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse");
const { stringify } = require("csv-stringify");

// Increase Node.js memory limit
const v8 = require('v8');
v8.setFlagsFromString('--max-old-space-size=4096'); // 4GB memory limit

const app = express();
const port = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";
const allowedOrigin = process.env.ALLOWED_ORIGIN || "https://csv-filter.marketsurge.io";
const maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 500 * 1024 * 1024; // 500MB default

// Increase express limits
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// Configure CORS
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      allowedOrigin,
      'http://localhost:3000',
      'https://csv-filter.marketsurge.io',
      'http://csv-filter.marketsurge.io'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["Content-Disposition"],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400
}));

// Add explicit OPTIONS handler for preflight requests
app.options('*', cors());

// Configure Helmet with less restrictive settings
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "unsafe-none" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", allowedOrigin, "http://localhost:3000"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", allowedOrigin, "http://localhost:3000"],
      frameAncestors: ["'self'", allowedOrigin, "http://localhost:3000"]
    }
  }
}));

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configure multer for file uploads
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: maxFileSize },
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    }
  })
});

// Health check endpoint
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>CSV Filter API</title>
      <style>
        body { font-family: Arial, sans-serif; background: #f9f9f9; color: #222; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 60px auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.07); padding: 32px; }
        h1 { color: #2a7ae2; }
        a { color: #2a7ae2; text-decoration: none; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Welcome to the CSV Filter API</h1>
        <p>This API powers the CSV file filtering and reduction service.</p>
        <ul>
          <li>Upload and filter large CSV files</li>
          <li>Download filtered results</li>
          <li>Secure and scalable</li>
        </ul>
        <p>To use the web interface, visit:<br>
          <a href="https://csv-filter.marketsurge.io" target="_blank">csv-filter.marketsurge.io</a>
        </p>
        <hr>
        <p style="font-size:0.9em;color:#888;">&copy; 2024 MarketSurge CSV Filter</p>
      </div>
    </body>
    </html>
  `);
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "ok",
    environment: process.env.NODE_ENV,
    port: process.env.PORT || 3000,
    frontendUrl: process.env.FRONTEND_URL
  });
});

// Get CSV headers endpoint
app.post("/api/get-headers", upload.single("file"), (req, res) => {
  console.log('Headers:', req.headers);
  console.log('Origin:', req.headers.origin);
  console.log('Host:', req.headers.host);
  console.log('URL:', req.url);
  console.log('Method:', req.method);
  
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const filePath = req.file.path;
  const parser = fs.createReadStream(filePath).pipe(parse({ to_line: 1 }));

  parser.on("data", (row) => {
    fs.unlink(filePath, () => {});
    res.json({ headers: row });
  });

  parser.on("error", (err) => {
    fs.unlink(filePath, () => {});
    res.status(500).json({ error: "Failed to parse CSV" });
  });
});

// Process CSV endpoint
app.post("/api/process-csv", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const { columnsToFilter } = req.body;
  if (!columnsToFilter) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: "No columns specified" });
  }

  let selectedColumns;
  try {
    selectedColumns = JSON.parse(columnsToFilter);
  } catch {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: "Invalid columns format" });
  }

  const outputPath = path.join(uploadDir, `filtered-${Date.now()}.csv`);
  const readStream = fs.createReadStream(req.file.path, { highWaterMark: 64 * 1024 });
  const parser = parse({
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true
  });
  const stringifier = stringify();
  const writeStream = fs.createWriteStream(outputPath, { highWaterMark: 64 * 1024 });
  let headerRow;

  parser.on("readable", () => {
    let record;
    while ((record = parser.read()) !== null) {
      if (!headerRow) {
        headerRow = record;
        stringifier.write(headerRow);
      } else {
        const keepRow = selectedColumns.every(col => {
          const idx = headerRow.indexOf(col);
          return idx !== -1 && record[idx] && record[idx].trim() !== '';
        });
        if (keepRow) {
          stringifier.write(record);
        }
      }
    }
  });

  parser.on("error", (err) => {
    fs.unlink(req.file.path, () => {});
    fs.unlink(outputPath, () => {});
    res.status(500).json({ error: "Failed to process CSV" });
  });

  parser.on("end", () => {
    fs.unlink(req.file.path, () => {});
    stringifier.end();
  });

  stringifier.pipe(writeStream);
  readStream.pipe(parser);

  writeStream.on("finish", () => {
    res.download(outputPath, "filtered.csv", (err) => {
      fs.unlink(outputPath, () => {});
      if (err) {
        res.status(500).json({ error: "Failed to send file" });
      }
    });
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: "Something broke!",
    message: err.message,
    type: err.name
  });
});

// Start server
app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Allowed origin: ${allowedOrigin}`);
  console.log(`Max file size: ${maxFileSize / (1024 * 1024)}MB`);
});
