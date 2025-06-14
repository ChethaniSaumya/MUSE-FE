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

const EditNameModal = ({ currentName, onSave, onClose }) => {
  const [newName, setNewName] = useState(currentName);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleSave = async () => {
    setIsUpdating(true);
    try {
      await onSave(newName.trim());
      onClose();
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="edit-modal-overlay">
      <div className="edit-modal">
        <div className="edit-modal-header">
          <h3>Edit User Name</h3>
          <div 
            className="close-modal-btn" 
            onClick={onClose}
            disabled={isUpdating} // Add disabled state here
          >
            <i className="fas fa-times"></i>
          </div>
        </div>
        <div className="edit-modal-body">
          <div className="form-group">
            <label>New Name</label>
            <input
              type="text"
              maxLength="20"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter new name"
              disabled={isUpdating} // Also disable input while updating
            />
          </div>
        </div>
        <div className="edit-modal-footer">
          <button
            className="cancel-btn"
            onClick={onClose}
            disabled={isUpdating} // This is the key change
          >
            Cancel
          </button>
          <button
            className="save-btn"
            onClick={handleSave}
            disabled={isUpdating || !newName.trim()}
          >
            {isUpdating ? <i className="fas fa-spinner fa-spin"></i> : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

const UserPanel = () => {
  const [userData, setUserData] = useState(null);
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('certificates');
  const [totalSupply, setTotalSupply] = useState(0);
  const { open } = useWeb3Modal();
  const { chain } = useNetwork();
  const { switchNetwork } = useSwitchNetwork();
  const [_connected, setConnected] = useState(false);
  const { disconnect } = useDisconnect();
  const [isEditingName, setIsEditingName] = useState(false);
  const [isDownloadingArchive, setIsDownloadingArchive] = useState(false);

  const API_BASE_URL = 'http://localhost:5000'; //'https://muse-be.onrender.com'; //'http://localhost:5000';

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

  // Get total supply from contract
  const getTotalSupply = async () => {
    try {
      const supply = await publicClient.readContract({
        ...contract,
        functionName: 'totalSupply'
      });
      return Number(supply);
    } catch (err) {
      console.error('Error fetching total supply:', err);
      return 0;
    }
  };

  // Replace the existing handleDownloadArchive function with this fixed version
  const handleDownloadArchive = async () => {
    try {
      if (!userData?.email) {
        setError('Email is required to download archive');
        return;
      }

      setIsDownloadingArchive(true);
      setError(null);

      // Test server connection first
      const healthCheck = await fetch(`${API_BASE_URL}/api/users`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!healthCheck.ok) {
        throw new Error(`Server not responding: ${healthCheck.status}`);
      }

      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = `${API_BASE_URL}/api/users/${encodeURIComponent(userData.email)}/download-archive`;
      link.download = `muse_archive_${userData.name?.replace(/[^a-z0-9]/gi, '_') || 'user'}.zip`;

      // Add link to body, click it, then remove it
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Optional: Show success message after a delay
      setTimeout(() => {
        console.log('Archive download initiated successfully');
      }, 1000);

    } catch (err) {
      console.error('Archive download failed:', err);
      let errorMessage = 'Failed to download archive: ';

      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        errorMessage += 'Cannot connect to server. Please check if the server is running.';
      } else if (err.message.includes('404')) {
        errorMessage += 'User data not found. Please ensure you have minted NFTs.';
      } else if (err.message.includes('500')) {
        errorMessage += 'Server error occurred. Please try again later.';
      } else {
        errorMessage += err.message;
      }

      setError(errorMessage);
    } finally {
      setIsDownloadingArchive(false);
    }
  };

  // Process certificates will be much simpler now
  const processCertificates = (tokenIds, certificatesFromAPI) => {
    // Create a map of tokenId to certificate data for quick lookup
    const certMap = new Map();
    certificatesFromAPI.forEach(cert => {
      certMap.set(cert.tokenId, cert);
    });

    // Return array of certificates for owned tokenIds
    return tokenIds.map(tokenId => {
      const certData = certMap.get(tokenId);
      return {
        id: tokenId,
        name: `MUSE Certificate #${tokenId}`,
        url: certData?.ipfsUrl || certData?.localUrl || '',
        tokenId: tokenId,
        type: 'ownership-certificate'
      };
    });
  };

  const fetchUserData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Fetching user data for wallet:', walletAddress);

      // 1. Get user details from Firebase based on wallet address
      let userDetails = null;
      try {
        const userResponse = await fetch(`${API_BASE_URL}/api/users/wallet/${walletAddress}`);
        if (userResponse.ok) {
          userDetails = await userResponse.json();
          console.log('User details from Firebase:', userDetails);
        }
      } catch (userError) {
        console.warn('Error fetching user details:', userError);
      }

      // 2. Get token IDs from blockchain and total supply
      const [tokenIds, totalSupplyCount] = await Promise.all([
        getTokenIdsForWallet(walletAddress),
        getTotalSupply()
      ]);

      console.log('Token IDs from blockchain:', tokenIds);
      console.log('Total supply:', totalSupplyCount);

      setTotalSupply(totalSupplyCount);

      // 3. Fetch certificate URLs for these token IDs
      let certificates = [];
      if (tokenIds.length > 0) {
        try {
          const certsResponse = await fetch(`${API_BASE_URL}/api/certificates/batch`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tokenIds })
          });

          if (certsResponse.ok) {
            const certsData = await certsResponse.json();
            certificates = certsData.certificates.map(cert => ({
              ...cert,
              id: cert.tokenId,
              name: `MUSE Certificate #${cert.tokenId}`,
              // Fix: Use the correct URL property from the API response
              url: cert.ipfsUrl || cert.localUrl || cert.url || ''
            }));
          }
        } catch (certError) {
          console.warn('Error fetching certificates:', certError);
        }
      }

      // 4. Combine data
      setUserData({
        walletAddress,
        name: userDetails?.name || 'Anonymous',
        email: userDetails?.email || '',
        tokenIds,
        totalMinted: tokenIds.length
      });
      setCertificates(certificates);

    } catch (err) {
      console.error('Error fetching user data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (url, name) => {
    try {
      if (!url) {
        throw new Error('Certificate URL is not available');
      }

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
    try {
      if (!url) {
        throw new Error('Certificate URL is not available');
      }

      console.log('Viewing certificate:', url);

      // Handle both IPFS URLs and local server URLs
      const viewUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
      window.open(viewUrl, '_blank');
    } catch (err) {
      console.error('View failed:', err);
      setError(`Failed to view certificate: ${err.message}`);
    }
  };

  const handleNameUpdate = async (newName) => {
    try {
      // Update all certificates for each token ID
      const updatePromises = userData.tokenIds.map(async (tokenId) => {
        const response = await fetch(`${API_BASE_URL}/api/users/${userData.email}/update-name`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            newName: newName,
            tokenId: tokenId
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to update certificate for token ${tokenId}`);
        }
        return response.json();
      });

      await Promise.all(updatePromises);

      // Refresh user data
      await fetchUserData();
    } catch (error) {
      console.error('Error updating name:', error);
      setError(`Failed to update name: ${error.message}`);
      throw error;
    }
  };

  // Calculate share percentage
  const calculateSharePercentage = (userMinted, totalSupply) => {
    if (totalSupply === 0) return 0;
    return ((userMinted / totalSupply) * 100).toFixed(2);
  };

  // Calculate royalties earned
  const calculateRoyaltiesEarned = (userMinted, totalSupply) => {
    if (totalSupply === 0) return 0;
    return ((10000 * userMinted) / totalSupply).toFixed(2);
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
              <div className="userNameEdit">
                <h3 className="user-name">{userData?.name || 'Anonymous'}</h3>
                {userData?.email && (
                  <button
                    className="edit-certificate-btn"
                    onClick={() => setIsEditingName(true)}
                    title="Edit Name"
                  >
                    <i className="fas fa-pencil-alt"></i> {/* Changed from fa-cog to fa-pencil-alt */}
                  </button>
                )}
              </div>
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
                <span className="stat-label">Equivalent in $MUSE:</span>
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
                  className={`tab-btn ${activeTab === 'certificates' ? 'active' : ''}`}
                  onClick={() => setActiveTab('certificates')}
                >
                  <i className="fas fa-certificate"></i> My Certificates
                </button>
                <button
                  className={`tab-btn ${activeTab === 'royalties' ? 'active' : ''}`}
                  onClick={() => setActiveTab('royalties')}
                >
                  <i className="fas fa-coins"></i> Royalties
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
                          src={cert.url || cert.ipfsUrl || cert.localUrl || ''}
                          alt={cert.name}
                          className="certificate-image"
                          onError={(e) => {
                            console.error('Failed to load certificate image:', cert.url || cert.ipfsUrl || cert.localUrl);
                            e.target.onerror = null;
                            e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';
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
                              onClick={() => {
                                const url = cert.url || cert.ipfsUrl || cert.localUrl;
                                if (url) {
                                  handleView(url);
                                } else {
                                  console.error('No URL available for certificate:', cert);
                                  setError('Certificate URL not available');
                                }
                              }}
                              disabled={!cert.url && !cert.ipfsUrl && !cert.localUrl}
                            >
                              <i className="fas fa-eye"></i> View
                            </button>
                            <button
                              className="action-btn download-btn2"
                              onClick={() => {
                                const url = cert.url || cert.ipfsUrl || cert.localUrl;
                                if (url) {
                                  handleDownload(url, cert.name);
                                } else {
                                  console.error('No URL available for certificate:', cert);
                                  setError('Certificate URL not available');
                                }
                              }}
                              disabled={!cert.url && !cert.ipfsUrl && !cert.localUrl}
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
                <h2 className="section-title">
                  <i className="fas fa-coins"></i> Royalties
                </h2>

                {userData?.totalMinted > 0 ? (
                  <div className="royalties-section">
  <div className="royalties-table">
    <div className="royalties-row header">
      <div className="royalties-cell">Project Name</div>
      <div className="royalties-cell">NFTs Owned</div>
      <div className="royalties-cell">Share %</div>
      <div className="royalties-cell">Royalties Earned</div>
      <div className="royalties-cell">Archive</div>
      <div className="royalties-cell">Action</div>
    </div>

    <div className="royalties-row">
      <div className="royalties-cell" data-label="Project:">MUSE</div>
      <div className="royalties-cell" data-label="NFTs Owned:">{userData?.totalMinted || 0}</div>
      <div className="royalties-cell" data-label="Share:">
        {calculateSharePercentage(userData?.totalMinted || 0, totalSupply)}%
      </div>
      <div className="royalties-cell" data-label="Royalties:">
        <div>{calculateRoyaltiesEarned(userData?.totalMinted || 0, totalSupply)} $MUSE</div>
      </div>
      <div className="royalties-cell" data-label="Archive:">
        <button
          className="download-archive-btn"
          onClick={handleDownloadArchive}
          disabled={!userData?.email || isDownloadingArchive}
        >
          {isDownloadingArchive ? (
            <>
              <i className="fas fa-spinner fa-spin"></i> Preparing
            </>
          ) : (
            <>
              <i className="fas fa-download"></i> Download
            </>
          )}
        </button>
        {error && error.includes('archive') && (
          <div className="archive-error" style={{ fontSize: '0.8rem', color: '#ff6b6b', marginTop: '5px' }}>
            {error}
          </div>
        )}
      </div>
      <div className="royalties-cell" data-label="Action:">
        <button className="withdraw-btn">
          <i className="fas fa-wallet"></i> Withdraw
        </button>
      </div>
    </div>
  </div>
</div>
                ) : (
                  <div className="empty-state">
                    <i className="fas fa-coins"></i>
                    <h3>No Royalties Available</h3>
                    <p>You don't own any NFTs yet, so no royalties are available.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {isEditingName && (
        <EditNameModal
          currentName={userData?.name || ''}
          onSave={handleNameUpdate}
          onClose={() => setIsEditingName(false)}
        />
      )}
    </div>
  );
};

export default UserPanel;