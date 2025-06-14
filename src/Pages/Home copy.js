/* eslint-disable jsx-a11y/alt-text */
/* eslint-disable no-undef */
import React, { useEffect, useState } from 'react';
import '../App.css';
import nftImage from '../assets/Asha-Coin.png';

import { useWeb3Modal } from '@web3modal/react';
import { useAccount, useContractRead, useContractWrite, useNetwork, useSwitchNetwork, useDisconnect } from 'wagmi';
import { createPublicClient, formatEther, http } from 'viem';
import { pulsechainV4 } from 'wagmi/chains';

import contract from '../contractData/contract.json';

var Scroll = require('react-scroll');
var Link = Scroll.Link;

const Home = () => {
	const { open } = useWeb3Modal();
	const { chain } = useNetwork();
	const { switchNetwork } = useSwitchNetwork();
	const [_connected, setConnected] = useState(false);
	const { disconnect } = useDisconnect();
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [message, setMessage] = useState('');

	// Mint-specific states
	const [isMinting, setIsMinting] = useState(false);
	const [mintSuccess, setMintSuccess] = useState(false);
	const [mintError, setMintError] = useState(false);
	const [insufficientFunds, setInsufficientFunds] = useState(false);
	const [downloadUrl, setDownloadUrl] = useState(null);
	const [showDownloadSuccess, setShowDownloadSuccess] = useState(false);
	const [isDownloading, setIsDownloading] = useState(false);
	const [isCertificatePreparing, setIsCertificatePreparing] = useState(false);
	const [existingEmail, setExistingEmail] = useState('');
	const [hasExistingEmail, setHasExistingEmail] = useState(false);
	const [existingName, setExistingName] = useState('');
	const [hasExistingName, setHasExistingName] = useState(false);
	const [isLoadingUserData, setIsLoadingUserData] = useState(false);

	const { address: walletAddress } = useAccount({
		async onConnect() {
			handleConnect();
		}
	});

	const publicClient = createPublicClient({
		chain: pulsechainV4,
		transport: http()
	});

	const { writeAsync } = useContractWrite({
		...contract,
		functionName: 'mint',
		onError(error) {
			console.error('Contract write error:', error);
			if (error.message.includes('balance')) {
				setMintError(true);
				setIsMinting(false);
			}
		}
	});

	// Read contract data for pricing
	const { data: basePrice } = useContractRead({
		...contract,
		functionName: 'basePrice',
	});

	const { data: additionalPrice } = useContractRead({
		...contract,
		functionName: 'additionalPrice',
	});

	/*const { data: userMintedCount } = useContractRead({
		...contract,
		functionName: 'userMinted',
		args: [walletAddress],
		enabled: !!walletAddress,
	});*/

	const { data: userMintedCount, isLoading: isLoadingMintCount } = useContractRead({
		...contract,
		functionName: 'userMinted',
		args: [walletAddress],
		enabled: !!walletAddress,
		watch: true, // This will refetch when the value changes
	});

	// API endpoint - update this to match your backend URL
	const API_BASE_URL = 'http://localhost:5000'; //'https://muse-be.onrender.com'; //'http://localhost:5000';

	async function handleConnect() {
		if (chain.id !== 943) {
			switchNetwork(943);
		}
		setConnected(true);
	}

	async function disconnectWallet() {
		setConnected(false);
		disconnect();
	}

	function shortenAddress(walletAddress) {
		try {
			return _connected
				? walletAddress.slice(0, 3) + "..." + walletAddress.slice(-4)
				: "Connect";
		} catch (error) {
			console.log(error);
			return "Connect";
		}
	}

	// Calculate mint cost based on user's minting history
const calculateMintCost = () => {
    if (!basePrice || !additionalPrice || userMintedCount === undefined) {
        return BigInt(0);
    }

    console.log("userMintedCount:", userMintedCount);
    console.log("basePrice:", basePrice);
    console.log("additionalPrice:", additionalPrice);

    // First NFT uses basePrice (0 ether), subsequent NFTs use additionalPrice (0.1 ether)
    const mintCount = Number(userMintedCount);
    const costBigInt = mintCount === 0 ? basePrice : additionalPrice;
    
    console.log("Calculated cost as BigInt:", costBigInt);
    return costBigInt;
};

	const fetchUserDataByWallet = async (walletAddress) => {
		if (!walletAddress) return;

		setIsLoadingUserData(true);
		try {
			const response = await fetch(`${API_BASE_URL}/api/users/wallet/${walletAddress}`);
			if (response.ok) {
				const userData = await response.json();
				if (userData.email) {
					setExistingEmail(userData.email);
					setHasExistingEmail(true);
					setEmail(userData.email); // Set the email state
				}
				if (userData.name) {
					setExistingName(userData.name);
					setHasExistingName(true);
					setName(userData.name); // Set the name state
				}
			} else {
				// User doesn't exist, reset states
				setExistingEmail('');
				setHasExistingEmail(false);
				setExistingName('');
				setHasExistingName(false);
				setEmail('');
				setName('');
			}
		} catch (error) {
			console.error('Error fetching user data:', error);
			setExistingEmail('');
			setHasExistingEmail(false);
			setExistingName('');
			setHasExistingName(false);
		} finally {
			setIsLoadingUserData(false);
		}
	};

	useEffect(() => {
		if (walletAddress && _connected) {
			fetchUserDataByWallet(walletAddress);
		} else {
			// Reset when wallet disconnects
			setExistingEmail('');
			setHasExistingEmail(false);
			setExistingName('');
			setHasExistingName(false);
			setEmail('');
			setName('');
		}
	}, [walletAddress, _connected]);

	// Check if this is the user's first mint
	const isFirstMint = () => {
		return userMintedCount !== undefined && Number(userMintedCount) === 0;
	};

	// Function to handle NFT minting
const mintNFT = async () => {
    if (!walletAddress) {
        setMessage('Please connect your wallet first');
        return;
    }

    const nameToUse = hasExistingName ? existingName : name.trim();
    const emailToUse = hasExistingEmail ? existingEmail : email.trim();

    if (!nameToUse) {
        setMessage('Please fill in your name');
        return;
    }

    if (!emailToUse) {
        setMessage('Please enter your email address');
        return;
    }

    if (!hasExistingEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailToUse)) {
            setMessage('Please enter a valid email address');
            return;
        }
    }

    try {
        setIsMinting(true);
        setMintError(false);
        setMintSuccess(false);
        setInsufficientFunds(false);
        setMessage('Initiating mint transaction...');

        // Get the current mint cost
        const mintCostBigInt = calculateMintCost();
        console.log("Mint cost being sent:", mintCostBigInt);
        console.log("User minted count at mint time:", userMintedCount);

        // Double-check the user's current mint count from the contract
        const currentMintCount = await publicClient.readContract({
            ...contract,
            functionName: 'userMinted',
            args: [walletAddress]
        });

        console.log("Current mint count from contract:", currentMintCount);

        // Recalculate cost based on fresh data
        const actualCost = Number(currentMintCount) === 0 ? basePrice : additionalPrice;
        console.log("Actual cost to send:", actualCost);

        const res = await writeAsync({
            functionName: 'mint',
            args: [1, nameToUse, emailToUse.toLowerCase()],
            value: actualCost, // Use the recalculated cost
            gasLimit: '685000'
        });

        setMessage('Transaction submitted. Waiting for confirmation...');

        const result = await publicClient.waitForTransactionReceipt(res);

        if (result.status === 'success') {
            setIsMinting(false);
            setMintSuccess(true);
            setMessage('NFT minted successfully! Preparing your certificate...');
            setIsCertificatePreparing(true);

            await saveUserDataToBackend(res.hash);

            // Only clear name if it wasn't an existing name
            if (!hasExistingName) {
                setName('');
            }
            // Only clear email if it wasn't an existing email
            if (!hasExistingEmail) {
                setEmail('');
            }
        } else {
            setMintSuccess(false);
            setMintError(true);
            setIsMinting(false);
            setMessage('Transaction failed. Please try again.');
        }
    } catch (error) {
        console.error("Mint transaction failed:", error);
        handleMintError(error);
    }
};

	const handleMintError = async (error) => {
		setIsMinting(false);

		if (error.message.includes("Transaction with hash")) {
			setMintSuccess(true);
			setMessage('Transaction successful! Preparing your certificate...');
			setIsCertificatePreparing(true);
			// **UPDATED: Make this async and await the result**
			await saveUserDataToBackend();
		} else if (error.message.includes("err: insufficient funds for gas")) {
			setInsufficientFunds(true);
			setMessage('Insufficient funds for gas fees');
		} else if (error.message.includes("User rejected the request")) {
			setMessage('Transaction cancelled by user');
		} else if (error.message.includes("Max per wallet exceeded")) {
			setMintError(true);
			setMessage('Maximum NFTs per wallet exceeded');
		} else if (error.message.includes("Max supply exceeded")) {
			setMintError(true);
			setMessage('Maximum supply reached');
		} else if (error.message.includes("Public mint not available")) {
			setMintError(true);
			setMessage('Public minting is not currently available');
		} else {
			setMintError(true);
			setMessage('Sorry, something went wrong. Please try again.');
		}
	};
	// Function to save user data to backend after successful mint
	// Function to save user data to backend after successful mint
	const saveUserDataToBackend = async (txHash = null) => {
		try {
			// Use existing name/email if available, otherwise use the input values
			const nameToUse = hasExistingName ? existingName : name.trim();
			const emailToUse = hasExistingEmail ? existingEmail : email.trim();

			// Get the latest token ID for this wallet
			let tokenId = null;
			if (walletAddress) {
				try {
					// First get the count of tokens for this wallet
					const tokenCount = await publicClient.readContract({
						...contract,
						functionName: 'userMinted',
						args: [walletAddress]
					});

					if (tokenCount && Number(tokenCount) > 0) {
						// Get the last token ID (at index: count - 1)
						const lastTokenId = await publicClient.readContract({
							...contract,
							functionName: 'walletToTokenIds',
							args: [walletAddress, Number(tokenCount) - 1]
						});
						tokenId = lastTokenId ? Number(lastTokenId) : null;
					}
				} catch (error) {
					console.error('Error fetching token ID:', error);
				}
			}

			const response = await fetch(`${API_BASE_URL}/api/users`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					name: nameToUse,
					email: emailToUse.toLowerCase(),
					walletAddress: walletAddress,
					transactionHash: txHash,
					tokenId: tokenId,
					nftMinted: true,
					mintedAt: new Date().toISOString()
				})
			});

			const data = await response.json();

			if (response.ok) {
				console.log('User data saved successfully to backend');

				// **NEW: Update local state to reflect the saved data**
				setExistingName(nameToUse);
				setHasExistingName(true);
				setName(nameToUse);
				setExistingEmail(emailToUse.toLowerCase());
				setHasExistingEmail(true);
				setEmail(emailToUse.toLowerCase());

				// Set download URL from response
				if (data.certificateIpfsUrl || data.ownershipCardUrl) {
					setDownloadUrl(data.certificateIpfsUrl || data.ownershipCardUrl);
					setIsCertificatePreparing(false);
					setMessage('Certificate ready for download!');
				}
			} else {
				console.error('Failed to save user data:', data.error);
			}
		} catch (error) {
			console.error('Error saving user data to backend:', error);
		}
	};

	// Function to handle download
	const handleDownload = async () => {
		if (!downloadUrl) return;

		setIsDownloading(true);
		setMessage('Downloading certificate...');

		try {
			// Fetch the file as a blob
			const response = await fetch(downloadUrl);
			if (!response.ok) {
				throw new Error('Failed to fetch certificate');
			}

			const blob = await response.blob();

			// Create object URL for the blob
			const blobUrl = window.URL.createObjectURL(blob);

			// Create and trigger download
			const link = document.createElement('a');
			link.href = blobUrl;
			link.download = `Asha-Coin-Certificate-${name.replace(/[^a-z0-9]/gi, '_')}.png`;
			link.style.display = 'none';

			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);

			// Clean up the object URL
			window.URL.revokeObjectURL(blobUrl);

			// Show success notification
			setShowDownloadSuccess(true);
			setMessage('Certificate downloaded successfully!');
			setTimeout(() => setShowDownloadSuccess(false), 3000);
		} catch (error) {
			console.error('Download failed:', error);
			setMessage('Failed to download certificate. Please try again.');
		} finally {
			setIsDownloading(false);
		}
	};

	// Clear message after 5 seconds
	useEffect(() => {
		if (message && !isMinting && !isDownloading && !isCertificatePreparing) {
			const timer = setTimeout(() => {
				setMessage('');
			}, 5000);
			return () => clearTimeout(timer);
		}
	}, [message, isMinting, isDownloading, isCertificatePreparing]);

	// Fetch download URL after successful mint
	useEffect(() => {
		if (mintSuccess && email && !downloadUrl) {
			const fetchUserData = async () => {
				try {
					await new Promise(resolve => setTimeout(resolve, 2000));
					const response = await fetch(`${API_BASE_URL}/api/users/${email}`);
					const data = await response.json();
					if (data.certificateIpfsUrl || data.ownershipCardUrl) {
						setDownloadUrl(data.certificateIpfsUrl || data.ownershipCardUrl);
						setIsCertificatePreparing(false);
						setMessage('Certificate ready for download!');
					}
				} catch (error) {
					console.error('Error fetching user data:', error);
				}
			};

			fetchUserData();
		}

	}, [mintSuccess, email, downloadUrl, userMintedCount]);

	// Disable mint button when certificate is being prepared
	const isMintDisabled = !_connected || isMinting || isDownloading || isCertificatePreparing;
	const isDownloadDisabled = !downloadUrl || isDownloading || isCertificatePreparing;

	const { data: walletTokenCount } = useContractRead({
		...contract,
		functionName: 'walletToTokenIds',
		args: [walletAddress], // This should return the array length when called without index
		enabled: !!walletAddress,
	});

	return (
		<div className="app-container">
			{/* Header with Gold Accent */}
			<header className="app-header">
				<div className="logo-container">
					<img src={nftImage} alt="MUSE NFTs NFT" className="nft-logo" />
					<div className="title-container">
						<h1>MUSE NFTS</h1>
						<p className="subtitle">Tribute to KK</p>
					</div>
				</div>

				<div className="nav-actions">
					{_connected && (
						<Link activeClass="" id="fontSize" onClick={() => window.location.href = 'user-panel'}>
							<button className="user-panel-btn" >
								<i className="fas fa-user"></i> User Portal
							</button></Link>
					)}
					{_connected ? (
						<button
							className="connect-wallet-btn"
							onClick={disconnectWallet}
							disabled={isMinting || isDownloading || isCertificatePreparing}
						>
							<i className="fas fa-wallet"></i> {shortenAddress(walletAddress)}
						</button>
					) : (
						<button
							className="connect-wallet-btn"
							onClick={open}
							disabled={isMinting || isDownloading || isCertificatePreparing}
						>
							<i className="fas fa-wallet"></i> Connect Wallet
						</button>
					)}
				</div>
			</header>

			{/* Main Content */}
			<main className="main-content">
				{/* Minting Section */}
				<section className="mint-section">
					<h2>Mint Your Commemorative NFT</h2>
					<p className="mint-description">Own a piece of this special tribute collection</p>

					{/* Display message */}
					{message && (
						<div className={`message ${mintSuccess || message.includes('successfully') ? 'success' :
							mintError || insufficientFunds ? 'error' :
								'info'
							}`}>
							{message}
						</div>
					)}

					<div className="form-group">
						<label htmlFor="name">Your Name</label>
						{hasExistingName ? (
							<div className="existing-email-display">
								<input
									type="text"
									id="name"
									value={existingName}
									disabled={true}
									className="email-readonly"
								/>
								<small className="email-note">This name is already associated with your wallet</small>
							</div>
						) : (
							<input
								type="text"
								id="name"
								maxLength="20"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Enter your name"
								disabled={isMinting || isDownloading || isCertificatePreparing || isLoadingUserData}
							/>
						)}
					</div>

					<div className="form-group">
						<label htmlFor="email">Email Address</label>
						{hasExistingEmail ? (
							<div className="existing-email-display">
								<input
									type="email"
									id="email"
									value={existingEmail}
									disabled={true}
									className="email-readonly"
								/>
								<small className="email-note">This email is already associated with your wallet</small>
							</div>
						) : (
							<input
								type="email"
								id="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="Enter your email"
								disabled={isMinting || isDownloading || isCertificatePreparing || isLoadingUserData}
							/>
						)}
						{isLoadingUserData && <small className="loading-note">Checking existing data...</small>}
					</div>

					<button
						className="mint-btn"
						onClick={mintNFT}
						disabled={isMintDisabled || isCertificatePreparing}
					>
						{isMinting
							? 'Minting...'
							: !_connected
								? 'Connect Wallet First'
								: isFirstMint()
									? 'Mint Now'
									: 'Mint Now'}
					</button>

					{!_connected && (
						<p id="wallet-warning">Please connect your wallet to mint NFTs</p>
					)}

					{/* Download Button - Shows after successful mint */}
					{mintSuccess && (
						<button
							className="download-btn"
							onClick={handleDownload}
							disabled={isDownloadDisabled}
						>
							{isCertificatePreparing ? (
								<span className="preparing-certificate">
									<span className="spinner"></span> Preparing Certificate...
								</span>
							) : isDownloading ? (
								<span className="downloading">
									<span className="spinner"></span> Downloading...
								</span>
							) : (
								'Download Certificate'
							)}
						</button>
					)}

					{/* Display mint cost - Enhanced version */}
					{_connected && basePrice && (
						<div className="mint-info-container">
							<div className="mint-cost-box">
								<div className="mint-cost-item">
									<span className="mint-cost-label">Mint Cost:</span>
									<span className={`mint-cost-value ${isFirstMint() ? 'free' : ''}`}>
										{isFirstMint()
											? "1st NFT is FREE!"
											: `${formatEther(calculateMintCost())} ETH`}
									</span>
								</div>
								{userMintedCount !== undefined && Number(userMintedCount) > 0 && (
									<div className="mint-cost-item">
										<span className="mint-cost-label">Your NFTs:</span>
										<span className="mint-cost-value">
											{userMintedCount.toString()} minted
										</span>
									</div>
								)}
							</div>
						</div>
					)}

					{!_connected ?
						<div className="mint-info-container">
							<div className="mint-cost-box">
								<div className="mint-cost-item">
									<span className="mint-cost-label">Mint Cost:</span>
									<span className={`mint-cost-value  'free' : ''}`}>
										1st NFT is FREE!
									</span>
								</div>

							</div>
						</div> : null}

					{/*<div className="opensea-link-container">
						<a
							href="https://opensea.io/collection/your-collection-name"
							target="_blank"
							rel="noopener noreferrer"
							className="opensea-link"
						>
							<i className="fab fa-opensea"></i> View on OpenSea
						</a>
					</div>*/}
				</section>


				{/* Description Section */}
				<section className="description-section">
					<div className="nft-showcase">
						<img src={nftImage} alt="MUSE NFTs NFT Preview" className="nft-preview" />
					</div>
					<div className="description-content">
						<h3>About MUSE NFTs</h3>
						<p>
							MUSE NFTs are a limited edition NFT collection created as a heartfelt tribute to KK,
							celebrating his extraordinary musical legacy. Each token in this exclusive collection
							represents a unique digital artwork honoring his contributions to the world of music.
						</p>
						<p>
							By minting an MUSE NFT, you're preserving a piece of musical history while
							supporting this commemorative initiative.
						</p>
					</div>
				</section>
			</main>

			{/* Footer */}
			<footer className="app-footer">
				<p>© {new Date().getFullYear()} MUSE NFTs - Tribute to KK. All rights reserved.</p>
			</footer>
		</div>
	);
};

export default Home;