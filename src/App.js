import React, { useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import './App.css';
import PinkLoadingBarAnimation from './PinkLoadingBarAnimation';
// USE YOUR PYTHONANYWHERE URL IN PRODUCTION
const API_BASE = "https://sanaafroze2.pythonanywhere.com";
// const API_BASE = "http://localhost:5002";

function App() {
  const [query, setQuery] = useState('');
  
  const today = new Date().toISOString().split('T')[0];
  const lastMonth = new Date(new Date().setDate(new Date().getDate() - 28)).toISOString().split('T')[0];
  
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

  const performSearch = async (searchTerm, forceExact = false) => {
    if (!searchTerm) return;
    
    // Reset all states
    setHasSearched(true);
    setIsBasicLoading(true);
    setIsDeepLoading(true);
    setShowDeepAnalysis(false);
    setBasicData(null);
    setDeepData(null);
    setError(null);
    setIsSaved(false);

    try {
      // 1. Trigger the Basic Analysis (Scraping + Pros/Cons)
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
          analysis: { advantages: data.full_report.analysis.advantages, disadvantages: data.full_report.analysis.disadvantages },
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
      setIsBasicLoading(false); // First part is done, show UI!

      // 2. Trigger Background Deep Analysis using the context
      fetchDeepAnalysis(data.context_text);

    } catch (err) {
      console.error(err);
      setError("Analysis failed. No articles found or server error.");
      setIsBasicLoading(false);
      setIsDeepLoading(false);
    }
  };

  const fetchDeepAnalysis = async (contextText) => {
    try {
      const response = await axios.post(`${API_BASE}/api/deep_analysis`, {
        context_text: contextText
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

  const handleSave = async () => {
    if (!basicData || !deepData) return;
    setIsSaving(true);
    
    // Assemble the full report exactly as the DB expects it
    const fullReportToSave = {
        analysis: {
            advantages: basicData.analysis ? basicData.analysis.advantages : basicData.basic_analysis.advantages,
            disadvantages: basicData.analysis ? basicData.analysis.disadvantages : basicData.basic_analysis.disadvantages,
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

  // Helper variable to access the correct pros/cons array based on fresh vs cached structure
  const advantagesList = basicData?.analysis?.advantages || basicData?.basic_analysis?.advantages || [];
  const disadvantagesList = basicData?.analysis?.disadvantages || basicData?.basic_analysis?.disadvantages || [];

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
              <strong className="corrected-term">{basicData.metadata.corrected_query}</strong>
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
          <motion.div className="report-container" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            
            <div className="report-header-row">
                <div className="header-titles">
                    <h2>Executive Summary: {basicData.metadata.topic}</h2>
                    <div className="meta-badge">
                        📅 {basicData.metadata.from_date} to {basicData.metadata.to_date}
                    </div>
                </div>

                <button 
                    className={`save-action-btn ${isSaved ? 'saved' : ''}`} 
                    onClick={handleSave}
                    disabled={isSaved || isSaving || !deepData} // Disable save if deepData isn't ready
                >
                    {isSaving ? 'Saving...' : isSaved ? '✅ Saved' : '💾 Save'}
                </button>
            </div>

            <div className="grid-2">
              <div className="card adv">
                <h3>Advantages</h3>
                {advantagesList.map((item, idx) => (
                  <div key={idx} className="point-item">
                    <h4>{item.heading}</h4>
                    <p>{item.context}</p>
                    <CitationList names={item.cited_sources} />
                  </div>
                ))}
              </div>
              <div className="card dis">
                <h3>Disadvantages</h3>
                {disadvantagesList.map((item, idx) => (
                  <div key={idx} className="point-item">
                    <h4>{item.heading}</h4>
                    <p>{item.context}</p>
                    <CitationList names={item.cited_sources} />
                  </div>
                ))}
              </div>
            </div>

            {/* PROGRESSIVE DISCLOSURE UI */}
            {!showDeepAnalysis ? (
                <div className="reveal-container">
                    <button className="reveal-btn" onClick={() => setShowDeepAnalysis(true)}>
                        Analyze Political Spectrum
                    </button>
                    {isDeepLoading && <span className="reveal-status">Generating in background...</span>}
                    {!isDeepLoading && <span className="reveal-status complete">Analysis Ready</span>}
                </div>
            ) : (
                <motion.div className="deep-results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <h2 className="spec-title">Political Spectrum Analysis</h2>
                    
                    {isDeepLoading ? (
                        <div className="loader secondary">Generating Political Perspectives...</div>
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
