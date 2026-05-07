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

    modifier nonReentrant() {
        require(_status == NOT_ENTERED, "TicketToken: reentrant call");
        _status = ENTERED;
        _;
        _status = NOT_ENTERED;
    }

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

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

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

    function allowance(address owner, address spender) external view override returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        require(spender != address(0), "ERC20: approve to the zero address");
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) external override returns (bool) {
        require(_allowances[sender][msg.sender] >= amount, "ERC20: insufficient allowance");
        _allowances[sender][msg.sender] -= amount;
        _transfer(sender, recipient, amount);
        return true;
    }

    function buyTicket() external payable nonReentrant {
        require(msg.value == ticketPrice, "TicketToken: incorrect payment");
        require(_allowances[_deployer][address(this)] >= 1 * 10 ** 18, "TicketToken: no tickets available");
        _allowances[_deployer][address(this)] -= 1 * 10 ** 18;
        _transfer(_deployer, msg.sender, 1 * 10 ** 18);
    }

    function withdraw() external nonReentrant {
        require(msg.sender == _deployer, "TicketToken: only deployer");
        uint256 balance = address(this).balance;
        (bool success, ) = _deployer.call{value: balance}("");
        require(success, "TicketToken: withdrawal failed");
        emit Withdrawn(_deployer, balance);
    }
}
