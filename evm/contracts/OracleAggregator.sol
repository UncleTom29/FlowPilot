// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IChainlinkFeed {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

/// @title OracleAggregator
/// @notice Aggregates APR data from multiple DeFi protocols and provides
///         price feeds and AI portfolio signals for the FlowPilot Cadence contracts.
contract OracleAggregator {
    struct ProtocolAPR {
        string name;
        uint256 apr;    // basis points (e.g. 500 = 5.00%)
        uint256 updatedAt;
    }

    ProtocolAPR[] public protocols;
    address public owner;
    address public aiOracleAddress;

    // portfolioId → signed signal bytes from AI oracle
    mapping(bytes32 => bytes) public portfolioSignals;
    // portfolioId → timestamp of last signal update
    mapping(bytes32 => uint256) public signalTimestamps;

    event APRUpdated(uint256 indexed index, string name, uint256 apr, uint256 timestamp);
    event ProtocolAdded(uint256 indexed index, string name, uint256 apr);
    event PortfolioSignalSubmitted(bytes32 indexed portfolioId, uint256 timestamp);
    event AIOracleAddressSet(address indexed aiOracle);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "OracleAggregator: caller is not owner");
        _;
    }

    modifier onlyAIOracle() {
        require(msg.sender == aiOracleAddress, "OracleAggregator: caller is not AI oracle");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Transfer contract ownership
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "OracleAggregator: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Set the AI oracle address that can submit portfolio signals
    function setAIOracleAddress(address _aiOracle) external onlyOwner {
        require(_aiOracle != address(0), "OracleAggregator: zero address");
        aiOracleAddress = _aiOracle;
        emit AIOracleAddressSet(_aiOracle);
    }

    /// @notice Add a new protocol with initial APR
    function addProtocol(string calldata name, uint256 apr) external onlyOwner {
        require(bytes(name).length > 0, "OracleAggregator: empty name");
        protocols.push(ProtocolAPR(name, apr, block.timestamp));
        emit ProtocolAdded(protocols.length - 1, name, apr);
    }

    /// @notice Update APR for an existing protocol
    function updateAPR(uint256 index, uint256 apr) external onlyOwner {
        require(index < protocols.length, "OracleAggregator: index out of bounds");
        protocols[index].apr = apr;
        protocols[index].updatedAt = block.timestamp;
        emit APRUpdated(index, protocols[index].name, apr, block.timestamp);
    }

    /// @notice Returns the protocol with the highest current APR
    function getBestAPR()
        external
        view
        returns (string memory name, uint256 apr, uint256 index)
    {
        require(protocols.length > 0, "OracleAggregator: no protocols registered");
        uint256 bestIndex = 0;
        uint256 bestAPR = protocols[0].apr;

        for (uint256 i = 1; i < protocols.length; i++) {
            if (protocols[i].apr > bestAPR) {
                bestAPR = protocols[i].apr;
                bestIndex = i;
            }
        }

        return (protocols[bestIndex].name, protocols[bestIndex].apr, bestIndex);
    }

    /// @notice Get the number of registered protocols
    function getProtocolCount() external view returns (uint256) {
        return protocols.length;
    }

    /// @notice Get price from a Chainlink price feed
    function getPrice(address feed)
        external
        view
        returns (int256 price, uint256 timestamp)
    {
        require(feed != address(0), "OracleAggregator: zero address feed");
        (, int256 answer, , uint256 updatedAt, ) = IChainlinkFeed(feed).latestRoundData();
        return (answer, updatedAt);
    }

    /// @notice Submit a signed portfolio rebalance signal (AI oracle only)
    function submitPortfolioSignal(bytes32 portfolioId, bytes calldata signal)
        external
        onlyAIOracle
    {
        require(signal.length > 0, "OracleAggregator: empty signal");
        portfolioSignals[portfolioId] = signal;
        signalTimestamps[portfolioId] = block.timestamp;
        emit PortfolioSignalSubmitted(portfolioId, block.timestamp);
    }

    /// @notice Get the latest portfolio signal for a given portfolio ID
    function getPortfolioSignal(bytes32 portfolioId)
        external
        view
        returns (bytes memory signal, uint256 timestamp)
    {
        return (portfolioSignals[portfolioId], signalTimestamps[portfolioId]);
    }
}
