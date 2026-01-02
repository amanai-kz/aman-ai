// AMAN AI Chrome Extension - Popup Script

const API_BASE = 'https://amanai.kz';

// DOM Elements
const statusBadge = document.getElementById('status-badge');
const statusText = statusBadge.querySelector('.status-text');
const authSection = document.getElementById('auth-section');
const mainSection = document.getElementById('main-section');
const loginBtn = document.getElementById('login-btn');
const newConsultationBtn = document.getElementById('new-consultation-btn');
const historyBtn = document.getElementById('history-btn');
const dashboardLink = document.getElementById('dashboard-link');
const recentList = document.getElementById('recent-list');

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Set up event listeners
  loginBtn.addEventListener('click', openDashboard);
  newConsultationBtn.addEventListener('click', openNewConsultation);
  historyBtn.addEventListener('click', openHistory);
  dashboardLink.addEventListener('click', openDashboard);

  // Check connection status
  await checkStatus();
  
  // Load recent consultations
  await loadRecentConsultations();
}

async function checkStatus() {
  try {
    const response = await fetch(`${API_BASE}/api/user/me`, {
      credentials: 'include'
    });
    
    if (response.ok) {
      setStatus('connected', 'Online');
      showMainSection();
    } else {
      setStatus('disconnected', 'Offline');
      showAuthSection();
    }
  } catch (error) {
    console.error('Status check failed:', error);
    setStatus('disconnected', 'Offline');
    showAuthSection();
  }
}

function setStatus(status, text) {
  statusBadge.className = `status-badge status-${status}`;
  statusText.textContent = text;
}

function showAuthSection() {
  authSection.classList.remove('hidden');
  mainSection.classList.add('hidden');
}

function showMainSection() {
  authSection.classList.add('hidden');
  mainSection.classList.remove('hidden');
}

async function loadRecentConsultations() {
  try {
    const response = await fetch(`${API_BASE}/api/consultation`, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch consultations');
    }
    
    const data = await response.json();
    const reports = data.reports || [];
    
    if (reports.length === 0) {
      recentList.innerHTML = `
        <div class="empty-state">
          No consultations yet. Start your first one!
        </div>
      `;
      return;
    }
    
    // Show only last 5
    const recentReports = reports.slice(0, 5);
    
    recentList.innerHTML = recentReports.map(report => `
      <div class="recent-item" data-id="${report.id}">
        <div class="recent-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
        </div>
        <div class="recent-content">
          <div class="recent-title">${escapeHtml(report.title || 'Untitled')}</div>
          <div class="recent-meta">${formatDate(report.createdAt)}</div>
        </div>
        ${report.recordingDuration ? `<div class="recent-duration">${formatDuration(report.recordingDuration)}</div>` : ''}
      </div>
    `).join('');
    
    // Add click handlers
    recentList.querySelectorAll('.recent-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        openConsultation(id);
      });
    });
    
  } catch (error) {
    console.error('Failed to load consultations:', error);
    recentList.innerHTML = `
      <div class="empty-state">
        Could not load consultations. Please try again.
      </div>
    `;
  }
}

function openDashboard(e) {
  e?.preventDefault();
  chrome.tabs.create({ url: `${API_BASE}/dashboard` });
}

function openNewConsultation() {
  chrome.tabs.create({ url: `${API_BASE}/dashboard/consultation` });
}

function openHistory() {
  chrome.tabs.create({ url: `${API_BASE}/dashboard/history` });
}

function openConsultation(id) {
  chrome.tabs.create({ url: `${API_BASE}/dashboard/history?id=${id}` });
}

// Utilities
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  
  // Less than 24 hours ago
  if (diff < 86400000) {
    if (diff < 3600000) {
      const mins = Math.floor(diff / 60000);
      return mins <= 1 ? 'Just now' : `${mins} minutes ago`;
    }
    const hours = Math.floor(diff / 3600000);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  
  // Less than 7 days ago
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
  
  // Older
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

