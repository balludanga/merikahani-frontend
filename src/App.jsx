import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Editor from './pages/Editor';
import PostView from './pages/PostView';
import UserProfile from './pages/UserProfile';
import './App.css';

const App = () => {
  return (
    <AuthProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <div className="app">
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Login />} />
            <Route path="/new-story" element={<Editor />} />
            <Route path="/edit/:id" element={<Editor />} />
            <Route path="/post/:slug" element={<PostView />} />
            <Route path="/user/:userId" element={<UserProfile />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;