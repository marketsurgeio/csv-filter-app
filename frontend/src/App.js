import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import axios from 'axios';

const API_URL = "https://csv-filter.marketsurge.io"; // Updated API endpoint for production

function App() {
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [authDialogOpen, setAuthDialogOpen] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState(false);

  // Configure axios with auth
  const configureAxios = (user, pass) => {
    axios.defaults.auth = {
      username: user,
      password: pass
    };
  };

  const handleAuthSubmit = () => {
    configureAxios(username, password);
    setAuthDialogOpen(false);
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    const uploadedFile = acceptedFiles[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', uploadedFile);

    try {
      const response = await axios.post(`${API_URL}/get-headers`, formData);
      setHeaders(response.data.headers);
    } catch (err) {
      if (err.response && err.response.status === 401) {
        setAuthError(true);
        setAuthDialogOpen(true);
      } else {
        setError('Error processing file. Please try again.');
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
    },
    multiple: false,
  });

  const handleColumnChange = (event) => {
    setSelectedColumns(event.target.value);
  };

  const handleProcessFile = async () => {
    if (!file || selectedColumns.length === 0) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('columnsToFilter', JSON.stringify(selectedColumns));

    try {
      const response = await axios.post(`${API_URL}/process-csv`, formData, {
        responseType: 'blob',
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'filtered.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Error processing file. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md">
      <Dialog open={authDialogOpen} onClose={() => {}}>
        <DialogTitle>Authentication Required</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Username"
            type="text"
            fullWidth
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <TextField
            margin="dense"
            label="Password"
            type="password"
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {authError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Invalid username or password
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleAuthSubmit} color="primary">
            Login
          </Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          CSV File Filter
        </Typography>

        <Paper
          {...getRootProps()}
          sx={{
            p: 3,
            mb: 3,
            textAlign: 'center',
            cursor: 'pointer',
            bgcolor: isDragActive ? 'action.hover' : 'background.paper',
            border: '2px dashed',
            borderColor: isDragActive ? 'primary.main' : 'grey.300',
          }}
        >
          <input {...getInputProps()} />
          <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
          <Typography>
            {isDragActive
              ? 'Drop the CSV file here'
              : 'Drag and drop a CSV file here, or click to select'}
          </Typography>
        </Paper>

        {file && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Selected file: {file.name}
            </Typography>

            <Button
              variant="outlined"
              color="secondary"
              sx={{ mb: 2 }}
              onClick={() => {
                setFile(null);
                setHeaders([]);
                setSelectedColumns([]);
                setError(null);
              }}
            >
              Remove
            </Button>

            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Select columns to filter (rows with empty values in these columns will be removed)</InputLabel>
              <Select
                multiple
                value={selectedColumns}
                onChange={handleColumnChange}
                label="Select columns to filter"
              >
                {headers.map((header) => (
                  <MenuItem key={header} value={header}>
                    {header}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              variant="contained"
              onClick={handleProcessFile}
              disabled={loading || selectedColumns.length === 0}
              sx={{ mt: 2 }}
            >
              {loading ? <CircularProgress size={24} /> : 'Process File'}
            </Button>
          </Paper>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Box>
    </Container>
  );
}

export default App; 