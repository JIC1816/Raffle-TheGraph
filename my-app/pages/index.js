import { BigNumber, Contract, ethers, providers, utils } from "ethers";
import Head from "next/head";
import React, { useEffect, useState, useRef } from "react";
import Web3Modal from "web3modal";
import { abi, RANDOM_GAME_NFT_CONTRACT_ADDRESS } from "../constants";
import { FETCH_CREATED_GAME } from "../queries";
import styles from "../styles/Home.module.css";
import { subgraphQuery } from "../utils";

export default function Home() {
  const zero = BigNumber.from("0");
  const [walletConnected, setWalletConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [entryFee, setEntryFee] = useState(zero);
  const [maxPlayers, setMaxPlayers] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [players, setPlayers] = useState([]);
  const [winner, setWinner] = useState();
  const [logs, setLogs] = useState([]);
  const web3ModalRef = useRef();

  const forceUpdate = React.useReducer(() => ({}), {})[1];

  const connectWallet = async () => {
    try {
      await getProviderOrSigner();
      setWalletConnected(true);
    } catch (err) {
      console.error(err);
    }
  };

  const getProviderOrSigner = async (needSigner = false) => {
    const provider = await web3ModalRef.current.connect();
    const web3Provider = new providers.Web3Provider(provider);

    const { chainId } = await web3Provider.getNetwork();
    if (chainId !== 80001) {
      window.alert("Change the network to Mumbai");
      throw new Error("Change the network to Mumbai");
    }

    if (needSigner) {
      const signer = web3Provider.getSigner();
      return signer;
    }
    return web3Provider;
  };

  const startGame = async () => {
    try {
      const signer = await getProviderOrSigner(true);
      const randomGameNFTContract = new Contract(
        RANDOM_GAME_NFT_CONTRACT_ADDRESS,
        abi,
        signer
      );
      setLoading(true);

      const tx = await randomGameNFTContract.startGame(maxPlayers, entryFee);
      await tx.wait();
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const joinGame = async () => {
    try {
      const signer = await getProviderOrSigner(true);
      const randomGameNFTContract = new Contract(
        RANDOM_GAME_NFT_CONTRACT_ADDRESS,
        abi,
        signer
      );
      setLoading(true);

      const tx = await randomGameNFTContract.joinGame({
        value: entryFee,
      });
      await tx.wait();
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const checkIfGameStarted = async () => {
    try {
      const provider = await getProviderOrSigner();
      const randomGameNFTContract = new Contract(
        RANDOM_GAME_NFT_CONTRACT_ADDRESS,
        abi,
        provider
      );
      const _gameStarted = await randomGameNFTContract.gameStarted();

      const _gameArray = await subgraphQuery(FETCH_CREATED_GAME());
      const _game = _gameArray.games[0];
      let _logs = [];

      if (_gameStarted) {
        _logs = [`Game has started with ID: ${_game.id}`];
        if (_game.players && _game.players.length > 0) {
          _logs.push(
            `${_game.players.length} / ${_game.maxPlayers} players already joined`
          );
          _game.players.forEach((player) => {
            _logs.push(`${player} joined the game`);
          });
        }
        setEntryFee(BigNumber.from(_game.entryFee));
        setMaxPlayers(_game.maxPlayers);
      } else if (!gameStarted && _game.winner) {
        _logs = [
          `Last game has ended with ID: ${_game.id}`,
          `Winner: ${_game.winner}`,
          `Waiting for the next game to start...`,
        ];

        setWinner(_game.winner);
      }
      setLogs(_logs);
      setPlayers(_game.players);
      setGameStarted(_gameStarted);
      forceUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  const getOwner = async () => {
    try {
      const provider = await getProviderOrSigner();
      const randomGameNFTContract = new Contract(
        RANDOM_GAME_NFT_CONTRACT_ADDRESS,
        abi,
        provider
      );

      const _owner = await randomGameNFTContract.owner();
      const signer = await getProviderOrSigner(true);
      const address = await signer.getAddress();
      if (address.toLowerCase() === _owner.toLowerCase()) {
        setIsOwner(true);
      }
    } catch (err) {
      console.error(err.message);
    }
  };

  useEffect(() => {
    if (!walletConnected) {
      web3ModalRef.current = new Web3Modal({
        network: "mumbai",
        providerOptions: {},
        disableInjectedProvider: false,
      });
      connectWallet();
      getOwner();
      checkIfGameStarted();
      setInterval(() => {
        checkIfGameStarted();
      }, 3000);
    }
  }, [walletConnected]);

  const renderButton = () => {
    if (!walletConnected) {
      return (
        <button onClick={connectWallet} className={styles.button}>
          Connect your Wallet
        </button>
      );
    }

    if (loading) {
      return <button className={styles.button}>Loading...</button>;
    }

    if (gameStarted) {
      if (players.length === maxPlayers) {
        return (
          <button className={styles.button} disabled>
            Choosing a winner...
          </button>
        );
      }
      return (
        <div>
          <button onClick={joinGame} className={styles.button}>
            Join Game
          </button>
        </div>
      );
    }

    if (isOwner && !gameStarted) {
      return (
        <div>
          <input
            type="number"
            className={styles.input}
            placeholder="Entry Fee (in ETH)"
            onChange={(e) => {
              setEntryFee(
                e.target.value >= 0
                  ? utils.parseEther(e.target.value.toString())
                  : zero
              );
            }}
          />
          <input
            type="number"
            className={styles.input}
            placeholder="Max Players"
            onChange={(e) => {
              setMaxPlayers(e.target.value ?? 0);
            }}
          />
          <button onClick={startGame} className={styles.button}>
            Start Game
          </button>
        </div>
      );
    }
  };

  return (
    <div>
      <Head>
        <title>Random Winner Game</title>
        <meta name="description" content="Random Winner Game" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className={styles.main}>
        <div>
          <h1 className={styles.title}>Welcome to Random Winner Game!</h1>
          <div className={styles.description}>
            This is a lottery game where a winner is chosen randomly and wins
            the entire lottery pool.
          </div>
          {renderButton()}
          {logs &&
            logs.map((log, index) => {
              <div className={styles.log} key={index}>
                {log}
              </div>;
            })}
        </div>
        <div>
          <img className={styles.image} src="./randomWinner.png" />
        </div>
      </div>

      <footer className={styles.footer}>Made with &#10084; by Your Name</footer>
    </div>
  );
}
