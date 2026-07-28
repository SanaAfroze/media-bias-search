import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import './App.css';
import PinkLoadingBarAnimation from './PinkLoadingBarAnimation';

// PYTHONANYWHERE URL IN PRODUCTION
const API_BASE = "https://sanaafroze2.pythonanywhere.com";
// const API_BASE = "http://localhost:5002";

// Axios interceptor - attaches auth token to every request automatically
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = token;
  }
  return config;
});

function App() {
  const [query, setQuery] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const lastMonth = new Date(
    new Date().setDate(new Date().getDate() - 28)
  ).toISOString().split('T')[0];

  const [fromDate, setFromDate] = useState(lastMonth);
  const [toDate, setToDate] = useState(today);

  // States for Progressive Loading
  const [hasSearched, setHasSearched] = useState(false);
  const [isBasicLoading, setIsBasicLoading] = useState(false);
  const [isDeepLoading, setIsDeepLoading] = useState(false);

  const [basicData, setBasicData] = useState(null);
  const [deepData, setDeepData] = useState(null);
  const [showDeepAnalysis, setShowDeepAnalysis] = useState(false);

  const [error, setError] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Auth & Profile States
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'signup' or 'login'
  const [userProfile, setUserProfile] = useState({
    name: '',
    gender: '',
    age: '',
    politicalSpectrum: '',
    email: '',
    password: '',
    wantsLocalStorage: false
  });
  const [, setIsProfileSaved] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [authToken, setAuthToken] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState(null);

  // On app load - restore session if token exists in localStorage
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const savedName = localStorage.getItem('userName');
    if (token) {
      setAuthToken(token);
      setIsLoggedIn(true);
      if (savedName) setLoggedInUser(savedName);
    }
  }, []);

  // --- SEARCH FUNCTIONS ---

  const performSearch = async (searchTerm, forceExact = false) => {
    if (!searchTerm) return;

    setHasSearched(true);
    setIsBasicLoading(true);
    setIsDeepLoading(true);
    setShowDeepAnalysis(false);
    setBasicData(null);
    setDeepData(null);
    setError(null);
    setIsSaved(false);

    try {
      const basicResponse = await axios.post(`${API_BASE}/api/basic_analysis`, {
        topic: searchTerm,
        from_date: fromDate,
        to_date: toDate,
        force_exact: forceExact
      });

      const data = basicResponse.data;

      // Handle DB Cache Hit
      if (data.is_cached) {
        setBasicData({
          analysis: {
            arguments_in_favor: data.full_report.analysis.arguments_in_favor,
            arguments_opposed: data.full_report.analysis.arguments_opposed
          },
          metadata: data.full_report.metadata,
          sources: data.full_report.sources
        });
        setDeepData(data.full_report.analysis.perspectives);
        setIsBasicLoading(false);
        setIsDeepLoading(false);
        setIsSaved(true);
        return;
      }

      // Handle Fresh Search
      setBasicData(data);
      if (data.metadata) {
        setFromDate(data.metadata.from_date);
        setToDate(data.metadata.to_date);
      }
      setIsBasicLoading(false);

      // Pass arguments to Python for random shuffling and assignment
      fetchDeepAnalysis(data.context_text, data.basic_analysis);

    } catch (err) {
      console.error(err);
      setError("Analysis failed. No articles found or server error.");
      setIsBasicLoading(false);
      setIsDeepLoading(false);
    }
  };

  const fetchDeepAnalysis = async (contextText, basicAnalysis) => {
    try {
      const response = await axios.post(`${API_BASE}/api/deep_analysis`, {
        context_text: contextText,
        // Send all 4 arguments of each type to Python
        // Python randomly shuffles and assigns them per perspective
        arguments_in_favor: basicAnalysis?.arguments_in_favor || [],
        arguments_opposed: basicAnalysis?.arguments_opposed || []
      });
      setDeepData(response.data.perspectives);
    } catch (err) {
      console.error("Deep analysis failed:", err);
    } finally {
      setIsDeepLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    performSearch(query, false);
  };

  const handleOverride = () => {
    if (basicData && basicData.metadata.original_query) {
      setQuery(basicData.metadata.original_query);
      performSearch(basicData.metadata.original_query, true);
    }
  };

  // --- SAVE REPORT ---

  const handleSave = async () => {
    if (!basicData || !deepData) return;
    setIsSaving(true);

    const fullReportToSave = {
      analysis: {
        arguments_in_favor: basicData.analysis
          ? basicData.analysis.arguments_in_favor
          : basicData.basic_analysis.arguments_in_favor,
        arguments_opposed: basicData.analysis
          ? basicData.analysis.arguments_opposed
          : basicData.basic_analysis.arguments_opposed,
        perspectives: deepData
      },
      metadata: basicData.metadata,
      sources: basicData.sources || basicData.scraped_data
    };

    try {
      await axios.post(`${API_BASE}/api/save`, {
        topic: basicData.metadata.topic,
        from_date: basicData.metadata.from_date,
        to_date: basicData.metadata.to_date,
        report_data: fullReportToSave
      });
      setIsSaved(true);
    } catch (err) {
      console.error("Save error:", err);
      alert("Save failed. Check if the report already exists.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- PROFILE & AUTH FUNCTIONS ---

  const handleProfileChange = (field, value) => {
    setUserProfile(prev => ({ ...prev, [field]: value }));
  };

  const openProfileModal = () => {
    if (isLoggedIn) {
      setAuthMode('loggedin');
    } else {
      setAuthMode('login'); // Show Sign In first by default
    }
    setShowProfileModal(true);
  };

  const handleProfileSave = async () => {
    // Validate ALL fields are mandatory
    if (!userProfile.name.trim()) {
      alert('Full name is required!');
      return;
    }
    if (!userProfile.gender) {
      alert('Please select your gender!');
      return;
    }
    if (!userProfile.age) {
      alert('Age is required!');
      return;
    }
    if (!userProfile.politicalSpectrum) {
      alert('Please select your political spectrum position!');
      return;
    }
    if (!userProfile.email.trim()) {
      alert('Email address is required!');
      return;
    }
    if (!userProfile.password || userProfile.password.length < 6) {
      alert('Password must be at least 6 characters!');
      return;
    }
  
    try {
      const response = await axios.post(`${API_BASE}/api/profile/save`, userProfile);
  
      if (response.data.status === 'success') {
        const token = response.data.token;
        setAuthToken(token);
        setIsLoggedIn(true);
        setLoggedInUser(response.data.name);
        setIsProfileSaved(true);
  
        localStorage.setItem('authToken', token);
        localStorage.setItem('userName', response.data.name);
  
        if (userProfile.wantsLocalStorage) {
          localStorage.setItem('userProfile', JSON.stringify({
            name: userProfile.name,
            email: userProfile.email
          }));
        } else {
          localStorage.removeItem('userProfile');
        }
  
        setShowProfileModal(false);
        alert(response.data.message);
      }
    } catch (err) {
      console.error('Profile save error:', err);
      if (err.response?.data?.error) {
        alert(err.response.data.error);
      } else {
        alert('Failed to save profile. Please try again.');
      }
    }
  };

  const handleLogin = async () => {
    if (!userProfile.email.trim() || !userProfile.password.trim()) {
      alert('Email and password are required!');
      return;
    }

    try {
      const response = await axios.post(`${API_BASE}/api/auth/login`, {
        email: userProfile.email,
        password: userProfile.password
      });

      const token = response.data.token;
      setAuthToken(token);
      setIsLoggedIn(true);
      setLoggedInUser(response.data.name);

      localStorage.setItem('authToken', token);
      localStorage.setItem('userName', response.data.name);

      // Only store locally if user previously opted in
      if (response.data.wants_local_storage) {
        localStorage.setItem('userProfile', JSON.stringify({
          name: response.data.name,
          email: userProfile.email
        }));
      }

      setShowProfileModal(false);
      alert(`Welcome back, ${response.data.name}!`);

    } catch (err) {
      console.error('Login error:', err);
      if (err.response?.data?.error) {
        alert(err.response.data.error);
      } else {
        alert('Login failed. Please check your credentials.');
      }
    }
  };

  const handleDeleteProfile = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete your account? This action cannot be undone.'
    );
    if (!confirmed) return;

    try {
      await axios.post(`${API_BASE}/api/profile/delete`);

      localStorage.removeItem('authToken');
      localStorage.removeItem('userName');
      localStorage.removeItem('userProfile');

      setUserProfile({
        name: '', gender: '', age: '',
        politicalSpectrum: '', email: '',
        password: '',
        wantsLocalStorage: false
      });
      setIsProfileSaved(false);
      setIsLoggedIn(false);
      setAuthToken(null);
      setLoggedInUser(null);
      setShowProfileModal(false);

      alert('Account deleted successfully');
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete account. Please try again.');
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${API_BASE}/api/auth/logout`);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Always clear local state even if API call fails
      localStorage.removeItem('authToken');
      localStorage.removeItem('userName');
      localStorage.removeItem('userProfile');
  
      setAuthToken(null);
      setIsLoggedIn(false);
      setLoggedInUser(null);
      setIsProfileSaved(false);
      setUserProfile({
        name: '', gender: '', age: '',
        politicalSpectrum: '', email: '',
        password: '',
        wantsLocalStorage: false
      });
      setShowProfileModal(false);
      alert('You have been signed out.');
    }
  };

  // Helper to access arguments from both fresh and cached response structures
  const argumentsInFavorList =
    basicData?.analysis?.arguments_in_favor ||
    basicData?.basic_analysis?.arguments_in_favor || [];
  const argumentsOpposedList =
    basicData?.analysis?.arguments_opposed ||
    basicData?.basic_analysis?.arguments_opposed || [];

  return (
    <div className="app-container">
      <motion.div
        className={`search-wrapper ${hasSearched ? 'top-bar' : 'centered'}`}
        layout
        transition={{ type: "spring", stiffness: 60, damping: 20 }}
      >
        <h1 className={hasSearched ? 'logo-small' : 'logo-large'}>
          Media<span className="accent">Truth</span>
        </h1>

        <div className="search-bar-row">
          <form onSubmit={handleSearch} className="search-form">
            <div className="search-capsule">
              <div className="capsule-section topic-section">
                <span className="icon">🔍</span>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter Topic..."
                  className="capsule-input"
                />
              </div>
              <div className="capsule-divider"></div>
              <div className="capsule-section date-section">
                <span className="icon">📅</span>
                <div className="date-inputs">
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="capsule-date"
                  />
                  <span className="date-arrow">→</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="capsule-date"
                  />
                </div>
              </div>
              <button type="submit" className="capsule-btn">Analyze</button>
            </div>
          </form>

          {/* Sign In / Profile button always visible next to search */}
          <button
            className="profile-btn"
            onClick={openProfileModal}
            title="User Profile"
          >
            {isLoggedIn ? `👤 ${loggedInUser}` : '🔐 Sign In'}
          </button>
        </div>

      </motion.div>
      <div className="content-area">
        {isBasicLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <PinkLoadingBarAnimation />
          </motion.div>
        )}

        {error && <div className="error-msg">{error}</div>}

        {basicData && basicData.metadata.corrected_query && (
          <div className="correction-container">
            <div className="correction-line">
              <span className="correction-label">Showing results for </span>
              <strong className="corrected-term">
                {basicData.metadata.corrected_query}
              </strong>
            </div>
            <div className="correction-line sub-line">
              <span className="correction-label">Search instead for </span>
              <button className="override-link" onClick={handleOverride}>
                {basicData.metadata.original_query}
              </button>
            </div>
          </div>
        )}

        {basicData && !isBasicLoading && (
          <motion.div
            className="report-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="report-header-row">
              <div className="header-titles">
                <h2>Executive Summary: {basicData.metadata.topic}</h2>
                <div className="meta-badge">
                  📅 {basicData.metadata.from_date} to {basicData.metadata.to_date}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className={`save-action-btn ${isSaved ? 'saved' : ''}`}
                  onClick={handleSave}
                  disabled={isSaved || isSaving || !deepData}
                >
                  {isSaving ? 'Saving...' : isSaved ? '✅ Saved' : '💾 Save'}
                </button>
              </div>
            </div>

            <div className="grid-2">
              <div className="card adv">
                <h3>Arguments in Favor</h3>
                {argumentsInFavorList.map((item, idx) => (
                  <div key={idx} className="point-item">
                    <h4>{item.heading}</h4>
                    <p>{item.context}</p>
                    <CitationList names={item.cited_sources} />
                  </div>
                ))}
              </div>
              <div className="card dis">
                <h3>Arguments Opposed</h3>
                {argumentsOpposedList.map((item, idx) => (
                  <div key={idx} className="point-item">
                    <h4>{item.heading}</h4>
                    <p>{item.context}</p>
                    <CitationList names={item.cited_sources} />
                  </div>
                ))}
              </div>
            </div>

            {!showDeepAnalysis ? (
              <div className="reveal-container">
                <button
                  className="reveal-btn"
                  onClick={() => setShowDeepAnalysis(true)}
                >
                  Analyze Political Spectrum
                </button>
                {isDeepLoading && (
                  <span className="reveal-status">
                    Generating in background...
                  </span>
                )}
                {!isDeepLoading && (
                  <span className="reveal-status complete">
                    Analysis Ready
                  </span>
                )}
              </div>
            ) : (
              <motion.div
                className="deep-results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h2 className="spec-title">Political Spectrum Analysis</h2>

                {isDeepLoading ? (
                  <div className="loader secondary">
                    Generating Political Perspectives...
                  </div>
                ) : (
                  deepData && (
                    <div className="spectrum-list">
                      <SpectrumRow label="Extreme Left" data={deepData.extreme_left} />
                      <SpectrumRow label="Left Leaning" data={deepData.left_leaning} />
                      <SpectrumRow label="Neutral" data={deepData.neutral} />
                      <SpectrumRow label="Right Leaning" data={deepData.right_leaning} />
                      <SpectrumRow label="Extreme Right" data={deepData.extreme_right} />
                    </div>
                  )
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </div>

      {/* Auth Modal - Sign In / Sign Up */}
      {showProfileModal && (
        <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>

            {/* LOGGED IN VIEW */}
            {isLoggedIn && authMode === 'loggedin' && (
              <div className="profile-form">
                <div className="logged-in-info">
                  <div className="user-avatar">👤</div>
                  <h3>Welcome, {loggedInUser}!</h3>
                </div>

                <div className="modal-buttons" style={{ flexDirection: 'column' }}>
                  {/* Edit Profile - temporarily disabled
                  <button className="btn-save" onClick={() => setAuthMode('signup')}>
                    Edit Profile
                  </button>
                  */}
                  <button className="btn-logout" onClick={handleLogout}>
                    Sign Out
                  </button>
                  <button className="btn-delete" onClick={handleDeleteProfile}>
                    Delete Account
                  </button>
                  <button className="btn-cancel" onClick={() => setShowProfileModal(false)}>
                    Close
                  </button>
                </div>
              </div>
            )}

            {/* SIGN UP FORM - Shown first by default */}
            {authMode === 'signup' && (
              <div className="profile-form">
                <h2 className="modal-title">Create Account</h2>

                <div className="form-field">
                  <label>Full Name: *</label>
                  <input
                    type="text"
                    value={userProfile.name}
                    onChange={(e) => handleProfileChange('name', e.target.value)}
                    placeholder="Enter your full name"
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Gender: *</label>
                  <select
                    value={userProfile.gender}
                    onChange={(e) => handleProfileChange('gender', e.target.value)}
                    required
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not">Prefer not to say</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>Age: *</label>
                  <input
                    type="number"
                    value={userProfile.age}
                    onChange={(e) => handleProfileChange('age', e.target.value)}
                    placeholder="Enter your age"
                    min="13"
                    max="120"
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Political Preference: *</label>
                  <select
                    value={userProfile.politicalSpectrum}
                    onChange={(e) => handleProfileChange('politicalSpectrum', e.target.value)}
                    required
                  >
                    <option value="">Select your position</option>
                    <option value="extreme_left">Left</option>
                    <option value="left_leaning">Left Leaning</option>
                    <option value="neutral">Neutral</option>
                    <option value="right_leaning">Right Leaning</option>
                    <option value="extreme_right">Right</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>Email Address: *</label>
                  <input
                    type="email"
                    value={userProfile.email}
                    onChange={(e) => handleProfileChange('email', e.target.value)}
                    placeholder="your.email@example.com"
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Password: * (minimum 6 characters)</label>
                  <input
                    type="password"
                    value={userProfile.password}
                    onChange={(e) => handleProfileChange('password', e.target.value)}
                    placeholder="Create a password"
                    required
                  />
                </div>

                <div className="form-field checkbox-field">
                  <label>
                    <input
                      type="checkbox"
                      checked={userProfile.wantsLocalStorage}
                      onChange={(e) => handleProfileChange('wantsLocalStorage', e.target.checked)}
                    />
                    Remember me on this device
                  </label>
                </div>

                <p className="no-spam-note">
                  🔒 No spam emails will be sent. Your data is safe with us.
                </p>

                <div className="modal-buttons">
                  <button className="btn-save" onClick={handleProfileSave}>
                    Create Account
                  </button>
                  <button className="btn-cancel" onClick={() => setShowProfileModal(false)}>
                    Cancel
                  </button>
                </div>

                {/* Small link to Sign In - shown at bottom */}
                <p className="auth-switch">
                  Already have an account?{' '}
                  <button className="link-btn" onClick={() => setAuthMode('login')}>
                    Sign In
                  </button>
                </p>
              </div>
            )}

            {/* SIGN IN FORM - Only shown when user clicks "Sign In" link */}
            {authMode === 'login' && (
              <div className="profile-form">
                <h2 className="modal-title">Sign In</h2>

                <div className="form-field">
                  <label>Email Address: *</label>
                  <input
                    type="email"
                    value={userProfile.email}
                    onChange={(e) => handleProfileChange('email', e.target.value)}
                    placeholder="your.email@example.com"
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Password: *</label>
                  <input
                    type="password"
                    value={userProfile.password}
                    onChange={(e) => handleProfileChange('password', e.target.value)}
                    placeholder="Enter your password"
                    required
                  />
                </div>

                <div className="modal-buttons">
                  <button className="btn-save" onClick={handleLogin}>
                    Sign In
                  </button>
                  <button className="btn-cancel" onClick={() => setShowProfileModal(false)}>
                    Cancel
                  </button>
                </div>

                {/* Small link back to Sign Up */}
                <p className="auth-switch">
                  Don't have an account?{' '}
                  <button className="link-btn" onClick={() => setAuthMode('signup')}>
                    Sign Up
                  </button>
                </p>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}

const CitationList = ({ names }) => {
  if (!names || names.length === 0) return null;
  return (
    <div className="citations-wrapper">
      {names.map((sourceObj, i) => {
        if (typeof sourceObj === 'object' && sourceObj !== null) {
          return (
            <span key={i} className={`cite-tag ${sourceObj.url ? 'clickable' : ''}`}>
              {sourceObj.url
                ? <a href={sourceObj.url} target="_blank" rel="noreferrer">
                    {sourceObj.name}
                  </a>
                : sourceObj.name}
            </span>
          );
        }
        return <span key={i} className="cite-tag">{sourceObj}</span>;
      })}
    </div>
  );
};

const SpectrumRow = ({ label, data }) => {
  if (!data) return null;
  return (
    <div className="spec-row">
      <div className="spec-label">{label}</div>
      <div className="spec-content">
        <div className="spec-subhead">{data.subheading}</div>
        <div className="spec-text">{data.text}</div>
      </div>
    </div>
  );
};

export default App;
