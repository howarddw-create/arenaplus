import React from "react";
import { Modal } from "../WalletInfo/Modal";
import { CloseButton } from "../UI/CloseButton";
import {
  ChartPieIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  TrophyIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

interface CommunityAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  username?: string;
}

export const CommunityAllocationModal: React.FC<
  CommunityAllocationModalProps
> = ({ isOpen, onClose }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} fullScreen>
      <div className="flex h-full w-full flex-col">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/60 bg-white/80 px-5 py-4 backdrop-blur">
          <div>
            <p className="section-title text-[0.65rem]">Leaderboard</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-800">
              Community Allocation
            </h2>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-[92%] space-y-6 py-6">
            <div className="rounded-2xl border border-white/60 bg-white/85 p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/15 to-emerald-500/15 text-blue-600">
                  <ChartPieIcon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">
                    Leaderboard Program
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Allocation program details are currently{" "}
                    <span className="font-semibold text-slate-700">TBD</span>.
                  </p>
                  <div className="mt-4 flex items-center justify-between rounded-xl border border-blue-100/70 bg-blue-50/70 px-4 py-3 text-sm text-slate-600">
                    <span className="font-medium text-slate-600">
                      Total Allocation
                    </span>
                    <span className="font-semibold text-blue-600">TBD</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/60 bg-white/85 p-5 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
                Token Allocation
              </h3>
              <div className="mt-4 rounded-xl border border-dashed border-blue-200/70 bg-blue-50/60 px-4 py-5 text-sm text-slate-600">
                Allocation breakdown is <span className="font-semibold text-slate-700">TBD</span>. Check back soon for the detailed distribution.
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <InfoItem
                  icon={<CurrencyDollarIcon className="h-5 w-5" />}
                  label="Total Allocation"
                  value="TBD"
                />
                <InfoItem
                  icon={<TrophyIcon className="h-5 w-5 text-amber-500" />}
                  label="Leaderboard Reset"
                  value="TBD"
                />
                <InfoItem
                  icon={<ArrowPathIcon className="h-5 w-5 text-blue-500" />}
                  label="Distribution Cycle"
                  value="TBD"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/60 bg-white/85 p-5 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
                How It Works
              </h3>
              <div className="mt-4 space-y-3">
                <ProcessStep
                  number={1}
                  title="Content Creation"
                  description="Create quality content on the PLUS community page in arena.social."
                />
                <ProcessStep
                  number={2}
                  title="Engagement Points"
                  description="Earn points based on likes (1pt), answers (2pts), reposts (1.5pts), and bookmarks (3pts)."
                />
                <ProcessStep
                  number={3}
                  title="Token Multipliers"
                  description="Token holders get 2x points, and 1% holders get 3x points."
                />
                <ProcessStep
                  number={4}
                  title="Monthly Distribution"
                  description="Tokens are distributed based on leaderboard ranking at the end of each month."
                />
                <ProcessStep
                  number={5}
                  title="3-Month Cycle"
                  description="The program runs for 3 months with monthly distributions."
                />
              </div>
            </div>

            <div className="rounded-2xl border border-blue-100/70 bg-blue-50/70 p-5 text-blue-700">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-blue-600">
                  <CalendarIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.3em]">
                    Next Distribution
                  </h3>
                  <p className="mt-2 text-sm">
                    Distribution schedule is <span className="font-semibold">TBD</span>. We'll share timing details once confirmed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

const InfoItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
}> = ({ icon, label, value }) => (
  <div className="flex items-start">
    <div className="flex-shrink-0 h-6 w-6 text-gray-400">{icon}</div>
    <div className="ml-3">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="text-lg font-semibold text-gray-800">{value}</p>
    </div>
  </div>
);

const ProcessStep: React.FC<{
  number: number;
  title: string;
  description: string;
}> = ({ number, title, description }) => (
  <div className="flex">
    <div className="flex-shrink-0">
      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-600 font-bold text-sm">
        {number}
      </div>
    </div>
    <div className="ml-4">
      <h4 className="text-sm font-medium text-gray-800">{title}</h4>
      <p className="text-xs text-gray-600">{description}</p>
    </div>
  </div>
);
