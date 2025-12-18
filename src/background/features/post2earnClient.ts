import { ethers } from "ethers";
import post2EarnAbi from "../../contract/Post2EarnABI.json";
import post2EarnAddress from "../../contract/Post2EarnCA.json";

type Post2EarnAddressJson = { POST2_EARN_CONTRACT_ADDRESS?: string };

export function getPost2EarnAddressOrThrow(): string {
  const addr = (post2EarnAddress as Post2EarnAddressJson)
    .POST2_EARN_CONTRACT_ADDRESS;
  if (!addr || !ethers.isAddress(addr)) {
    throw new Error("Invalid Post2Earn contract address.");
  }
  return addr;
}

export function getPost2EarnAbi(): unknown {
  return (post2EarnAbi as any).abi;
}

export function getPost2EarnContract(runner: ethers.ContractRunner) {
  const address = getPost2EarnAddressOrThrow();
  return new ethers.Contract(address, getPost2EarnAbi() as any, runner);
}

