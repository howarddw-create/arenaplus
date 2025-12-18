// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FeeOnTransferERC20 is ERC20 {
    uint256 public immutable feeBps; // e.g., 1000 = 10%
    address public immutable feeRecipient;
    uint256 private constant BPS_DENOMINATOR = 10_000;

    constructor(uint256 _feeBps, address _feeRecipient) ERC20("Fee Token", "FEE") {
        require(_feeBps <= BPS_DENOMINATOR, "fee too high");
        require(_feeRecipient != address(0), "fee recipient zero");
        feeBps = _feeBps;
        feeRecipient = _feeRecipient;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 amount) internal override {
        if (feeBps == 0 || from == address(0) || to == address(0)) {
            super._update(from, to, amount);
            return;
        }

        uint256 fee = (amount * feeBps) / BPS_DENOMINATOR;
        uint256 sendAmount = amount - fee;
        super._update(from, feeRecipient, fee);
        super._update(from, to, sendAmount);
    }
}
