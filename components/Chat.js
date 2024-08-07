import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
  Text,
} from "react-native";
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  addDoc,
} from "firebase/firestore";
import { Bubble, GiftedChat, InputToolbar } from "react-native-gifted-chat";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CustomActions from "./CustomActions";
import MapView from "react-native-maps";
import { Audio } from "expo-av";
import { getStorage } from "firebase/storage";

const Chat = ({ route, navigation, db, isConnected }) => {
  const { name, backgroundColor, userId } = route.params;
  const [messages, setMessages] = useState([]);
  const storage = getStorage();

  useEffect(() => {
    // Set the navigation title to the name from route parameters
    navigation.setOptions({ title: name });

    let unsubMessages = null;
    if (isConnected) {
      // Query to fetch messages ordered by creation time in descending order
      const q = query(collection(db, "messages"), orderBy("createdAt", "desc"));
      unsubMessages = onSnapshot(
        q,
        (documentsSnapshot) => {
          // Map documents to message format
          const newMessages = documentsSnapshot.docs.map((doc) => ({
            _id: doc.id,
            ...doc.data(),
            createdAt: new Date(doc.data().createdAt.toMillis()),
          }));
          cacheMessages(newMessages); // Cache the messages locally
          setMessages(newMessages); // Update state with new messages
        },
        (error) => {
          Alert.alert("Error fetching messages", error.message);
        }
      );
    } else {
      loadCachedMessages(); // Load cached messages when offline
    }

    // Cleanup subscription on component unmount
    return () => unsubMessages && unsubMessages();
  }, [isConnected, db, navigation, name]);

  // Cache messages to AsyncStorage
  const cacheMessages = async (messagesToCache) => {
    try {
      await AsyncStorage.setItem("messages", JSON.stringify(messagesToCache));
    } catch (error) {
      Alert.alert("Error caching messages", error.message);
    }
  };

  // Load cached messages from AsyncStorage
  const loadCachedMessages = async () => {
    try {
      const cachedMessages = (await AsyncStorage.getItem("messages")) || "[]";
      setMessages(JSON.parse(cachedMessages));
    } catch (error) {
      Alert.alert("Error loading messages from cache", error.message);
    }
  };

  // Handle sending new messages
  const onSend = useCallback(
    async (newMessages) => {
      if (isConnected) {
        try {
          const messageToAdd = {
            ...newMessages[0],
            createdAt: new Date(),
          };
          await addDoc(collection(db, "messages"), messageToAdd);
        } catch (error) {
          Alert.alert("Failed to send message", error.message);
        }
      } else {
        Alert.alert("You're offline. Unable to send messages.");
      }
    },
    [isConnected]
  );

  // Render input toolbar conditionally based on connection status
  const renderInputToolbar = (props) => {
    return isConnected ? <InputToolbar {...props} /> : null;
  };

  // Customize message bubble appearance
  const renderBubble = (props) => (
    <Bubble
      {...props}
      wrapperStyle={{
        right: { backgroundColor: "#000" },
        left: { backgroundColor: "#FFF" },
      }}
    />
  );

  // Render custom actions (e.g., sending images, location)
  const renderCustomActions = (props) => (
    <CustomActions
      storage={storage}
      userID={userId}
      onSend={onSend}
      {...props}
    />
  );

  // Render custom view for location messages
  const renderCustomView = (props) => {
    const { currentMessage } = props;
    if (currentMessage.location) {
      return (
        <MapView
          style={{ width: 150, height: 100, borderRadius: 13, margin: 3 }}
          region={{
            latitude: currentMessage.location.latitude,
            longitude: currentMessage.location.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
        />
      );
    }
    return null;
  };

  // Play audio messages
  const playAudio = async (audioURI) => {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: audioURI });
      await sound.playAsync();
      return () => sound.unloadAsync(); // Ensure the sound is unloaded
    } catch (error) {
      Alert.alert("Audio playback error", error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : null}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <View style={[styles.container, { backgroundColor }]}>
        <GiftedChat
          messages={messages}
          renderBubble={renderBubble}
          renderInputToolbar={renderInputToolbar}
          onSend={(messages) => onSend(messages)}
          renderActions={renderCustomActions}
          renderCustomView={renderCustomView}
          user={{
            _id: userId,
            name,
          }}
        />
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  locationContainer: {
    margin: 10,
    padding: 10,
    backgroundColor: "#f0f0f0",
    borderRadius: 5,
  },
});

export default Chat;
