import React from 'react';

export const GlobalStyles = () => (
    <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');

    :root {
      --bg-primary: #F9F9F7;
      --bg-surface: #FFFFFF;
      --text-primary: #050505;
      --text-secondary: #525252;
      --accent: #FF3300;
      --accent-hover: #CC2900;
      --success: #059669;
      --warning: #D97706;
      --danger: #DC2626;
      --border: rgba(0, 0, 0, 0.08);
      --border-strong: rgba(0, 0, 0, 0.15);
    }

    body {
      font-family: 'Inter', sans-serif;
      background-color: var(--bg-primary);
      color: var(--text-primary);
      -webkit-font-smoothing: antialiased;
    }

    h1, h2, h3, h4, h5, h6 {
      font-family: 'Inter Tight', sans-serif;
      letter-spacing: -0.03em;
    }

    .font-mono {
      font-family: 'JetBrains Mono', monospace;
      letter-spacing: -0.02em;
    }

    .custom-scrollbar::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #E5E5E5;
      border-radius: 3px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #D4D4D4;
    }

    @keyframes slide-up {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .reveal {
      opacity: 0;
      transform: translateY(20px);
      transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .reveal.active {
      opacity: 1;
      transform: translateY(0);
    }

    .glass-nav {
      background: rgba(249, 249, 247, 0.85);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--border);
    }

    .dash-grid-bg {
      background-image: 
        linear-gradient(var(--border) 1px, transparent 1px),
        linear-gradient(90deg, var(--border) 1px, transparent 1px);
      background-size: 40px 40px;
    }
  `}</style>
);
