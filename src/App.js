import React, { useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import './App.css';

function App() {
  const [query, setQuery] = useState('');
  
  const today = new Date().toISOString().split('T')[0];
  const lastMonth = new Date(new Date().setDate(new Date().getDate() - 28)).toISOString().split('T')[0];
  
  const [fromDate, setFromDate] = useState(lastMonth);
  const [toDate, setToDate] = useState(today);

  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null); 
  const [error, setError] = useState(null);
  
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const performSearch = async (searchTerm, forceExact = false) => {
    if (!searchTerm) return;
    setHasSearched(true);
    setLoading(true);
    setReportData(null);
    setError(null);
    setIsSaved(false);

    try {
      const response = await axios.post('https://sanaafroze2.pythonanywhere.com/api/analyze', {
        topic: searchTerm,
        from_date: fromDate,
        to_date: toDate,
        force_exact: forceExact
      });
      
      const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      setReportData(data); 
      if (data.metadata) {
        setFromDate(data.metadata.from_date);
        setToDate(data.metadata.to_date);
      }
      
      if (data.metadata && data.metadata.is_saved) {
        setIsSaved(true);
      }
    } catch (err) {
      console.error(err);
      setError("Connection failed. Ensure Backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    performSearch(query, false);
  };

  const handleOverride = () => {
    if (reportData && reportData.metadata.original_query) {
      setQuery(reportData.metadata.original_query);
      performSearch(reportData.metadata.original_query, true);
    }
  };

  const handleSave = async () => {
    if (!reportData) return;
    setIsSaving(true);
    try {
        // Port for the save logic /home/sanaafroze2/mysite
        await axios.post('https://sanaafroze2.pythonanywhere.com/api/save', {
            topic: reportData.metadata.topic,
            from_date: reportData.metadata.from_date,
            to_date: reportData.metadata.to_date,
            report_data: reportData
        });
        setIsSaved(true);
    } catch (err) {
        console.error("Save error:", err);
        alert("Save failed. Check if the report already exists in your Archive.");
    } finally {
        setIsSaving(false);
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
            <div className="capsule-section topic-section">
              <span className="icon">🔍</span>
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Enter Topic..." className="capsule-input"/>
            </div>
            <div className="capsule-divider"></div>
            <div className="capsule-section date-section">
              <span className="icon">📅</span>
              <div className="date-inputs">
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="capsule-date"/>
                <span className="date-arrow">→</span>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="capsule-date"/>
              </div>
            </div>
            <button type="submit" className="capsule-btn">Analyze</button>
          </div>
        </form>
      </motion.div>

      <div className="content-area">
        {loading && <div className="loader">Analyzing Full Text Sources...</div>}
        {error && <div className="error-msg">{error}</div>}
        
        {/* CORRECTION BANNER - Will only show if corrected_query is explicitly set */}
        {reportData && reportData.metadata.corrected_query && (
          <div className="correction-container">
            <div className="correction-line">
              <span className="correction-label">Showing results for </span>
              <strong className="corrected-term">{reportData.metadata.corrected_query}</strong>
            </div>
            <div className="correction-line sub-line">
              <span className="correction-label">Search instead for </span>
              <button className="override-link" onClick={handleOverride}>
                {reportData.metadata.original_query}
              </button>
            </div>
          </div>
        )}

        {reportData && reportData.analysis && (
          <motion.div className="report-container" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            
            <div className="report-header-row">
                <div className="header-titles">
                    <h2>Executive Summary: {reportData.metadata.topic}</h2>
                    <div className="meta-badge">
                        📅 {reportData.metadata.from_date} to {reportData.metadata.to_date}
                    </div>
                </div>

                <button 
                    className={`save-action-btn ${isSaved ? 'saved' : ''}`} 
                    onClick={handleSave}
                    disabled={isSaved || isSaving}
                >
                    {isSaving ? 'Saving...' : isSaved ? '✅ Saved to Archive' : '💾 Save Report'}
                </button>
            </div>

            <div className="grid-2">
              <div className="card adv">
                <h3>Advantages</h3>
                {reportData.analysis.advantages.map((item, idx) => (
                  <div key={idx} className="point-item">
                    <h4>{item.heading}</h4>
                    <p>{item.context}</p>
                    <CitationList names={item.cited_sources} />
                  </div>
                ))}
              </div>
              <div className="card dis">
                <h3>Disadvantages</h3>
                {reportData.analysis.disadvantages.map((item, idx) => (
                  <div key={idx} className="point-item">
                    <h4>{item.heading}</h4>
                    <p>{item.context}</p>
                    <CitationList names={item.cited_sources} />
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

const CitationList = ({ names }) => {
    if (!names || names.length === 0) return null;
    return (
      <div className="citations-wrapper">
        {names.map((sourceObj, i) => {
          if (typeof sourceObj === 'object' && sourceObj !== null) {
            return (
                <span key={i} className={`cite-tag ${sourceObj.url ? 'clickable' : ''}`}>
                    {sourceObj.url ? 
                        <a href={sourceObj.url} target="_blank" rel="noreferrer">{sourceObj.name}</a> 
                        : sourceObj.name}
                </span>
            );
          }
          return <span key={i} className="cite-tag">{sourceObj}</span>;
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
