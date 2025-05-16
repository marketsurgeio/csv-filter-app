const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { parse } = require('csv-parse');
const { stringify } = require('csv-stringify');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Middleware
app.use(cors({
  origin: isProduction ? process.env.FRONTEND_URL : 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Configure multer for file upload with increased limits
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 1024 * 1024 * 500, // 500MB limit
  }
});

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Endpoint to get CSV headers
app.post('/api/get-headers', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const headers = [];
  const parser = parse({
    columns: true,
    skip_empty_lines: true,
    trim: true,
    max_record_size: 1024 * 1024 // 1MB per record
  });

  fs.createReadStream(req.file.path)
    .pipe(parser)
    .on('data', (row) => {
      if (headers.length === 0) {
        headers.push(...Object.keys(row));
      }
    })
    .on('end', () => {
      // Clean up the uploaded file
      fs.unlinkSync(req.file.path);
      res.json({ headers });
    })
    .on('error', (error) => {
      console.error('Error processing headers:', error);
      res.status(500).json({ error: 'Error processing file headers' });
    });
});

// Endpoint to process CSV file
app.post('/api/process-csv', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { columnsToFilter } = req.body;
  const filterColumns = JSON.parse(columnsToFilter);

  const outputPath = path.join('uploads', `filtered_${Date.now()}.csv`);
  const outputStream = fs.createWriteStream(outputPath);

  const parser = parse({
    columns: true,
    skip_empty_lines: true,
    trim: true,
    max_record_size: 1024 * 1024 // 1MB per record
  });

  // Get all columns from the first row
  let allColumns = null;
  const stringifier = stringify({
    header: true
  });

  let isFirstRow = true;
  let rowCount = 0;

  fs.createReadStream(req.file.path)
    .pipe(parser)
    .on('data', (row) => {
      // Store all columns from the first row
      if (isFirstRow) {
        allColumns = Object.keys(row);
        isFirstRow = false;
      }

      // Check if any of the specified columns are empty
      const shouldKeep = !filterColumns.some(col => !row[col] || row[col].trim() === '');
      if (shouldKeep) {
        stringifier.write(row);
        rowCount++;
      }
    })
    .on('end', () => {
      stringifier.end();
      stringifier.pipe(outputStream);
      
      outputStream.on('finish', () => {
        res.download(outputPath, 'filtered.csv', (err) => {
          if (err) {
            console.error('Error sending file:', err);
          }
          // Clean up files
          try {
            fs.unlinkSync(req.file.path);
            fs.unlinkSync(outputPath);
          } catch (cleanupErr) {
            console.error('Error cleaning up files:', cleanupErr);
          }
        });
      });
    })
    .on('error', (error) => {
      console.error('Error processing file:', error);
      res.status(500).json({ error: 'Error processing file' });
      // Clean up files on error
      try {
        fs.unlinkSync(req.file.path);
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
      } catch (cleanupErr) {
        console.error('Error cleaning up files:', cleanupErr);
      }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum size is 500MB.' });
    }
    return res.status(400).json({ error: 'File upload error' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 