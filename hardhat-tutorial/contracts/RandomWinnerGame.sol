// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBase.sol";

contract RandomWinnerGame is VRFConsumerBase, Ownable {
    /* State variables */

    uint256 fee;
    bytes32 public keyHash;

    address[] public players;
    uint8 maxPlayers;
    bool public gameStarted;
    uint256 entryFee;
    uint256 public gameId;

    /* Events */

    event GameStarted(uint256 gameId, uint8 maxPlayers, uint256 entryFee);
    event PlayerJoined(uint256 gameId, address player);
    event GameEnded(uint256 gameId, address winner, bytes32 requestId);

    /* Constructor */

    constructor(
        address vrfCoordinator,
        address linkToken,
        bytes32 vrfKeyHash,
        uint256 vrfFee
    ) VRFConsumerBase(vrfCoordinator, linkToken) {
        keyHash = vrfKeyHash;
        fee = vrfFee;
        gameStarted = false;
    }

    /* Functions */

    function startGame(uint8 _maxPlayers, uint256 _entryFee) public onlyOwner {
        require(!gameStarted, "Game already started!");
        delete players;
        maxPlayers = _maxPlayers;
        entryFee = _entryFee;
        gameStarted = true;
        gameId += 1;

        emit GameStarted(gameId, maxPlayers, entryFee);
    }

    function joinGame() public payable {
        require(gameStarted, "Game not started!");
        require(players.length < maxPlayers, "Game is full!");
        require(
            msg.value == entryFee,
            "Value sent is not equal to the entry fee!"
        );

        players.push(msg.sender);

        emit PlayerJoined(gameId, msg.sender);

        if (players.length == maxPlayers) {
            getRandomWinner();
        }
    }

    function getRandomWinner() private returns (bytes32 requestId) {
        require(LINK.balanceOf(address(this)) >= fee, "Not enough LINK");
        return requestRandomness(keyHash, fee);
    }

    function fulfillRandomness(bytes32 requestId, uint256 randomness)
        internal
        virtual
        override
    {
        uint256 winnerIndex = randomness % players.length;
        address winner = players[winnerIndex];
        (bool sent, ) = winner.call{value: address(this).balance}("");
        require(sent, "Failed to send Ether");

        emit GameEnded(gameId, winner, requestId);

        gameStarted = false;
    }

    receive() external payable {}

    fallback() external payable {}
}
