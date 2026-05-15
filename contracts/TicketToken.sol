// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

/// @title Single-event ERC-20 ticket token
/// @notice Represents tickets for one event and lets users buy, transfer, and return tickets.
/// @dev Tickets are ERC-20 units with 18 decimals; one ticket is represented by 1 * 10 ** 18 units.
contract TicketToken is IERC20 {
    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 private immutable _totalSupply;
    address private immutable _deployer;
    uint256 public immutable ticketPrice;
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;
    uint256 private _status;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    event Withdrawn(address deployer, uint256 amount);

    /**
     * @notice Prevents protected functions from being re-entered.
     * @dev Uses 1/2 status constants instead of 0/1 so guarded calls update an
     * already-initialized storage slot, paying the cheaper warm SSTORE cost
     * rather than the higher cold 0-to-nonzero initialization cost.
     */
    modifier nonReentrant() {
        require(_status == NOT_ENTERED, "TicketToken: reentrant call");
        _status = ENTERED;
        _;
        _status = NOT_ENTERED;
    }

    /**
     * @notice Creates the ticket token and mints the full supply to the deployer.
     * @dev The contract is not ready for ticket purchases immediately after deployment.
     * The deployer must call approve(contractAddress, fullSupply) after deployment
     * so buyTicket() can transfer tickets from the deployer's wallet.
     * @param _name Token name shown by wallets and explorers.
     * @param _symbol Token symbol shown by wallets and explorers.
     * @param initialSupply Number of whole tickets to mint, before applying 18 decimals.
     * @param _ticketPrice Price in wei required to buy one ticket.
     */
    constructor(string memory _name, string memory _symbol, uint256 initialSupply, uint256 _ticketPrice) {
        name = _name;
        symbol = _symbol;
        decimals = 18;
        _deployer = msg.sender;
        ticketPrice = _ticketPrice;
        _status = NOT_ENTERED;
        _totalSupply = initialSupply * 10 ** 18;
        _balances[msg.sender] = _totalSupply;
        emit Transfer(address(0), msg.sender, _totalSupply);
    }

    /// @notice Returns the total number of ticket token units that exist.
    /// @dev The value is fixed at deployment and includes 18 decimal places.
    /// @return The immutable total token supply.
    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    /// @notice Returns how many ticket token units an account holds.
    /// @dev One whole ticket equals 1 * 10 ** 18 token units.
    /// @param account Address whose balance will be read.
    /// @return The account's token balance.
    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    /// @notice Transfers ticket token units from the caller to another address.
    /// @dev Reverts if the caller does not hold at least amount token units.
    /// @param recipient Address receiving the ticket token units.
    /// @param amount Number of token units to transfer.
    /// @return True when the transfer succeeds.
    function transfer(address recipient, uint256 amount) external override returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function _transfer(address sender, address recipient, uint256 amount) internal {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");
        require(_balances[sender] >= amount, "ERC20: transfer amount exceeds balance");

        _balances[sender] -= amount;
        _balances[recipient] += amount;
        emit Transfer(sender, recipient, amount);
    }

    /// @notice Returns how many token units a spender may transfer from an owner.
    /// @dev Used by buyTicket() to check the deployer's pre-approved ticket supply.
    /// @param owner Address that granted the allowance.
    /// @param spender Address allowed to spend token units.
    /// @return Remaining allowance in token units.
    function allowance(address owner, address spender) external view override returns (uint256) {
        return _allowances[owner][spender];
    }

    /// @notice Allows another address to spend up to amount token units from the caller.
    /// @dev The deployer must approve this contract for the ticket supply before buyTicket() can sell tickets.
    /// @param spender Address receiving the allowance.
    /// @param amount Number of token units approved for spending.
    /// @return True when the approval succeeds.
    function approve(address spender, uint256 amount) external override returns (bool) {
        require(spender != address(0), "ERC20: approve to the zero address");
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    /// @notice Transfers token units from one address to another using an allowance.
    /// @dev Decrements the caller's allowance before transferring to keep allowance state in sync.
    /// @param sender Address providing the token units.
    /// @param recipient Address receiving the token units.
    /// @param amount Number of token units to transfer.
    /// @return True when the transfer succeeds.
    function transferFrom(address sender, address recipient, uint256 amount) external override returns (bool) {
        require(_allowances[sender][msg.sender] >= amount, "ERC20: insufficient allowance");
        _allowances[sender][msg.sender] -= amount;
        _transfer(sender, recipient, amount);
        return true;
    }

    /**
     * @notice Buys one ticket by paying the fixed ticket price.
     * @dev Uses CEI ordering: checks the payment amount, checks and decrements
     * the deployer's allowance, then transfers one ticket to the buyer. Tickets
     * come from the deployer's wallet through the pre-approved allowance, not
     * from this contract's own token balance.
     */
    function buyTicket() external payable nonReentrant {
        require(msg.value == ticketPrice, "TicketToken: incorrect payment");
        require(_allowances[_deployer][address(this)] >= 1 * 10 ** 18, "TicketToken: no tickets available");
        _allowances[_deployer][address(this)] -= 1 * 10 ** 18;
        _transfer(_deployer, msg.sender, 1 * 10 ** 18);
    }

    /**
     * @notice Withdraws accumulated ticket sale ETH to the deployer.
     * @dev Deployer-only. Uses low-level call instead of transfer to avoid the
     * 2300 gas stipend limit, and is protected by nonReentrant.
     */
    function withdraw() external nonReentrant {
        require(msg.sender == _deployer, "TicketToken: only deployer");
        uint256 balance = address(this).balance;
        (bool success, ) = _deployer.call{value: balance}("");
        require(success, "TicketToken: withdrawal failed");
        emit Withdrawn(_deployer, balance);
    }
}
