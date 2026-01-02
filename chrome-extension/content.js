// AMAN AI Chrome Extension - Content Script
// This script runs on all pages and provides quick access to AMAN AI features

(function() {
  'use strict';

  // Only inject on non-AMAN pages
  if (window.location.hostname.includes('amanai.kz')) {
    return;
  }

  // Create floating action button
  const fab = document.createElement('div');
  fab.id = 'aman-ai-fab';
  fab.innerHTML = `
    <button id="aman-ai-fab-btn" title="AMAN AI - Quick Consultation">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
        <path d="M12 6v12M6 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>
    <div id="aman-ai-tooltip">
      <div class="aman-tooltip-content">
        <p><strong>AMAN AI</strong></p>
        <p>Click to start a consultation</p>
      </div>
    </div>
  `;

  // Inject after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectFab);
  } else {
    injectFab();
  }

  function injectFab() {
    document.body.appendChild(fab);

    const fabBtn = document.getElementById('aman-ai-fab-btn');
    const tooltip = document.getElementById('aman-ai-tooltip');

    fabBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'OPEN_CONSULTATION' });
    });

    fabBtn.addEventListener('mouseenter', () => {
      tooltip.classList.add('show');
    });

    fabBtn.addEventListener('mouseleave', () => {
      tooltip.classList.remove('show');
    });

    // Make FAB draggable
    let isDragging = false;
    let startX, startY, startLeft, startBottom;

    fabBtn.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = fab.offsetLeft;
      startBottom = parseInt(window.getComputedStyle(fab).bottom);
      fab.style.transition = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const deltaX = e.clientX - startX;
      const deltaY = startY - e.clientY;
      
      const newLeft = Math.max(10, Math.min(window.innerWidth - 70, startLeft + deltaX));
      const newBottom = Math.max(10, Math.min(window.innerHeight - 70, startBottom + deltaY));
      
      fab.style.left = newLeft + 'px';
      fab.style.right = 'auto';
      fab.style.bottom = newBottom + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        fab.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
      }
    });
  }
})();

