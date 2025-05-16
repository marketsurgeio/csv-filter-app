# CSV File Filter Application

A web application that allows users to upload large CSV files, filter out rows based on empty columns, and download the filtered results.

## Features

- Drag and drop CSV file upload
- Automatic column header detection
- Multi-select column filtering
- Efficient processing of large files using streams
- Modern, responsive UI
- Automatic file cleanup after processing

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Setup

1. Install backend dependencies:
```bash
npm install
```

2. Install frontend dependencies:
```bash
cd frontend
npm install
```

## Running the Application

1. Start the backend server (from the root directory):
```bash
npm run dev
```

2. Start the frontend development server (from the frontend directory):
```bash
cd frontend
npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

## Usage

1. Drag and drop a CSV file onto the upload area or click to select a file
2. Once the file is uploaded, select the columns you want to filter
3. Click "Process File" to filter the CSV
4. The filtered file will automatically download

## Notes

- The application uses streams to handle large files efficiently
- Temporary files are automatically cleaned up after processing
- Only CSV files are accepted
- The application will remove rows where any of the selected columns have empty values 