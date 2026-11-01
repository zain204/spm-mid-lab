import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Project from './pages/Project';
import Scope from './pages/Scope';
import Schedule from './pages/Schedule';
import Cost from './pages/Cost';
import Quality from './pages/Quality';
import Risks from './pages/Risks';

const ICONS = {
  dashboard: 'M3 3h7v9H3z M14 3h7v5h-7z M14 12h7v9h-7z M3 16h7v5H3z',
  project: 'M9 4h6v3H9z M7 5H5v16h14V5h-2 M9 12h6 M9 16h6',
  scope: 'M12 3l9 5-9 5-9-5z M3 13l9 5 9-5',
  schedule: 'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4',
  cost: 'M12 3v18 M16 7.5C16 6 14.5 5 12 5s-4 1-4 2.5S9.5 10 12 11s4 1.5 4 3.5S14.5 18 12 18s-4-1.2-4-2.8',
  quality: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M8.5 12l2.5 2.5L16 9.5',
  risk: 'M12 3l10 18H2z M12 10v5 M12 18v.5',
};

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const TABS = [
  ['Dashboard', 'Project overview and warnings', Dashboard, ICONS.dashboard],
  ['Initiation & Plan', 'Charter, plan, milestones and closure', Project, ICONS.project],
  ['Scope & WBS', 'Requirements, WBS and change requests', Scope, ICONS.scope],
  ['Schedule & Resources', 'Activities, Gantt chart and delay impact', Schedule, ICONS.schedule],
  ['Cost & EVM', 'Earned value analysis and cost control', Cost, ICONS.cost],
  ['Quality & Risk', 'Defect tracking and quality checklists', Quality, ICONS.quality],
  ['Risk Matrix & PDPC', 'Prioritization matrix and PDPC chart', Risks, ICONS.risk],
];

export default function App() {
  const [tab, setTab] = useState(0);
  const [title, subtitle, Page] = TABS[tab];
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14 M5 12h14" />
            </svg>
          </div>
          <div>
            <div className="brand-name">Smart Healthcare</div>
            <div className="brand-sub">Project Management System</div>
          </div>
        </div>

        <div className="menu-label">Modules</div>
        <nav className="menu">
          {TABS.map(([name, , , icon], i) => (
            <button key={name} className={i === tab ? 'active' : ''} onClick={() => setTab(i)}>
              <Icon d={icon} />
              {name}
            </button>
          ))}
        </nav>

        <div className="side-foot">
          <b>CSE-494</b> Software Project Management
          <br />
          Mid-term Lab, Fall 2026
        </div>
      </aside>

      <div className="content">
        <div className="topbar">
          <div>
            <h1>{title}</h1>
            <small>{subtitle}</small>
          </div>
          <div className="pill">
            Today: <b>{today}</b>
          </div>
        </div>
        <main>
          <Page key={tab} />
        </main>
      </div>
    </div>
  );
}