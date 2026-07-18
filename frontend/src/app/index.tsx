import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// Default API Base URL - using the local IP of the host machine
const DEFAULT_API_URL = 'http://192.168.1.5:5000/api';

export default function App() {
  // Navigation & Configuration States
  const [currentScreen, setCurrentScreen] = useState<'login' | 'feed' | 'upload' | 'details' | 'wallet'>('login');
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [isUrlModalVisible, setIsUrlModalVisible] = useState(false);
  const [tempApiUrl, setTempApiUrl] = useState(DEFAULT_API_URL);

  // Authentication & Profile States
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: number; username: string; walletBalance: number } | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Media Feed States
  const [feed, setFeed] = useState<any[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any | null>(null);

  // Upload States
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadPrice, setUploadPrice] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  // Wallet States
  const [transactions, setTransactions] = useState<any[]>([]);
  const [walletLoading, setWalletLoading] = useState(false);

  // Load Saved Auth Token and API Url on Mount
  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const savedUrl = await AsyncStorage.getItem('API_URL');
        if (savedUrl) {
          setApiUrl(savedUrl);
          setTempApiUrl(savedUrl);
        }
        const savedToken = await AsyncStorage.getItem('AUTH_TOKEN');
        if (savedToken) {
          setToken(savedToken);
          // Verify token and fetch profile
          fetchProfile(savedToken, savedUrl || DEFAULT_API_URL);
        }
      } catch (e) {
        console.error('Failed to load saved authentication credentials');
      }
    };
    bootstrapAsync();
  }, []);

  // API Call: Fetch User Profile
  const fetchProfile = async (authToken: string, url: string) => {
    try {
      const response = await fetch(`${url}/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
          Accept: 'application/json',
        },
      });
      const data = await response.json();
      if (response.ok) {
        setUser(data.user);
        setCurrentScreen('feed');
        fetchFeed(authToken, url);
      } else {
        // Token might have expired
        handleLogout();
      }
    } catch (err) {
      console.error(err);
      handleLogout();
    }
  };

  // API Call: Login or Register
  const handleAuth = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setAuthLoading(true);
    const endpoint = isRegistering ? 'register' : 'login';

    try {
      const response = await fetch(`${apiUrl}/auth/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      if (response.ok) {
        setToken(data.token);
        setUser(data.user);
        await AsyncStorage.setItem('AUTH_TOKEN', data.token);
        setCurrentScreen('feed');
        fetchFeed(data.token, apiUrl);
        // Clear form
        setUsername('');
        setPassword('');
      } else {
        Alert.alert('Error', data.error || 'Authentication failed');
      }
    } catch (err) {
      Alert.alert('Connection Error', 'Could not reach the server. Please check the API URL settings.');
    } finally {
      setAuthLoading(false);
    }
  };

  // API Call: Fetch Media Feed
  const fetchFeed = async (authToken = token, url = apiUrl) => {
    if (!authToken) return;
    setFeedLoading(true);
    try {
      const response = await fetch(`${url}/media/feed`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
          Accept: 'application/json',
        },
      });
      const data = await response.json();
      if (response.ok) {
        setFeed(data.feed);
      } else {
        console.error(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFeedLoading(false);
    }
  };

  // API Call: Fetch Wallet History
  const fetchWalletHistory = async () => {
    if (!token) return;
    setWalletLoading(true);
    try {
      const response = await fetch(`${apiUrl}/wallet/history`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      const data = await response.json();
      if (response.ok) {
        setTransactions(data.transactions);
        if (user) {
          setUser({ ...user, walletBalance: data.balance });
        }
      } else {
        console.error(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setWalletLoading(false);
    }
  };

  const handleUnlockMedia = async (mediaId: number, price: number) => {
    if (!token || !user) return;
    if (user.walletBalance < price) {
      Alert.alert('Insufficient Balance', 'You do not have enough coins to unlock this image.');
      return;
    }

    const processUnlock = async () => {
      try {
        const response = await fetch(`${apiUrl}/media/${mediaId}/unlock`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });
        const data = await response.json();
        if (response.ok) {
          Alert.alert('Success', 'Content unlocked!');
          setUser({ ...user, walletBalance: data.newBalance });
          
          // Refresh the item details by reloading the feed
          await fetchFeed();
          
          // Update selectedMedia in detail screen
          const resFeed = await fetch(`${apiUrl}/media/feed`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const resData = await resFeed.json();
          if (resFeed.ok) {
            const refreshedItem = resData.feed.find((item: any) => item.id === mediaId);
            if (refreshedItem) setSelectedMedia(refreshedItem);
          }
        } else {
          Alert.alert('Error', data.error || 'Failed to unlock media');
        }
      } catch (err) {
        Alert.alert('Error', 'Connection failed during unlock process');
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Confirm Purchase: Unlock this image for ${price} coins?`);
      if (confirmed) {
        processUnlock();
      }
    } else {
      Alert.alert(
        'Confirm Purchase',
        `Unlock this image for ${price} coins?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Unlock', onPress: processUnlock },
        ]
      );
    }
  };

  // API Call: Upload Media
  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Denied', 'Permission to access gallery is required!');
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0) {
      setSelectedImage(pickerResult.assets[0].uri);
    }
  };

  const handleUpload = async () => {
    if (!uploadTitle.trim() || !uploadPrice.trim() || !selectedImage) {
      Alert.alert('Error', 'Please fill in all fields and select an image');
      return;
    }

    const priceNum = parseInt(uploadPrice, 10);
    if (isNaN(priceNum) || priceNum < 0) {
      Alert.alert('Error', 'Please enter a valid unlock price (0 or higher)');
      return;
    }

    setUploadLoading(true);

    try {
      const formData = new FormData();
      formData.append('title', uploadTitle);
      formData.append('price', priceNum.toString());

      // Extract filename and file type from URI
      const uriParts = selectedImage.split('/');
      let fileName = uriParts[uriParts.length - 1];
      if (!fileName || !fileName.includes('.')) {
        fileName = 'upload.jpg';
      }

      // Cross-platform reliable file upload approach (Web + Native)
      if (Platform.OS === 'web') {
        const responseFile = await fetch(selectedImage);
        const blob = await responseFile.blob();
        formData.append('image', blob, fileName);
      } else {
        const fileType = fileName.split('.').pop() || 'jpg';
        formData.append('image', {
          uri: selectedImage,
          name: fileName,
          type: `image/${fileType.toLowerCase() === 'png' ? 'png' : 'jpeg'}`,
        } as any);
      }

      const response = await fetch(`${apiUrl}/media/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Media published successfully!');
        setUploadTitle('');
        setUploadPrice('');
        setSelectedImage(null);
        setCurrentScreen('feed');
        fetchFeed();
      } else {
        Alert.alert('Error', data.error || 'Failed to upload media');
      }
    } catch (err) {
      Alert.alert('Error', 'Connection failed during upload');
    } finally {
      setUploadLoading(false);
    }
  };

  // Config: Save Custom IP Address
  const handleSaveApiUrl = async () => {
    try {
      await AsyncStorage.setItem('API_URL', tempApiUrl);
      setApiUrl(tempApiUrl);
      setIsUrlModalVisible(false);
      Alert.alert('API Saved', `Connection URL set to: ${tempApiUrl}`);
    } catch (e) {
      Alert.alert('Error', 'Failed to save URL');
    }
  };

  // Logout Handler
  const handleLogout = async () => {
    setToken(null);
    setUser(null);
    await AsyncStorage.removeItem('AUTH_TOKEN');
    setCurrentScreen('login');
  };

  // Screen Switcher Helpers
  const navigateToWallet = () => {
    fetchWalletHistory();
    setCurrentScreen('wallet');
  };

  // Render Helpers
  const renderTransactionItem = ({ item }: { item: any }) => {
    const isDebit = item.amount < 0;
    return (
      <View style={styles.transactionCard}>
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionTitle}>{item.description}</Text>
          <Text style={styles.transactionTime}>{new Date(item.createdAt).toLocaleString()}</Text>
        </View>
        <Text style={[styles.transactionAmount, isDebit ? styles.debitText : styles.creditText]}>
          {isDebit ? '' : '+'}{item.amount} 🪙
        </Text>
      </View>
    );
  };

  const renderFeedItem = ({ item }: { item: any }) => {
    const isLocked = item.status === 'locked';
    return (
      <Pressable
        style={styles.feedCard}
        onPress={() => {
          setSelectedMedia(item);
          setCurrentScreen('details');
        }}>
        <Image source={{ uri: item.imageUrl }} style={styles.feedImage} resizeMode="cover" />
        
        {isLocked && (
          <View style={styles.lockOverlay}>
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={18} color="#FFC107" />
              <Text style={styles.lockPriceText}>{item.price} Coins</Text>
            </View>
          </View>
        )}

        {!isLocked && (
          <View style={styles.unlockedTag}>
            <Text style={styles.unlockedTagText}>UNLOCKED</Text>
          </View>
        )}

        <View style={styles.cardInfo}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardUploader}>by {item.uploader}</Text>
          </View>
          {isLocked ? (
            <Pressable
              style={styles.cardUnlockBtn}
              onPress={() => handleUnlockMedia(item.id, item.price)}>
              <Text style={styles.cardUnlockBtnText}>Unlock</Text>
            </Pressable>
          ) : (
            <Ionicons name="checkmark-circle" size={24} color="#00E676" />
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0B0B0E" />

        {/* --- API CONFIG SETTINGS MODAL --- */}
        <Modal
          visible={isUrlModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsUrlModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>API Server Config</Text>
              <Text style={styles.modalDesc}>Set the local IP and port of your running backend.</Text>
              <TextInput
                style={styles.input}
                value={tempApiUrl}
                onChangeText={setTempApiUrl}
                placeholder="http://192.168.1.5:5000/api"
                placeholderTextColor="#6C6C7A"
                autoCapitalize="none"
              />
              <View style={styles.modalButtons}>
                <Pressable
                  style={[styles.modalBtn, styles.modalBtnCancel]}
                  onPress={() => setIsUrlModalVisible(false)}>
                  <Text style={styles.modalBtnCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.modalBtn, styles.modalBtnSave]} onPress={handleSaveApiUrl}>
                  <Text style={styles.modalBtnSaveText}>Save</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* --- SCREEN 1: LOGIN / REGISTER --- */}
        {currentScreen === 'login' && (
          <ScrollView contentContainerStyle={styles.authScrollContainer}>
            <View style={styles.authHeader}>
              <Ionicons name="images" size={60} color="#8A4FFF" />
              <Text style={styles.authTitle}>Paid Media Locker</Text>
              <Text style={styles.authSubtitle}>Monetize and unlock premium images</Text>
            </View>

            <View style={styles.authCard}>
              <Text style={styles.cardHeaderTitle}>{isRegistering ? 'Create Account' : 'Welcome Back'}</Text>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Username</Text>
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Enter username"
                  placeholderTextColor="#6C6C7A"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter password"
                  placeholderTextColor="#6C6C7A"
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <Pressable style={styles.primaryButton} onPress={handleAuth} disabled={authLoading}>
                {authLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>{isRegistering ? 'Register' : 'Login'}</Text>
                )}
              </Pressable>

              <Pressable style={styles.toggleAuthBtn} onPress={() => setIsRegistering(!isRegistering)}>
                <Text style={styles.toggleAuthBtnText}>
                  {isRegistering ? 'Already have an account? Login' : 'Need an account? Register'}
                </Text>
              </Pressable>
            </View>

            <Pressable style={styles.settingsLink} onPress={() => setIsUrlModalVisible(true)}>
              <Ionicons name="settings" size={16} color="#6C6C7A" style={{ marginRight: 6 }} />
              <Text style={styles.settingsLinkText}>Configure API Connection</Text>
            </Pressable>
          </ScrollView>
        )}

        {/* --- SCREEN 2: MEDIA FEED --- */}
        {currentScreen === 'feed' && (
          <View style={{ flex: 1 }}>
            {/* Custom Premium Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.headerTitle}>Locker Feed</Text>
                <Text style={styles.headerSubtitle}>Hello, {user?.username}</Text>
              </View>
              
              <Pressable style={styles.walletHeaderBtn} onPress={navigateToWallet}>
                <Text style={styles.walletHeaderCoins}>{user?.walletBalance} 🪙</Text>
              </Pressable>
            </View>

            {feedLoading ? (
              <View style={styles.centeredContainer}>
                <ActivityIndicator size="large" color="#8A4FFF" />
              </View>
            ) : (
              <FlatList
                data={feed}
                renderItem={renderFeedItem}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.feedList}
                refreshing={feedLoading}
                onRefresh={() => fetchFeed()}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Ionicons name="cloud-offline-outline" size={48} color="#6C6C7A" />
                    <Text style={styles.emptyText}>No media uploaded yet.</Text>
                    <Text style={styles.emptySubText}>Be the first to publish locked media!</Text>
                  </View>
                }
              />
            )}

            {/* Floating Action Button for Uploading */}
            <Pressable style={styles.fab} onPress={() => setCurrentScreen('upload')}>
              <Ionicons name="add" size={32} color="#FFF" />
            </Pressable>
          </View>
        )}

        {/* --- SCREEN 3: MEDIA DETAILS --- */}
        {currentScreen === 'details' && selectedMedia && (
          <View style={{ flex: 1 }}>
            {/* Header */}
            <View style={styles.detailHeader}>
              <Pressable style={styles.backBtn} onPress={() => setCurrentScreen('feed')}>
                <Ionicons name="arrow-back" size={24} color="#FFF" />
              </Pressable>
              <Text style={styles.detailHeaderTitle} numberOfLines={1}>
                {selectedMedia.title}
              </Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.detailContainer}>
              <View style={styles.detailImageContainer}>
                <Image
                  source={{ uri: selectedMedia.imageUrl }}
                  style={styles.detailImage}
                  resizeMode="contain"
                />
                
                {selectedMedia.status === 'locked' && (
                  <View style={styles.detailImageBlurOverlay}>
                    <Ionicons name="lock-closed" size={60} color="#FFC107" />
                    <Text style={styles.detailLockedHeading}>This Image is Locked</Text>
                    <Text style={styles.detailLockedSub}>Unlock to access original resolution</Text>
                  </View>
                )}
              </View>

              <View style={styles.detailInfoSection}>
                <Text style={styles.detailTitle}>{selectedMedia.title}</Text>
                <Text style={styles.detailAuthor}>Published by {selectedMedia.uploader}</Text>

                <View style={styles.divider} />

                {selectedMedia.status === 'locked' ? (
                  <View style={styles.unlockSection}>
                    <Text style={styles.unlockPrompt}>Spend coins to unlock this exclusive content:</Text>
                    <Pressable
                      style={styles.largeUnlockBtn}
                      onPress={() => handleUnlockMedia(selectedMedia.id, selectedMedia.price)}>
                      <Text style={styles.largeUnlockBtnText}>
                        Unlock for {selectedMedia.price} Coins 🪙
                      </Text>
                    </Pressable>
                    <Text style={styles.balancePrompt}>Your current balance: {user?.walletBalance} coins</Text>
                  </View>
                ) : (
                  <View style={styles.unlockedAlert}>
                    <Ionicons name="checkmark-circle" size={28} color="#00E676" style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.unlockedAlertTitle}>Content Unlocked</Text>
                      <Text style={styles.unlockedAlertDesc}>
                        {selectedMedia.status === 'owned'
                          ? 'You uploaded this content.'
                          : 'You successfully unlocked this content.'}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        )}

        {/* --- SCREEN 4: UPLOAD MEDIA --- */}
        {currentScreen === 'upload' && (
          <View style={{ flex: 1 }}>
            {/* Header */}
            <View style={styles.detailHeader}>
              <Pressable style={styles.backBtn} onPress={() => setCurrentScreen('feed')}>
                <Ionicons name="close" size={24} color="#FFF" />
              </Pressable>
              <Text style={styles.detailHeaderTitle}>Publish Media</Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.uploadContainer}>
              <Pressable style={styles.imagePickerBox} onPress={handlePickImage}>
                {selectedImage ? (
                  <Image source={{ uri: selectedImage }} style={styles.pickedImage} />
                ) : (
                  <View style={styles.imagePickerPlaceholder}>
                    <Ionicons name="image-outline" size={48} color="#8A4FFF" />
                    <Text style={styles.imagePickerText}>Tap to select image</Text>
                    <Text style={styles.imagePickerSubtext}>Supports JPG, PNG</Text>
                  </View>
                )}
              </Pressable>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Title</Text>
                <TextInput
                  style={styles.input}
                  value={uploadTitle}
                  onChangeText={setUploadTitle}
                  placeholder="E.g., Sunset in Kyoto"
                  placeholderTextColor="#6C6C7A"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Unlock Price (Coins)</Text>
                <TextInput
                  style={styles.input}
                  value={uploadPrice}
                  onChangeText={setUploadPrice}
                  placeholder="E.g., 100"
                  placeholderTextColor="#6C6C7A"
                  keyboardType="number-pad"
                />
              </View>

              <Pressable
                style={[styles.primaryButton, { marginTop: 20 }]}
                onPress={handleUpload}
                disabled={uploadLoading}>
                {uploadLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Publish Locker</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        )}

        {/* --- SCREEN 5: WALLET & HISTORY --- */}
        {currentScreen === 'wallet' && (
          <View style={{ flex: 1 }}>
            {/* Header */}
            <View style={styles.detailHeader}>
              <Pressable style={styles.backBtn} onPress={() => setCurrentScreen('feed')}>
                <Ionicons name="arrow-back" size={24} color="#FFF" />
              </Pressable>
              <Text style={styles.detailHeaderTitle}>Wallet Ledger</Text>
              <Pressable style={styles.logoutBtn} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={22} color="#FF4B72" />
              </Pressable>
            </View>

            <View style={styles.walletContainer}>
              {/* Premium Coin Balance Card */}
              <View style={styles.balanceCard}>
                <Text style={styles.balanceLabel}>CURRENT COIN BALANCE</Text>
                <View style={styles.balanceValueRow}>
                  <Text style={styles.balanceValue}>{user?.walletBalance}</Text>
                  <Text style={styles.balanceSymbol}>🪙</Text>
                </View>
                <Text style={styles.balanceDetail}>Predefined starting coins: 1,000</Text>
              </View>

              <Text style={styles.ledgerHeader}>Transaction History</Text>

              {walletLoading ? (
                <View style={styles.centeredContainer}>
                  <ActivityIndicator size="large" color="#8A4FFF" />
                </View>
              ) : (
                <FlatList
                  data={transactions}
                  renderItem={renderTransactionItem}
                  keyExtractor={(item) => item.id.toString()}
                  contentContainerStyle={styles.ledgerList}
                  refreshing={walletLoading}
                  onRefresh={fetchWalletHistory}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Ionicons name="receipt-outline" size={48} color="#6C6C7A" />
                      <Text style={styles.emptyText}>No transactions yet.</Text>
                    </View>
                  }
                />
              )}
            </View>
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0E',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // --- HEADER STYLES ---
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C24',
    backgroundColor: '#0B0B0E',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#8A4FFF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  walletHeaderBtn: {
    backgroundColor: '#1E1E28',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  walletHeaderCoins: {
    color: '#FFC107',
    fontWeight: '700',
    fontSize: 14,
  },
  // --- AUTH SCREEN STYLES ---
  authScrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  authHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  authTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 16,
  },
  authSubtitle: {
    color: '#9E9EAF',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  authCard: {
    backgroundColor: '#16161D',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2A2A38',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  cardHeaderTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#9E9EAF',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#22222E',
    color: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2A2A38',
  },
  primaryButton: {
    backgroundColor: '#8A4FFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#8A4FFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  toggleAuthBtn: {
    alignItems: 'center',
    marginTop: 16,
  },
  toggleAuthBtnText: {
    color: '#A78BFA',
    fontSize: 13,
    fontWeight: '600',
  },
  settingsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  settingsLinkText: {
    color: '#6C6C7A',
    fontSize: 13,
    fontWeight: '600',
  },
  // --- SETTINGS MODAL STYLES ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#16161D',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2A2A38',
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  modalDesc: {
    color: '#9E9EAF',
    fontSize: 13,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 12,
  },
  modalBtnCancel: {
    backgroundColor: 'transparent',
  },
  modalBtnCancelText: {
    color: '#6C6C7A',
    fontWeight: '700',
  },
  modalBtnSave: {
    backgroundColor: '#8A4FFF',
  },
  modalBtnSaveText: {
    color: '#FFF',
    fontWeight: '700',
  },
  // --- FEED SCREEN STYLES ---
  feedList: {
    padding: 16,
    paddingBottom: 80,
  },
  feedCard: {
    backgroundColor: '#16161D',
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A2A38',
  },
  feedImage: {
    width: '100%',
    height: 220,
    backgroundColor: '#1C1C24',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    height: 220,
    backgroundColor: 'rgba(11, 11, 14, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(28, 28, 36, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  lockPriceText: {
    color: '#FFC107',
    fontWeight: '800',
    fontSize: 14,
    marginLeft: 6,
  },
  unlockedTag: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 230, 118, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  unlockedTagText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  cardInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  cardTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cardUploader: {
    color: '#9E9EAF',
    fontSize: 12,
    marginTop: 2,
  },
  cardUnlockBtn: {
    backgroundColor: '#8A4FFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  cardUnlockBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#8A4FFF',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8A4FFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  // --- DETAIL SCREEN STYLES ---
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C24',
    backgroundColor: '#0B0B0E',
  },
  backBtn: {
    padding: 4,
  },
  logoutBtn: {
    padding: 4,
  },
  detailHeaderTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  detailContainer: {
    paddingBottom: 40,
  },
  detailImageContainer: {
    width: '100%',
    height: width,
    backgroundColor: '#16161D',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  detailImage: {
    width: '100%',
    height: '100%',
  },
  detailImageBlurOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,11,14,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  detailLockedHeading: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 16,
    textAlign: 'center',
  },
  detailLockedSub: {
    color: '#9E9EAF',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  detailInfoSection: {
    padding: 20,
  },
  detailTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
  },
  detailAuthor: {
    color: '#8A4FFF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#2A2A38',
    marginVertical: 20,
  },
  unlockSection: {
    backgroundColor: '#16161D',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  unlockPrompt: {
    color: '#9E9EAF',
    fontSize: 14,
    marginBottom: 16,
  },
  largeUnlockBtn: {
    backgroundColor: '#FFC107',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeUnlockBtnText: {
    color: '#0B0B0E',
    fontSize: 16,
    fontWeight: '800',
  },
  balancePrompt: {
    color: '#6C6C7A',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },
  unlockedAlert: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 230, 118, 0.1)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#00E676',
  },
  unlockedAlertTitle: {
    color: '#00E676',
    fontWeight: '800',
    fontSize: 15,
  },
  unlockedAlertDesc: {
    color: '#9E9EAF',
    fontSize: 13,
    marginTop: 2,
  },
  // --- UPLOAD SCREEN STYLES ---
  uploadContainer: {
    padding: 20,
  },
  imagePickerBox: {
    width: '100%',
    height: 220,
    backgroundColor: '#16161D',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#2A2A38',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    overflow: 'hidden',
  },
  pickedImage: {
    width: '100%',
    height: '100%',
  },
  imagePickerPlaceholder: {
    alignItems: 'center',
  },
  imagePickerText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  imagePickerSubtext: {
    color: '#6C6C7A',
    fontSize: 12,
    marginTop: 4,
  },
  // --- WALLET SCREEN STYLES ---
  walletContainer: {
    flex: 1,
    padding: 20,
  },
  balanceCard: {
    backgroundColor: '#16161D',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#8A4FFF',
    alignItems: 'center',
    marginBottom: 28,
  },
  balanceLabel: {
    color: '#A78BFA',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  balanceValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  balanceValue: {
    color: '#FFF',
    fontSize: 48,
    fontWeight: '900',
  },
  balanceSymbol: {
    fontSize: 32,
    marginLeft: 10,
  },
  balanceDetail: {
    color: '#6C6C7A',
    fontSize: 12,
    marginTop: 12,
  },
  ledgerHeader: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  ledgerList: {
    paddingBottom: 20,
  },
  transactionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#16161D',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A38',
  },
  transactionInfo: {
    flex: 1,
    marginRight: 10,
  },
  transactionTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  transactionTime: {
    color: '#6C6C7A',
    fontSize: 11,
    marginTop: 4,
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  debitText: {
    color: '#FF4B72',
  },
  creditText: {
    color: '#00E676',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubText: {
    color: '#6C6C7A',
    fontSize: 12,
    marginTop: 4,
  },
});
