import React from "react";
import { Modal } from "../WalletInfo/Modal";
import { useTokenVesting } from "../../hooks/useTokenVesting";
import { formatTokenBalance } from "../../utils/formatters";
import { PieChart } from "react-minimal-pie-chart";
import {
  ChartPieIcon,
  CheckCircleIcon,
  CubeTransparentIcon,
  CurrencyDollarIcon,
  IdentificationIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import colors from "tailwindcss/colors";

interface TokenVestingModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress?: string;
}

export const TokenVestingModal: React.FC<TokenVestingModalProps> = ({
  isOpen,
  onClose,
  walletAddress,
}) => {
  const { data, error } = useTokenVesting(walletAddress);

  const claimed = parseFloat(data?.claimed || "0");
  const claimable = parseFloat(data?.claimable || "0");
  const total = parseFloat(data?.totalVested || "0");
  const locked = Math.max(total - claimed - claimable, 0);

  const chartData = [
    { title: "Claimed", value: claimed, color: colors.blue[600] },
    { title: "Claimable", value: claimable, color: colors.green[500] },
    { title: "Locked", value: locked, color: colors.gray[300] },
  ].filter((item) => item.value > 0);

  const now = Date.now() / 1000;
  const start = data?.startTime || 0;
  const end = data?.endTime || 0;
  const duration = end - start;
  const elapsed = now - start;
  const vestingProgress =
    duration > 0 ? Math.min((elapsed / duration) * 100, 100) : 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6 bg-white rounded-lg w-full max-w-lg relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>
        <div className="flex items-center mb-6">
          <ChartPieIcon className="h-8 w-8 text-blue-600 mr-3" />
          <h2 className="text-2xl font-bold text-gray-800">
            Token Vesting Details
          </h2>
        </div>

        {error && <p className="text-red-500">{error}</p>}
        {data && (
          <div className="space-y-6">
            {
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <IdentificationIcon className="h-5 w-5 text-gray-500 mr-2" />
                  <h3 className="text-md font-semibold text-gray-700">
                    Beneficiary
                  </h3>
                </div>
                <p className="text-sm text-gray-600 mt-1 break-all">
                  {data.owner}
                </p>
              </div>
            }
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="flex flex-col items-center">
                <div style={{ height: 160, width: 160 }}>
                  <PieChart
                    data={chartData}
                    lineWidth={40}
                    rounded
                    label={({ dataEntry }) =>
                      dataEntry.value > 0 && total > 0
                        ? `${Math.round((dataEntry.value / total) * 100)}%`
                        : ""
                    }
                    labelStyle={() => ({
                      fontSize: "8px",
                      fill: colors.black,
                      fontWeight: "500",
                    })}
                  />
                </div>
                <div className="mt-4 space-y-2 text-sm w-full">
                  {chartData.map((item) => (
                    <div key={item.title} className="flex items-center">
                      <span
                        className="h-3 w-3 rounded-full mr-2"
                        style={{ backgroundColor: item.color }}
                      ></span>
                      <span className="font-medium text-gray-600">
                        {item.title}:
                      </span>
                      <span className="ml-auto font-mono text-gray-800">
                        {formatTokenBalance(item.value.toString(), "")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <InfoItem
                  icon={<CurrencyDollarIcon />}
                  label="Total Vested"
                  value={formatTokenBalance(data.totalVested, "PLUS")}
                />
                <InfoItem
                  icon={<CheckCircleIcon className="text-green-500" />}
                  label="Claimable"
                  value={formatTokenBalance(data.claimable, "PLUS")}
                />
                <InfoItem
                  icon={<CubeTransparentIcon className="text-blue-500" />}
                  label="Claimed"
                  value={formatTokenBalance(data.claimed, "PLUS")}
                />
              </div>
            </div>

            <div>
              <h3 className="text-md font-semibold text-gray-700 mb-2">
                Vesting Period
              </h3>
              <div className="bg-gray-200 rounded-full h-2.5 w-full">
                <div
                  className="bg-blue-600 h-2.5 rounded-full"
                  style={{ width: `${vestingProgress}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{new Date(start * 1000).toLocaleDateString()}</span>
                <span>{new Date(end * 1000).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        )}
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
