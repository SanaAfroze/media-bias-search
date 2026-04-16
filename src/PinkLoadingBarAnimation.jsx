// PinkBarsLoader.jsx
import React from 'react';
import './PinkLoadingBarAnimation.css'; // Import the CSS we're about to create

const PinkLoadingBarAnimation = () => {
  return (
    <div className="progressive-disclosure-wrapper">
      <div className="pink-bars-loader">
        <div className="bar"></div>
        <div className="bar"></div>
        <div className="bar"></div>
        <div className="bar"></div>
        <div className="bar"></div>
      </div>
      <div className="progressive-status-text pulse">Loading...</div>
    </div>
  );
};

export default PinkLoadingBarAnimation;