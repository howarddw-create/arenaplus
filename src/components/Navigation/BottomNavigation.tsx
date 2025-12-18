import React from "react";
import { UserSearch, User, Wallet, Package, Trophy } from "lucide-react";

export type TabType =
  | "inventory"
  | "profile"
  | "wallet"
  | "deepdive"
  | "leaderboard";

interface BottomNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onTabChange,
}) => {
  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    {
      id: "inventory",
      label: "Inventory",
      icon: <Package className="h-5 w-5" />,
    },
    {
      id: "wallet",
      label: "Wallet",
      icon: <Wallet className="h-5 w-5" />,
    },
    {
      id: "leaderboard",
      label: "Leaderboard",
      icon: <Trophy className="h-5 w-5" />,
    },
    {
      id: "deepdive",
      label: "Search",
      icon: <UserSearch className="h-5 w-5" />,
    },
    {
      id: "profile",
      label: "Profile",
      icon: <User className="h-5 w-5" />,
    },
  ];

  return (
    <nav className="pointer-events-auto absolute bottom-3 left-1/2 z-50 flex w-[92%] -translate-x-1/2 items-center justify-between rounded-2xl border border-white/60 bg-white/80 px-2 py-2 shadow-[0_20px_45px_rgba(15,23,42,0.18)] backdrop-blur">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`group relative flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition ${
              isActive ? "text-slate-900" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                isActive
                  ? "border-transparent bg-gradient-to-br from-blue-500 to-emerald-500 text-white shadow-lg"
                  : "border-white/50 bg-white/70 text-slate-500"
              }`}
            >
              {tab.icon}
            </span>
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
};
