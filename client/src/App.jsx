import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RiwayatSampah from './pages/RiwayatSampah';
import './index.css';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        {/* Default Route*/}
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* Public Route */}
        {/* Login */}
        <Route path="/login" element={<Login />} /> 
        
        {/* Protected Routes */}
        {/* Dashboard Route */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        {/* Riwayat Sampah Route*/}
        <Route 
          path="/riwayat" 
          element={
            <ProtectedRoute>
              <RiwayatSampah />
            </ProtectedRoute>
          } 
        />

      </Routes>
    </Router>
  );
}

export default App;