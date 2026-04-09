import React, { useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import './App.css';

function App() {
  const [query, setQuery] = useState('');
  
  // --- DYNAMIC DATE STATE ---
  // Default: Today and 28 days ago (Standard Month View)
  const today = new Date().toISOString().split('T')[0];
  const lastMonth = new Date(new Date().setDate(new Date().getDate() - 28)).toISOString().split('T')[0];
  
  const [fromDate, setFromDate] = useState(lastMonth);
  const [toDate, setToDate] = useState(today);

  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null); 
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query) return;

    setHasSearched(true);
    setLoading(true);
    setReportData(null);
    setError(null);

    try {
      // Use 5002 for No Database
      // const response = await axios.post('http://localhost:5002/api/analyze', {
      // DYNAMIC REQUEST: Sending Topic + Specific Date Range
      const response = await axios.post('http://localhost:5001/api/analyze', {
        topic: query,
        from_date: fromDate,
        to_date: toDate
      });
      
      const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      setReportData(data); 

    } catch (err) {
      console.error("Error:", err);
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else {
        setError("Connection failed. Ensure Backend is running on Port 5001.");
      }
    } finally {
      setLoading(false);
    }
  };

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
        
        <form onSubmit={handleSearch} className="search-form">
          <div className="search-capsule">
            
            {/* DYNAMIC FIELD 1: TOPIC */}
            <div className="capsule-section topic-section">
              <span className="icon">🔍</span>
              <input 
                type="text" 
                value={query} 
                onChange={(e) => setQuery(e.target.value)} 
                placeholder="Enter Topic (e.g. Tariffs)..."
                className="capsule-input"
              />
            </div>

            <div className="capsule-divider"></div>

            {/* DYNAMIC FIELD 2: DATE RANGE */}
            <div className="capsule-section date-section">
              <span className="icon">📅</span>
              <div className="date-inputs">
                <input 
                  type="date" 
                  value={fromDate} 
                  onChange={(e) => setFromDate(e.target.value)}
                  className="capsule-date"
                  title="From Date"
                />
                <span className="date-arrow">→</span>
                <input 
                  type="date" 
                  value={toDate} 
                  onChange={(e) => setToDate(e.target.value)}
                  className="capsule-date"
                  title="To Date"
                />
              </div>
            </div>

            <button type="submit" className="capsule-btn">
              Analyze
            </button>

          </div>
        </form>
      </motion.div>

      <div className="content-area">
        {loading && <div className="loader">Analyzing {query} ({fromDate} to {toDate})...</div>}
        {error && <div className="error-msg">{error}</div>}
        
        {reportData && reportData.analysis && (
          <motion.div 
            className="report-container"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="report-header">
              <h2>Executive Summary: {reportData.metadata.topic}</h2>
              <div className="meta-badge">
                📅 Range: <strong>{reportData.metadata.from_date}</strong> to <strong>{reportData.metadata.to_date}</strong>
              </div>
            </div>
            
            <div className="grid-2">
              <div className="card adv">
                <h3>Advantages</h3>
                {reportData.analysis.advantages.map((item, idx) => (
                  <div key={idx} className="point-item">
                    <h4>{item.heading}</h4>
                    <p>{item.context}</p>
                    <CitationList names={item.cited_sources} map={reportData.sources} />
                  </div>
                ))}
              </div>
              
              <div className="card dis">
                <h3>Disadvantages</h3>
                {reportData.analysis.disadvantages.map((item, idx) => (
                  <div key={idx} className="point-item">
                    <h4>{item.heading}</h4>
                    <p>{item.context}</p>
                    <CitationList names={item.cited_sources} map={reportData.sources} />
                  </div>
                ))}
              </div>
            </div>

            <h2 className="spec-title">Political Spectrum Analysis</h2>
            <div className="spectrum-list">
              <SpectrumRow label="Extreme Left" data={reportData.analysis.perspectives.extreme_left} />
              <SpectrumRow label="Left Leaning" data={reportData.analysis.perspectives.left_leaning} />
              <SpectrumRow label="Neutral" data={reportData.analysis.perspectives.neutral} />
              <SpectrumRow label="Right Leaning" data={reportData.analysis.perspectives.right_leaning} />
              <SpectrumRow label="Extreme Right" data={reportData.analysis.perspectives.extreme_right} />
            </div>

          </motion.div>
        )}
      </div>
    </div>
  );
}

// --- FUZZY LINK MATCHING ---
const CitationList = ({ names, map }) => {
  if (!names || names.length === 0) return null;

  // Normalizes text (removes 'The', 'Inc', punctuation) for better matching
  const normalize = (str) => {
    return str.toLowerCase()
      .replace(/^(the|a|an)\s+/i, '')
      .replace(/\s+(news|magazine|daily|times|post|gazette|com|org|net)$/i, '')
      .replace(/[^\w\s]/gi, '')
      .trim();
  };

  return (
    <div className="citations-wrapper">
      {names.map((name, i) => {
        let match = map ? map.find(s => s.source.toLowerCase() === name.toLowerCase()) : null;

        if (!match && map) {
          match = map.find(s => 
            s.source.toLowerCase().includes(name.toLowerCase()) || 
            name.toLowerCase().includes(s.source.toLowerCase())
          );
        }

        if (!match && map) {
          const cleanName = normalize(name);
          match = map.find(s => {
            const cleanSource = normalize(s.source);
            return cleanSource.includes(cleanName) || cleanName.includes(cleanSource);
          });
        }
        
        const url = match ? match.url : null;

        return (
          <span key={i} className={`cite-tag ${url ? 'clickable' : ''}`}>
            {url ? <a href={url} target="_blank" rel="noreferrer">{name}</a> : name}
          </span>
        );
      })}
    </div>
  );
};

const SpectrumRow = ({ label, data }) => (
  <div className="spec-row">
    <div className="spec-label">{label}</div>
    <div className="spec-content">
      <div className="spec-subhead">{data.subheading}</div>
      <div className="spec-text">{data.text}</div>
    </div>
  </div>
);

export default App;