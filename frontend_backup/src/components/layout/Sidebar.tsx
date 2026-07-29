import {
  BarChart3,
  FolderKanban,
  Upload,
  BrainCircuit,
  FileText,
  Settings,
} from "lucide-react";
import { NavLink } from "react-router-dom";

const menu = [
  {
    name: "Dashboard",
    path: "/",
    icon: BarChart3,
  },
  {
    name: "Projects",
    path: "/projects",
    icon: FolderKanban,
  },
  {
    name: "Upload",
    path: "/upload",
    icon: Upload,
  },
  {
    name: "Analysis",
    path: "/analysis",
    icon: BrainCircuit,
  },
  {
    name: "Reports",
    path: "/reports",
    icon: FileText,
  },
  {
    name: "Settings",
    path: "/settings",
    icon: Settings,
  },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div>
        <div className="logo">
          <h2>Johnson Road</h2>
          <span>Traffic Intelligence</span>
        </div>

        <nav className="menu">
          {menu.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  isActive ? "nav-item active" : "nav-item"
                }
              >
                <Icon size={20} />
                {item.name}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="storage-card">
        <p>Storage</p>

        <div className="progress">
          <div className="progress-fill" />
        </div>

        <small>Free Plan • 72% Used</small>
      </div>
    </aside>
  );
}