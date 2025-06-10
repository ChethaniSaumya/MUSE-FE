import React, { useEffect, useState } from 'react';
import { useWeb3Modal } from '@web3modal/react';
import { useAccount, useContractRead, useContractWrite, useNetwork, useSwitchNetwork, useDisconnect } from 'wagmi';
import { createPublicClient, formatEther, http } from 'viem';
import { pulsechainV4 } from 'wagmi/chains';
import nftImage from '../assets/Asha-Coin.png';

import contract from '../contractData/contract.json';
import '../UserPanel.css';

var Scroll = require('react-scroll');
var Link = Scroll.Link;

const UserPanel = () => {
  const [userData, setUserData] = useState(null);
  const [certificates, setCertificates] = useState([]);
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('nfts');
  const { open } = useWeb3Modal();
  const { chain } = useNetwork();
  const { switchNetwork } = useSwitchNetwork();
  const [_connected, setConnected] = useState(false);
  const { disconnect } = useDisconnect();
  const API_BASE_URL = 'https://muse-be.onrender.com'; //'http://localhost:5000';

  const { address: walletAddress } = useAccount({
    async onConnect() {
      handleConnect();
    }
  });

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

  const publicClient = createPublicClient({
    chain: pulsechainV4,
    transport: http()
  });

  // Helper function to get all token IDs for a wallet
  const getTokenIdsForWallet = async (wallet) => {
    try {
      const count = await publicClient.readContract({
        ...contract,
        functionName: 'userMinted',
        args: [wallet]
      });

      const tokenCount = Number(count);
      if (tokenCount === 0) return [];

      const ids = [];
      for (let i = 0; i < tokenCount; i++) {
        const id = await publicClient.readContract({
          ...contract,
          functionName: 'walletToTokenIds',
          args: [wallet, i]
        });
        ids.push(id.toString());
      }
      return ids;
    } catch (err) {
      console.error('Error fetching token IDs:', err);
      return [];
    }
  };

  // Fetch NFTs owned by the user
  const fetchUserNFTs = async (tokenIds = []) => {
    try {
      if (!walletAddress) {
        setNfts([]);
        return;
      }

      console.log('Fetching NFTs for token IDs:', tokenIds);

      // If no token IDs passed, try to get them from the contract
      let nftTokenIds = tokenIds;
      if (!nftTokenIds || nftTokenIds.length === 0) {
        nftTokenIds = await getTokenIdsForWallet(walletAddress);
      }

      console.log('Using token IDs for NFTs:', nftTokenIds);

      if (nftTokenIds.length === 0) {
        setNfts([]);
        return;
      }

      // Create NFT objects with your specific image
      const userNFTs = nftTokenIds.map(id => ({
        id: id,
        name: `MUSE NFT #${id}`,
        imageUrl: nftImage,
        sharePercentage: '5%', // You can update this with actual data if available
        buyPrice: '100 $MUSE', // You can update this with actual data if available
        royaltiesEarnedMuse: '25 $MUSE', // You can update this with actual data if available
        royaltiesEarnedUSDT: '50 USDT' // You can update this with actual data if available
      }));

      console.log('Created NFT objects:', userNFTs);
      setNfts(userNFTs);
    } catch (err) {
      console.error('Error fetching NFTs:', err);
      setNfts([]);
    }
  };

  // Process certificates from backend data
  const processCertificates = (userData, tokenIds) => {
    const processedCertificates = [];

    console.log('Processing certificates from userData:', userData);
    console.log('Token IDs from blockchain:', tokenIds);

    // Check if we have mints array (new structure)
    if (userData.mints && Array.isArray(userData.mints)) {
      userData.mints.forEach((mint, index) => {
        if (mint.certificateIpfsUrl || mint.ownershipCardUrl) {
          processedCertificates.push({
            id: mint.tokenId || `mint-${index}`,
            name: `${userData.name || 'ASHA'} Ownership Certificate`,
            url: mint.certificateIpfsUrl || `${API_BASE_URL}${mint.ownershipCardUrl}`,
            mintDate: mint.mintedAt,
            tokenId: mint.tokenId || tokenIds[index] || (index + 1).toString(),
            transactionHash: mint.transactionHash,
            type: 'ownership-certificate'
          });
        }
      });
    }
    // Fallback: Check for single certificate (legacy structure)
    else if (userData.certificateIpfsUrl || userData.ownershipCardUrl) {
      processedCertificates.push({
        id: userData.tokenId || '1',
        name: `${userData.name || 'ASHA'} Ownership Certificate`,
        url: userData.certificateIpfsUrl || `${API_BASE_URL}${userData.ownershipCardUrl}`,
        mintDate: userData.mintedAt || userData.lastMintedAt,
        tokenId: userData.tokenId || tokenIds[0] || '1',
        transactionHash: userData.transactionHash,
        type: 'ownership-certificate'
      });
    }

    console.log('Processed certificates:', processedCertificates);
    return processedCertificates;
  };

  // Fetch user data from both contract and backend
  const fetchUserData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Fetching user data for wallet:', walletAddress);

      // 1. Fetch from blockchain first
      const [totalMinted, tokenIds] = await Promise.all([
        publicClient.readContract({
          ...contract,
          functionName: 'userMinted',
          args: [walletAddress]
        }),
        getTokenIdsForWallet(walletAddress)
      ]);

      console.log('Blockchain data - Total minted:', Number(totalMinted), 'Token IDs:', tokenIds);

      // 2. Fetch from your backend API
      const userResponse = await fetch(`${API_BASE_URL}/api/users/wallet/${walletAddress}`);

      let userData = {};
      let backendError = null;

      if (userResponse.ok) {
        userData = await userResponse.json();
        console.log('Backend user data:', userData);
      } else {
        backendError = `Backend API error: ${userResponse.status}`;
        console.warn('Failed to fetch from backend:', backendError);
      }

      // 3. Combine data
      const combinedData = {
        ...userData,
        walletAddress,
        totalMinted: Math.max(Number(totalMinted), userData.totalMinted || 0),
        tokenIds,
        backendError
      };

      setUserData(combinedData);

      // 4. Process and set certificates
      const processedCertificates = processCertificates(userData, tokenIds);
      setCertificates(processedCertificates);

      // 5. Fetch user NFTs
      await fetchUserNFTs(tokenIds);

      console.log('Final combined data:', combinedData);
      console.log('Final certificates:', processedCertificates);

    } catch (err) {
      console.error('Error fetching user data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle certificate download
  const handleDownload = async (url, name) => {
    try {
      console.log('Downloading certificate from:', url);

      // Handle both IPFS URLs and local server URLs
      const downloadUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${name.replace(/[^a-z0-9]/gi, '_')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download failed:', err);
      setError(`Failed to download certificate: ${err.message}`);
    }
  };

  // Handle certificate view
  const handleView = (url) => {
    console.log('Viewing certificate:', url);

    // Handle both IPFS URLs and local server URLs
    const viewUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    window.open(viewUrl, '_blank');
  };

  useEffect(() => {
    if (walletAddress) {
      fetchUserData();
    }
  }, [walletAddress]);

  if (!walletAddress) {
    return (
      <div className="user-panel-container">
        <header className="user-panel-header">
          <div className="user-panel-title">
            <Link activeClass="" id="fontSize" onClick={() => window.location.href = '/'}><h1>User Portal</h1></Link>
          </div>

          {_connected ? (
            <button
              className="connect-wallet-btn"
              onClick={disconnectWallet}
            >
              <i className="fas fa-wallet"></i> {shortenAddress(walletAddress)}
            </button>
          ) : (
            <button
              className="connect-wallet-btn"
              onClick={open}
            >
              <i className="fas fa-wallet"></i> Connect Wallet
            </button>
          )}        </header>
        <div className="user-panel-content">
          <div className="empty-state">
            <i className="fas fa-wallet"></i>
            <h3>Wallet Not Connected</h3>
            <p>Please connect your wallet to view your account details and certificates.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="user-panel-container">
        <header className="user-panel-header">
          <div className="user-panel-title">
            <Link activeClass="" id="fontSize" onClick={() => window.location.href = '/'}><h1>User Portal</h1></Link>
          </div>

          {_connected ? (
            <button
              className="connect-wallet-btn"
              onClick={disconnectWallet}
            >
              <i className="fas fa-wallet"></i> {shortenAddress(walletAddress)}
            </button>
          ) : (
            <button
              className="connect-wallet-btn"
              onClick={open}
            >
              <i className="fas fa-wallet"></i> Connect Wallet
            </button>
          )}
        </header>
        <div className="user-panel-content">
          <div className="loading-spinner">
            <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--gold-accent)' }}></i>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-panel-container">
        <header className="user-panel-header">
          <div className="user-panel-title">
            <Link activeClass="" id="fontSize" onClick={() => window.location.href = '/'}><h1>User Portal</h1></Link>
          </div>

          {_connected ? (
            <button
              className="connect-wallet-btn"
              onClick={disconnectWallet}
            >
              <i className="fas fa-wallet"></i> {shortenAddress(walletAddress)}
            </button>
          ) : (
            <button
              className="connect-wallet-btn"
              onClick={open}
            >
              <i className="fas fa-wallet"></i> Connect Wallet
            </button>
          )}        </header>
        <div className="user-panel-content">
          <div className="empty-state">
            <i className="fas fa-exclamation-triangle"></i>
            <h3>Error Loading Data</h3>
            <p>{error}</p>
            <button className="refresh-btn" onClick={fetchUserData}>
              <i className="fas fa-sync-alt"></i> Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="user-panel-container">
      <header className="user-panel-header">
        <div className="user-panel-title">
          <Link activeClass="" id="fontSize" onClick={() => window.location.href = '/'}><h1>User Portal</h1></Link>
        </div>

        {_connected ? (
          <button
            className="connect-wallet-btn"
            onClick={disconnectWallet}
          >
            <i className="fas fa-wallet"></i> {shortenAddress(walletAddress)}
          </button>
        ) : (
          <button
            className="connect-wallet-btn"
            onClick={open}
          >
            <i className="fas fa-wallet"></i> Connect Wallet
          </button>
        )}
      </header>

      <div className="user-panel-content">
        <div className="user-dashboard">
          {/* Sidebar with user profile */}
          <div className="user-sidebar">
            <div className="user-profile">
              <div className="user-avatar">
                <i className="fas fa-user"></i>
              </div>
              <h3 className="user-name">{userData?.name || 'Anonymous'}</h3>
              <div className="user-wallet">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </div>
            </div>

            <div className="user-stats">
              <div className="stat-item">
                <span className="stat-label">NFTs Minted:</span>
                <span className="stat-value">{userData?.totalMinted || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Equivalent in MySCoins:</span>
                <span className="stat-value">
                  {(userData?.totalMinted || 0) * 100}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Equivalent in USD:</span>
                <span className="stat-value">
                  ${((userData?.totalMinted || 0) * 100 * 0.5).toFixed(2)}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Muse coin balance:</span>
                <span className="stat-value">
                  0 $MUSE {/* Placeholder - you'll need to fetch actual balance */}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Email:</span>
                <span className="stat-value">
                  {userData?.email || 'Not provided'}
                </span>
              </div>
            </div>

            <button
              className="marketplace-btn"
              onClick={() => window.open('/marketplace', '_blank')}
            >
              <i className="fas fa-store"></i> Visit the Marketplace
            </button>
          </div>

          {/* Main content area */}
          <div className="user-main">
            <div className="section-header">
              <div className="tabs-container">
                <button
                  className={`tab-btn ${activeTab === 'nfts' ? 'active' : ''}`}
                  onClick={() => setActiveTab('nfts')}
                >
                  <i className="fas fa-image"></i> My Owned NFTs
                </button>
                <button
                  className={`tab-btn ${activeTab === 'certificates' ? 'active' : ''}`}
                  onClick={() => setActiveTab('certificates')}
                >
                  <i className="fas fa-certificate"></i> My Certificates
                </button>
              </div>

              <button
                className="refresh-btn"
                onClick={fetchUserData}
                style={{ marginLeft: 'auto', fontSize: '0.9em', padding: '8px 16px' }}
              >
                <i className="fas fa-sync-alt"></i> Refresh
              </button>
            </div>

            {activeTab === 'certificates' ? (
              <>
                <h2 className="section-title">
                  <i className="fas fa-certificate"></i> Muse Certificates
                </h2>

                {certificates.length > 0 ? (
                  <div className="certificates-grid">
                    {certificates.map((cert, index) => (
                      <div className="certificate-card" key={cert.id || index}>
                        <img
                          src={cert.url.startsWith('http') ? cert.url : `${API_BASE_URL}${cert.url}`}
                          alt={cert.name}
                          className="certificate-image"
                          onError={(e) => {
                            console.error('Failed to load certificate image:', cert.url);
                            e.target.onerror = null;
                            e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgZmlsbD0iI2Y1ZjVmNSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBub3QgYXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==';
                          }}
                        />
                        <div className="certificate-details">
                          <h4 className="certificate-name">{cert.name}</h4>
                          <div className="certificate-meta">
                            <span>Token #{cert.tokenId}</span>
                            <span>
                              {cert.mintDate ? new Date(cert.mintDate).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>
                          <div className="certificate-actions">
                            <button
                              className="action-btn view-btn"
                              onClick={() => handleView(cert.url)}
                            >
                              <i className="fas fa-eye"></i> View
                            </button>
                            <button
                              className="action-btn download-btn2"
                              onClick={() => handleDownload(cert.url, cert.name)}
                            >
                              <i className="fas fa-download"></i> Download
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <i className="fas fa-certificate"></i>
                    <h3>No Certificates Found</h3>
                    <p>
                      {userData?.totalMinted > 0
                        ? "Your certificates may still be generating or there was an issue accessing them."
                        : "You haven't minted any NFTs yet."
                      }
                    </p>
                    {userData?.totalMinted > 0 && (
                      <div>
                        <p>If you've recently minted, your certificates may take a few minutes to generate.</p>
                        <button className="refresh-btn" onClick={fetchUserData} style={{ marginTop: '10px' }}>
                          <i className="fas fa-sync-alt"></i> Check Again
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="nft-section-header">
                  <h2 className="section-title">
                    <i className="fas fa-image"></i> Muse NFTs
                  </h2>
                  <span className="share-percentage">Share Percentage: 5%</span>
                </div>
                {nfts.length > 0 ? (
                  <div className="nfts-grid">
                    {nfts.map((nft) => (
                      <div className="nft-card" key={nft.id}>
                        <img
                          src={nft.imageUrl}
                          alt={nft.name}
                          className="nft-image"
                        />
                        <div className="nft-details">
                          <h4 className="nft-name">{nft.name}</h4>

                          {/*<div className="nft-stats">
                            <div className="nft-stat">
                              <span className="stat-label">Share Percentage:</span>
                              <span className="stat-value">{nft.sharePercentage}</span>
                            </div>
                            <div className="nft-stat">
                              <span className="stat-label">Royalties ($MUSE):</span>
                              <span className="stat-value">{nft.royaltiesEarnedMuse}</span>
                            </div>
                            <div className="nft-stat">
                              <span className="stat-label">Royalties (USDT):</span>
                              <span className="stat-value">{nft.royaltiesEarnedUSDT}</span>
                            </div>
                          </div>*/}
                          <div className="nft-actions">
                            {/*} <button className="action-btn buy-btn">
                              <i className="fas fa-shopping-cart"></i> Buy More
                            </button>*/}
                            <button className="action-btn sell-btn">
                              <i className="fas fa-coins"></i> Sell
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <i className="fas fa-image"></i>
                    <h3>You have no NFTs</h3>
                    <p>You don't own any MUSE NFTs yet.</p>

                  </div>
                )}

                {nfts.length > 0 && (
                  <div className="royalties-section">
                    <h3 className="royalties-title">Royalties</h3>
                    <div className="royalties-table">
                      <div className="royalties-row header">
                        <div className="royalties-cell">NFT ID</div>
                        <div className="royalties-cell">Share %</div>
                        <div className="royalties-cell">Royalties Earned</div>
                        <div className="royalties-cell">Action</div>
                      </div>

                      {nfts.map((nft) => (
                        <div className="royalties-row" key={nft.id}>
                          <div className="royalties-cell">#{nft.id}</div>
                          <div className="royalties-cell">{nft.sharePercentage}</div>
                          <div className="royalties-cell">
                            <div>{nft.royaltiesEarnedMuse}</div>
                            {/*<div>{nft.royaltiesEarnedUSDT}</div>*/}
                          </div>
                          <div className="royalties-cell">
                            <button className="withdraw-btn">
                              <i className="fas fa-wallet"></i> Withdraw
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserPanel;
