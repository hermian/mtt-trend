"use client";

import { useState } from "react";
import clsx from "clsx";
import { StrongStocksTable } from "./StrongStocksTable";
import { GroupActionTable } from "./GroupActionTable";
import type { DataSource } from "@/lib/api";

interface StockAnalysisTabsProps {
  date: string;
  source?: DataSource;
}

type TabId = "persistent" | "group-action";

interface Tab {
  id: TabId;
  label: string;
  description: string;
}

const TABS: Tab[] = [
  {
    id: "persistent",
    label: "지속 강세 종목",
    description: "5일 중 3회 이상 출현",
  },
  {
    id: "group-action",
    label: "그룹 액션 탐지",
    description: "동일 테마 집단 움직임",
  },
];

export function StockAnalysisTabs({ date, source = "52w_high" }: StockAnalysisTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("persistent");

  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden">
      {/* Tab Header */}
      <div className="flex border-b border-gray-700">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              "flex-1 px-6 py-4 text-sm font-medium transition-colors text-left",
              activeTab === tab.id
                ? "text-white border-b-2 border-blue-500 bg-gray-700/30"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-700/20"
            )}
          >
            <div>{tab.label}</div>
            <div className="text-xs text-gray-500 mt-0.5">{tab.description}</div>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === "persistent" && <StrongStocksTable source={source} />}
        {activeTab === "group-action" && <GroupActionTable date={date} source={source} />}
      </div>
    </div>
  );
}
