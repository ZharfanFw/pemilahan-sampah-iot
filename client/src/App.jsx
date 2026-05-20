import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard'; // Buat file dummy dulu untuk halaman ini
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        {/* Jalur Default langsung diarahkan ke login atau dashboard */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* Jalur Public */}
        <Route path="/login" element={<Login />} />
        
        {/* Jalur Private (Diproteksi) */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;