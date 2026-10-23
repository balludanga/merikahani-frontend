import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updateMetaTags } from '../utils/seo';
import ProfileLibrary from '../components/ProfileLibrary';
import './UserProfile.css';

/** Every passage the signed-in reader has highlighted, grouped by story, each linking back to its place. */
const Highlights = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login');
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    updateMetaTags({
      title: 'मेरी हाइलाइट',
      description: 'लेखनी पर आपके द्वारा हाइलाइट किए गए अंश।',
      type: 'website',
      noindex: true,
    });
  }, []);

  if (authLoading || !isAuthenticated) return <div className="page-loading">लोड हो रहा है…</div>;

  return (
    <div className="user-profile">
      <div className="user-profile-container">
        <div className="user-posts">
          <h2>मेरी हाइलाइट</h2>
          <p className="library-note">पढ़ते समय चुने हुए अंश। किसी अंश पर दबाएँ, कहानी में वही जगह खुलेगी।</p>
          <ProfileLibrary tab="highlights" />
        </div>
      </div>
    </div>
  );
};

export default Highlights;
