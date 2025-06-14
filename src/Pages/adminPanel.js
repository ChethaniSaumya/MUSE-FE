import React, { useState, useEffect } from 'react';
import { useAccount, useContractRead, useContractWrite, usePrepareContractWrite, useDisconnect } from 'wagmi';
import { useWeb3Modal } from '@web3modal/react';
import contractABI from '../contractData/contract.json';
import '../Admin.css';

const AdminPanel = () => {
	const { open } = useWeb3Modal();
	const { address } = useAccount();
	const { disconnect } = useDisconnect();
	const [isOwner, setIsOwner] = useState(false);
	const [loading, setLoading] = useState(true);
	const [notification, setNotification] = useState(null);
	const [activeUpdate, setActiveUpdate] = useState(null);

	// State variables
	const [publicMintStatus, setPublicMintStatusState] = useState(false);
	const [maxPerWallet, setMaxPerWalletState] = useState(1);
	const [additionalPrice, setAdditionalPriceState] = useState(0);

	// Contract configuration
	const contractConfig = {
		address: contractABI.address,
		abi: contractABI.abi,
	};

	// Check if connected wallet is owner
	const { data: ownerAddress } = useContractRead({
		...contractConfig,
		functionName: 'owner',
	});

	// Read current contract settings
	const { data: currentPublicMintStatus, refetch: refetchPublicMintStatus } = useContractRead({
		...contractConfig,
		functionName: 'public_mint_status',
	});

	const { data: currentMaxPerWallet, refetch: refetchMaxPerWallet } = useContractRead({
		...contractConfig,
		functionName: 'max_per_wallet',
	});

	const { data: currentAdditionalPrice, refetch: refetchAdditionalPrice } = useContractRead({
		...contractConfig,
		functionName: 'additionalPrice',
	});

	// Prepare contract write functions
	const { config: publicMintConfig } = usePrepareContractWrite({
		...contractConfig,
		functionName: 'setPublic_mint_status',
		args: [publicMintStatus],
		enabled: isOwner,
	});

	const { config: maxPerWalletConfig } = usePrepareContractWrite({
		...contractConfig,
		functionName: 'setMax_per_wallet',
		args: [maxPerWallet],
		enabled: isOwner,
	});

	const { config: additionalPriceConfig } = usePrepareContractWrite({
		...contractConfig,
		functionName: 'setAdditionalPrice',
		args: [(additionalPrice * 1000000000000000000).toString()],
		enabled: isOwner && !isNaN(additionalPrice) && additionalPrice >= 0,
	});

	// Contract write hooks
	const { write: updatePublicMintStatus } = useContractWrite({
		...publicMintConfig,
		onSuccess: async () => {
			setActiveUpdate(null);
			showNotification('Public mint status updated successfully', 'success');
			// Reload page after 1 second
			setTimeout(() => {
				window.location.reload();
			}, 1000);
		},
		onError: (error) => {
			showNotification(`Failed: ${error.shortMessage || error.message}`, 'error');
			setActiveUpdate(null);
		}
	});

	const { write: updateMaxPerWallet } = useContractWrite({
		...maxPerWalletConfig,
		onSuccess: async () => {
			setActiveUpdate(null);
			showNotification('Max per wallet updated successfully', 'success');
			// Reload page after 1 second
			setTimeout(() => {
				window.location.reload();
			}, 1000);
		},
		onError: (error) => {
			showNotification(`Failed: ${error.shortMessage || error.message}`, 'error');
			setActiveUpdate(null);
		}
	});

	const { write: updateAdditionalPrice } = useContractWrite({
		...additionalPriceConfig,
		onSuccess: async () => {
			setActiveUpdate(null);
			showNotification('Additional price updated successfully', 'success');
			// Reload page after 1 second
			setTimeout(() => {
				window.location.reload();
			}, 1000);
		},
		onError: (error) => {
			showNotification(`Failed: ${error.shortMessage || error.message}`, 'error');
			setActiveUpdate(null);
		}
	});

	// Show notification function
	const showNotification = (message, type = 'success') => {
		setNotification({ message, type });

		setTimeout(() => {
			setNotification(null);
		}, 5000);
	};

	// Check owner status
	useEffect(() => {
		if (address && ownerAddress) {
			setIsOwner(address.toLowerCase() === ownerAddress.toLowerCase());
			setLoading(false);
		} else {
			setLoading(false);
		}
	}, [address, ownerAddress]);

	// Set initial form values from contract
	useEffect(() => {
		if (currentPublicMintStatus !== undefined) {
			setPublicMintStatusState(currentPublicMintStatus);
		}
		if (currentMaxPerWallet !== undefined) {
			setMaxPerWalletState(Number(currentMaxPerWallet));
		}
		if (currentAdditionalPrice !== undefined) {
			setAdditionalPriceState(Number(currentAdditionalPrice) / 1000000000000000000);
		}
	}, [currentPublicMintStatus, currentMaxPerWallet, currentAdditionalPrice]);

	// Handle form submissions
	const handlePublicMintStatusChange = async () => {
		if (!updatePublicMintStatus) return;
		try {
			setActiveUpdate('publicMintStatus');
			await updatePublicMintStatus();
		} catch (err) {
			setActiveUpdate(null);
		}
	};

	const handleMaxPerWalletChange = async () => {
		if (!updateMaxPerWallet) return;
		try {
			setActiveUpdate('maxPerWallet');
			await updateMaxPerWallet();
		} catch (err) {
			setActiveUpdate(null);
		}
	};

	const handleAdditionalPriceChange = async () => {
		if (!updateAdditionalPrice) return;
		try {
			setActiveUpdate('additionalPrice');
			await updateAdditionalPrice();
		} catch (err) {
			setActiveUpdate(null);
		}
	};

	if (loading) {
		return <div className="admin-loading">Loading...</div>;
	}

	if (!address) {
		return (
			<div className="admin-connect-wallet">
				<h2>Admin Panel</h2>
				<p className='cWallet'>Please connect your wallet to access the admin panel</p>
				<button onClick={() => open()} className="connect-wallet-btn3">
					Connect Wallet
				</button>
			</div>
		);
	}

	if (!isOwner) {
		return (
			<div className="admin-not-owner">
				<h2>Admin Panel</h2>
				<p className="error-message">You are not the owner of this contract</p>
				<p className="cWallet">Connected wallet: {address}</p>
			</div>
		);
	}

	return (
		<div className="admin-container">
			<header className="admin-header">
				<h1>MUSE NFTs Admin Panel</h1>
				<div className="wallet-info">
					<p className="wallet-address">Connected as: {address}</p>
					<button onClick={() => disconnect()} className="disconnect-btn">
						Disconnect
					</button>
				</div>
			</header>

			<div className="admin-content">
				<section className="admin-section">
					<h2>Contract Settings</h2>

					<div className="admin-form-group">
						<label>Public Mint Status</label>
						<div className="toggle-switch">
							<input
								type="checkbox"
								id="publicMintStatus"
								checked={publicMintStatus}
								onChange={(e) => setPublicMintStatusState(e.target.checked)}
								disabled={activeUpdate !== null}
							/>
							<label htmlFor="publicMintStatus" className="toggle-label"></label>
						</div>
						<button
							onClick={handlePublicMintStatusChange}
							className="admin-submit-btn"
							disabled={!updatePublicMintStatus || activeUpdate !== null}
						>
							{activeUpdate === 'publicMintStatus' ? 'Updating...' : 'Update Status'}
						</button>
					</div>

					<div className="admin-form-group">
						<label>Max NFTs Per Wallet</label>
						<input
							type="number"
							min="1"
							value={maxPerWallet}
							onChange={(e) => setMaxPerWalletState(Number(e.target.value))}
							disabled={activeUpdate !== null}
						/>
						<button
							onClick={handleMaxPerWalletChange}
							className="admin-submit-btn"
							disabled={!updateMaxPerWallet || activeUpdate !== null}
						>
							{activeUpdate === 'maxPerWallet' ? 'Updating...' : 'Update Limit'}
						</button>
					</div>

					<div className="admin-form-group">
						<label>Additional Price (ETH)</label>
						<input
							type="number"
							step="0.01"
							min="0"
							value={additionalPrice}
							onChange={(e) => setAdditionalPriceState(Number(e.target.value))}
							disabled={activeUpdate !== null}
						/>
						<button
							onClick={handleAdditionalPriceChange}
							className="admin-submit-btn"
							disabled={!updateAdditionalPrice || activeUpdate !== null}
						>
							{activeUpdate === 'additionalPrice' ? 'Updating...' : 'Update Price'}
						</button>
					</div>
				</section>

				<section className="admin-section">
					<h2>Current Contract Settings</h2>
					<div className="contract-info">
						<p><strong>Contract Address:</strong> {contractABI.address}</p>
						<p><strong>Public Mint Status:</strong> {currentPublicMintStatus ? 'Enabled' : 'Disabled'}</p>
						<p><strong>Max Per Wallet:</strong> {currentMaxPerWallet?.toString()}</p>
						<p><strong>Additional Price:</strong> {currentAdditionalPrice ? (Number(currentAdditionalPrice) / 1000000000000000000) : 0} ETH</p>
					</div>
				</section>
			</div>

			{/* Notification */}
			{notification && (
				<div>
					<div className={`notification ${notification.type}`}>
						{notification.message}
					</div>
				</div>
			)}
		</div>
	);
};

export default AdminPanel;