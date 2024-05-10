import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import {
  getFirestore,
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  updateDoc,
  doc,
  deleteDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { batch as reduxBatch } from 'react-redux';
import {
  API_KEY,
  APP_ID,
  AUTH_DOMAIN,
  MEASUREMENT_ID,
  MESSAGING_SENDER_ID,
  PROJECT_ID,
  STORAGE_BUCKET,
  VAPID_KEY,
} from './configs/app-global';
import { store } from './redux/store';
import {
  addChat,
  removeChat,
  setMessages,
  setMessagesLoading,
  updateChat,
} from './redux/slices/chat';
import { toast } from 'react-toastify';
import userService from './services/seller/user';
import { getStorage } from 'firebase/storage';
import { setFirebaseToken } from './redux/slices/auth';
import chatService from './services/chat';

const config = localStorage.getItem('persist:settings')
  ? JSON.parse(JSON.parse(localStorage.getItem('persist:settings')).settings)
  : {};

const firebaseConfig = {
  apiKey: config.api_key || API_KEY,
  authDomain: config.auth_domain || AUTH_DOMAIN,
  projectId: config.project_id || PROJECT_ID,
  storageBucket: config.storage_bucket || STORAGE_BUCKET,
  messagingSenderId: config.messaging_sender_id || MESSAGING_SENDER_ID,
  appId: config.app_id || APP_ID,
  measurementId: config.measurement_id || MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

const messaging = getMessaging();
const db = getFirestore(app);
export const storage = getStorage(app);

export function getChat(currentUserId) {
  try {
    const chatCollectionRef = collection(db, 'chat');
    const chatQuery = query(
      chatCollectionRef,
      where('ids', 'array-contains', currentUserId),
    );
    return onSnapshot(chatQuery, (chatSnapshot) => {
      chatSnapshot.docChanges().forEach((change) => {
        switch (change.type) {
          case 'modified': {
            const docData = change.doc.data();
            docData.chatId = change.doc.id;
            delete docData.time;
            store.dispatch(updateChat(docData));
            break;
          }
          case 'removed': {
            store.dispatch(removeChat(change.doc.id));
            break;
          }
          case 'added': {
            const docData = change.doc.data();
            docData.chatId = change.doc.id;
            chatService
              .getUser(docData.ids.filter((id) => id !== currentUserId)[0])
              .then((res) => {
                docData.user = res.data;
                delete docData.time;
                store.dispatch(addChat(docData));
              });
            break;
          }
          default:
            break;
        }
      });
    });
  } catch (error) {
    console.error(error);
  }
}

export function fetchMessages(chatId, userId) {
  if (!chatId) return null;
  try {
    const q = query(collection(db, 'chat', chatId, 'message'), orderBy('time'));

    return onSnapshot(q, async (querySnapshot) => {
      const fetchedMessages = [];
      const batch = writeBatch(db);
      querySnapshot.forEach((doc) => {
        const messageRef = doc.ref;
        const message = doc.data();
        fetchedMessages.push({
          id: doc.id,
          message: message.message,
          time: message.time,
          read: message.read,
          senderId: message.senderId,
          type: message.type,
          replyDocId: message.replyDocId,
          isLast: false,
        });

        if (message.senderId !== userId && !message.read) {
          batch.update(messageRef, {
            read: true,
          });
        }
      });
      fetchedMessages.sort((a, b) => new Date(a.time) - new Date(b.time));
      if (fetchedMessages[querySnapshot.size - 1]) {
        fetchedMessages[querySnapshot.size - 1].isLast = true;
      }
      reduxBatch(() => {
        store.dispatch(setMessagesLoading(false));
        store.dispatch(setMessages(fetchedMessages));
      });
      await batch.commit();
    });
  } catch (error) {
    console.error(error);
  }
}

export async function sendMessage(currentUserId, chatId, payload) {
  if (!chatId || !currentUserId) return null;
  try {
    const chatRef = doc(db, 'chat', chatId);

    await updateDoc(chatRef, {
      lastMessage: payload.message,
      time: serverTimestamp(),
    });

    const body = {
      read: false,
      time: new Date().toISOString(),
      senderId: currentUserId,
      ...payload,
    };

    if (payload.type) {
      body.type = payload.type;
    }

    await addDoc(collection(db, 'chat', chatId, 'message'), body);
  } catch (error) {
    toast.error(error.message);
    console.error(error);
  }
}

export async function editMessage(
  currentUserId,
  chatId,
  payload,
  editingMessage,
) {
  if (!chatId || !currentUserId || !editingMessage || !payload) return null;
  try {
    const messageRef = doc(
      db,
      'chat',
      chatId,
      'message',
      editingMessage.message.id,
    );
    if (editingMessage.message.isLast) {
      await updateDoc(doc(db, 'chat', chatId), {
        lastMessage: payload.message,
        time: serverTimestamp(),
      });
    }
    await updateDoc(messageRef, {
      message: payload.message,
    });
  } catch (error) {
    toast.error(error.message);
    console.error(error);
  }
}

export async function deleteChat(currentChatId) {
  try {
    await deleteDoc(doc(db, 'chat', currentChatId));
  } catch (error) {
    toast.error(error);
  }
}

export async function deleteMessage(chatId, message, messageBeforeLastMessage) {
  if (!chatId || !message) return null;
  try {
    await deleteDoc(doc(db, 'chat', chatId, 'message', message.id));
    if (message.isLast) {
      await updateDoc(doc(db, 'chat', chatId), {
        lastMessage: messageBeforeLastMessage
          ? messageBeforeLastMessage.message
          : '',
        time: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error(error);
    toast.error(error);
  }
}

export async function fetchRepliedMessage(
  messageId,
  currentChatId,
  setReplyMessage,
) {
  if (currentChatId) {
    const q = doc(db, 'chat', currentChatId, 'message', messageId);
    return onSnapshot(q, (snapshot) => {
      const message = snapshot.data();
      setReplyMessage({
        id: snapshot.id,
        message: message?.message,
        type: message?.type,
      });
    });
  }
}
export const requestForToken = () => {
  return getToken(messaging, { vapidKey: config.vapid_key || VAPID_KEY })
    .then((currentToken) => {
      if (currentToken) {
        console.log('current token for client: ', currentToken);
        store.dispatch(setFirebaseToken(currentToken));
        const payload = { firebase_token: currentToken };
        userService
          .profileFirebaseToken(payload)
          .then((res) => console.log('firebase token sent => ', res));
      } else {
        // Show permission request UI
        console.log(
          'No registration token available. Request permission to generate one.',
        );
      }
    })
    .catch((err) => {
      console.log('An error occurred while retrieving token. ', err);
    });
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
